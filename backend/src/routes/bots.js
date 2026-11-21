const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken } = require('../auth');
const pm2Manager = require('../pm2Manager');

const router = express.Router();
const BOT_BASE_PATH = process.env.BOT_BASE_PATH || '/home/nighthost/bots';

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.user.id;
    const botId = req.params.botId;
    const dest = path.join(BOT_BASE_PATH, userId, botId);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage, limits: { files: 50 } });

// All routes require authentication
router.use(authenticateToken);

// GET /api/bots — list all bots for current user
router.get('/', async (req, res) => {
  try {
    const bots = db.prepare('SELECT * FROM bots WHERE user_id = ?').all(req.user.id);
    const botsWithStatus = await Promise.all(
      bots.map(async (bot) => {
        const statusInfo = await pm2Manager.getBotStatus(bot.user_id, bot.id);
        // If DB says expired, keep that status regardless of pm2
        if (bot.status === 'expired') {
          return { ...bot, ...statusInfo, status: 'expired' };
        }
        return { ...bot, ...statusInfo };
      })
    );
    return res.json(botsWithStatus);
  } catch (err) {
    console.error('List bots error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bots/me — return current user's info including coins
router.get('/me', (req, res) => {
  const user = db.prepare('SELECT id, username, coins FROM users WHERE id = ?').get(req.user.id);
  return res.json(user);
});

// POST /api/bots — create a new bot
router.post('/', (req, res) => {
  const { name, runtime, entryFile, plan: rawPlan } = req.body;

  if (!name || !runtime || !entryFile) {
    return res.status(400).json({ error: 'name, runtime, and entryFile are required' });
  }

  if (!['node', 'python'].includes(runtime)) {
    return res.status(400).json({ error: 'runtime must be "node" or "python"' });
  }

  const plan = rawPlan || 'trial';
  if (!['trial', 'weekly', 'monthly'].includes(plan)) {
    return res.status(400).json({ error: 'plan must be "trial", "weekly", or "monthly"' });
  }

  const planCosts = { trial: 10, weekly: 20, monthly: 40 };
  const planDurations = {
    trial: 1 * 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000
  };
  const cost = planCosts[plan];
  const durationMs = planDurations[plan];

  try {
    const userId = req.user.id;
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const currentCoins = userRow ? (userRow.coins || 0) : 0;

    if (currentCoins < cost) {
      return res.status(400).json({ error: `Not enough coins. This plan costs ${cost} coins.` });
    }

    const botId = uuidv4();
    const botDir = path.join(BOT_BASE_PATH, userId, botId);
    fs.mkdirSync(botDir, { recursive: true });

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + durationMs).toISOString();

    // Deduct coins
    db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(cost, userId);

    // Record transaction
    db.prepare(
      'INSERT INTO coins_transactions (id, user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), userId, -cost, `Bot creation: ${plan} plan`, now);

    // Insert bot with plan and expires_at
    db.prepare(
      'INSERT INTO bots (id, user_id, name, runtime, entry_file, status, plan, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(botId, userId, name, runtime, entryFile, 'stopped', plan, expiresAt, now);

    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId);
    return res.status(201).json(bot);
  } catch (err) {
    console.error('Create bot error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bots/:botId — get a single bot
router.get('/:botId', async (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(req.params.botId, req.user.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  try {
    const statusInfo = await pm2Manager.getBotStatus(bot.user_id, bot.id);
    if (bot.status === 'expired') {
      return res.json({ ...bot, ...statusInfo, status: 'expired' });
    }
    return res.json({ ...bot, ...statusInfo });
  } catch (err) {
    return res.json(bot);
  }
});

// POST /api/bots/:botId/renew — renew bot plan
router.post('/:botId/renew', async (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(req.params.botId, req.user.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  if (bot.plan === 'trial') {
    return res.status(400).json({ error: 'Trial bots cannot be renewed.' });
  }

  const planCosts = { weekly: 20, monthly: 40 };
  const planDurations = {
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000
  };

  const cost = planCosts[bot.plan];
  const durationMs = planDurations[bot.plan];

  if (cost === undefined) {
    return res.status(400).json({ error: 'Unknown plan type.' });
  }

  try {
    const userId = req.user.id;
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const currentCoins = userRow ? (userRow.coins || 0) : 0;

    if (currentCoins < cost) {
      return res.status(400).json({ error: `Not enough coins. Renewal costs ${cost} coins.` });
    }

    const now = new Date();
    // Extend from now if expired, otherwise extend from current expiry
    const baseTime = (bot.expires_at && new Date(bot.expires_at) > now)
      ? new Date(bot.expires_at).getTime()
      : now.getTime();
    const newExpiry = new Date(baseTime + durationMs).toISOString();

    // Deduct coins
    db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(cost, userId);

    // Record transaction
    db.prepare(
      'INSERT INTO coins_transactions (id, user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), userId, -cost, `Bot renewal: ${bot.plan} plan`, now.toISOString());

    // Update expires_at
    db.prepare('UPDATE bots SET expires_at = ? WHERE id = ?').run(newExpiry, bot.id);

    // If bot was expired, restart it and set status to running
    if (bot.status === 'expired') {
      try {
        await pm2Manager.startBot(bot.user_id, bot.id, bot.runtime, bot.entry_file);
        db.prepare("UPDATE bots SET status = 'running' WHERE id = ?").run(bot.id);
      } catch (startErr) {
        console.warn(`[renew] Could not restart bot ${bot.id}:`, startErr.message);
        db.prepare("UPDATE bots SET status = 'stopped' WHERE id = ?").run(bot.id);
      }
    }

    const updated = db.prepare('SELECT * FROM bots WHERE id = ?').get(bot.id);
    return res.json(updated);
  } catch (err) {
    console.error('Renew bot error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bots/:botId/upload — upload files to a bot
router.post('/:botId/upload', (req, res, next) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(req.params.botId, req.user.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }
  next();
}, upload.array('files', 50), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  return res.json({
    message: 'Files uploaded',
    files: req.files.map((f) => f.originalname)
  });
});

// POST /api/bots/:botId/start
router.post('/:botId/start', async (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(req.params.botId, req.user.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    await pm2Manager.startBot(bot.user_id, bot.id, bot.runtime, bot.entry_file);
    db.prepare("UPDATE bots SET status = 'running' WHERE id = ?").run(bot.id);
    return res.json({ message: 'Bot started' });
  } catch (err) {
    console.error('Start bot error:', err);
    return res.status(500).json({ error: err.message || 'Failed to start bot' });
  }
});

// POST /api/bots/:botId/stop
router.post('/:botId/stop', async (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(req.params.botId, req.user.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    await pm2Manager.stopBot(bot.user_id, bot.id);
    db.prepare("UPDATE bots SET status = 'stopped' WHERE id = ?").run(bot.id);
    return res.json({ message: 'Bot stopped' });
  } catch (err) {
    console.error('Stop bot error:', err);
    return res.status(500).json({ error: err.message || 'Failed to stop bot' });
  }
});

// POST /api/bots/:botId/restart
router.post('/:botId/restart', async (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(req.params.botId, req.user.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    await pm2Manager.restartBot(bot.user_id, bot.id);
    db.prepare("UPDATE bots SET status = 'running' WHERE id = ?").run(bot.id);
    return res.json({ message: 'Bot restarted' });
  } catch (err) {
    console.error('Restart bot error:', err);
    return res.status(500).json({ error: err.message || 'Failed to restart bot' });
  }
});

// DELETE /api/bots/:botId
router.delete('/:botId', async (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(req.params.botId, req.user.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    await pm2Manager.deleteBot(bot.user_id, bot.id);

    const botDir = path.join(BOT_BASE_PATH, bot.user_id, bot.id);
    if (fs.existsSync(botDir)) {
      fs.rmSync(botDir, { recursive: true, force: true });
    }

    db.prepare('DELETE FROM bots WHERE id = ?').run(bot.id);
    return res.json({ message: 'Bot deleted' });
  } catch (err) {
    console.error('Delete bot error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete bot' });
  }
});

// GET /api/bots/:botId/status
router.get('/:botId/status', async (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(req.params.botId, req.user.id);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    const statusInfo = await pm2Manager.getBotStatus(bot.user_id, bot.id);
    return res.json(statusInfo);
  } catch (err) {
    console.error('Status error:', err);
    return res.status(500).json({ error: 'Failed to get status' });
  }
});

// GET /api/bots/:botId/env
router.get('/:botId/env', (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(req.params.botId, req.user.id);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  const vars = db.prepare('SELECT key, value FROM bot_env WHERE bot_id = ?').all(bot.id);
  return res.json(vars);
});

// POST /api/bots/:botId/env
router.post('/:botId/env', (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ? AND user_id = ?').get(req.params.botId, req.user.id);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  const { vars } = req.body;
  if (!Array.isArray(vars)) return res.status(400).json({ error: 'vars must be an array of { key, value } objects' });

  // Replace env vars in DB
  const deleteStmt = db.prepare('DELETE FROM bot_env WHERE bot_id = ?');
  const insertStmt = db.prepare('INSERT INTO bot_env (id, bot_id, key, value) VALUES (?, ?, ?, ?)');
  const { v4: uuidv4Local } = require('uuid');

  const replaceAll = db.transaction(() => {
    deleteStmt.run(bot.id);
    for (const { key, value } of vars) {
      if (key && typeof key === 'string') {
        insertStmt.run(uuidv4Local(), bot.id, key, value || '');
      }
    }
  });
  replaceAll();

  // Write .env file to bot directory
  const botDir = path.join(BOT_BASE_PATH, bot.user_id, bot.id);
  fs.mkdirSync(botDir, { recursive: true });
  const envContent = vars
    .filter(({ key }) => key && typeof key === 'string')
    .map(({ key, value }) => `${key}=${value || ''}`)
    .join('\n');
  fs.writeFileSync(path.join(botDir, '.env'), envContent, 'utf8');

  return res.json({ message: 'Environment variables saved', count: vars.filter(({ key }) => key && typeof key === 'string').length });
});

module.exports = router;
