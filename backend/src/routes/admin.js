const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const pm2Manager = require('../pm2Manager');
const { authenticateToken, requireAdmin } = require('../auth');

const router = express.Router();

router.use(authenticateToken, requireAdmin);

// GET /api/admin/users — list all users (without password)
router.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, role, enabled, coins, created_at FROM users').all();
    return res.json(users);
  } catch (err) {
    console.error('Admin list users error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/users/:userId/toggle — toggle enabled
router.put('/users/:userId/toggle', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const newEnabled = user.enabled ? 0 : 1;
    db.prepare('UPDATE users SET enabled = ? WHERE id = ?').run(newEnabled, user.id);
    const updated = db.prepare('SELECT id, username, role, enabled, coins, created_at FROM users WHERE id = ?').get(user.id);
    return res.json(updated);
  } catch (err) {
    console.error('Toggle user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users/:userId/coins — add or remove coins
router.post('/users/:userId/coins', (req, res) => {
  const { amount, reason } = req.body;
  if (typeof amount !== 'number' || !reason) {
    return res.status(400).json({ error: 'amount (number) and reason (string) are required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const newBalance = (user.coins || 0) + amount;
  if (newBalance < 0) return res.status(400).json({ error: 'Resulting balance cannot be negative' });

  db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(newBalance, user.id);
  db.prepare(
    'INSERT INTO coins_transactions (id, user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(uuidv4(), user.id, amount, reason, new Date().toISOString());

  const updated = db.prepare('SELECT id, username, role, enabled, coins, created_at FROM users WHERE id = ?').get(user.id);
  return res.json(updated);
});

// GET /api/admin/users/:userId/bots — list bots for a specific user
router.get('/users/:userId/bots', async (req, res) => {
  try {
    const bots = db.prepare('SELECT * FROM bots WHERE user_id = ?').all(req.params.userId);
    const botsWithStatus = await Promise.all(
      bots.map(async (bot) => {
        const statusInfo = await pm2Manager.getBotStatus(bot.user_id, bot.id);
        if (bot.status === 'expired') {
          return { ...bot, ...statusInfo, status: 'expired' };
        }
        return { ...bot, ...statusInfo };
      })
    );
    return res.json(botsWithStatus);
  } catch (err) {
    console.error('Admin get user bots error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/bots — list all bots from all users
router.get('/bots', async (req, res) => {
  try {
    const bots = db.prepare('SELECT * FROM bots').all();
    const botsWithStatus = await Promise.all(
      bots.map(async (bot) => {
        const statusInfo = await pm2Manager.getBotStatus(bot.user_id, bot.id);
        if (bot.status === 'expired') {
          return { ...bot, ...statusInfo, status: 'expired' };
        }
        return { ...bot, ...statusInfo };
      })
    );
    return res.json(botsWithStatus);
  } catch (err) {
    console.error('Admin list bots error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/bots/:botId/start
router.post('/bots/:botId/start', async (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(req.params.botId);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    await pm2Manager.startBot(bot.user_id, bot.id, bot.runtime, bot.entry_file);
    db.prepare("UPDATE bots SET status = 'running' WHERE id = ?").run(bot.id);
    return res.json({ message: 'Bot started' });
  } catch (err) {
    console.error('Admin start bot error:', err);
    return res.status(500).json({ error: err.message || 'Failed to start bot' });
  }
});

// POST /api/admin/bots/:botId/stop
router.post('/bots/:botId/stop', async (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(req.params.botId);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    await pm2Manager.stopBot(bot.user_id, bot.id);
    db.prepare("UPDATE bots SET status = 'stopped' WHERE id = ?").run(bot.id);
    return res.json({ message: 'Bot stopped' });
  } catch (err) {
    console.error('Admin stop bot error:', err);
    return res.status(500).json({ error: err.message || 'Failed to stop bot' });
  }
});

// POST /api/admin/bots/:botId/restart
router.post('/bots/:botId/restart', async (req, res) => {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(req.params.botId);
  if (!bot) {
    return res.status(404).json({ error: 'Bot not found' });
  }

  try {
    await pm2Manager.restartBot(bot.user_id, bot.id);
    db.prepare("UPDATE bots SET status = 'running' WHERE id = ?").run(bot.id);
    return res.json({ message: 'Bot restarted' });
  } catch (err) {
    console.error('Admin restart bot error:', err);
    return res.status(500).json({ error: err.message || 'Failed to restart bot' });
  }
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const statuses = await pm2Manager.getAllStatuses();
    return res.json(statuses);
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
