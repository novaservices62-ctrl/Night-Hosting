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
        return { ...bot, ...statusInfo };
      })
    );
    return res.json(botsWithStatus);
  } catch (err) {
    console.error('List bots error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bots — create a new bot
router.post('/', (req, res) => {
  const { name, runtime, entryFile } = req.body;

  if (!name || !runtime || !entryFile) {
    return res.status(400).json({ error: 'name, runtime, and entryFile are required' });
  }

  if (!['node', 'python'].includes(runtime)) {
    return res.status(400).json({ error: 'runtime must be "node" or "python"' });
  }

  try {
    const botId = uuidv4();
    const userId = req.user.id;
    const botDir = path.join(BOT_BASE_PATH, userId, botId);
    fs.mkdirSync(botDir, { recursive: true });

    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO bots (id, user_id, name, runtime, entry_file, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(botId, userId, name, runtime, entryFile, 'stopped', now);

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
    return res.json({ ...bot, ...statusInfo });
  } catch (err) {
    return res.json(bot);
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

module.exports = router;
