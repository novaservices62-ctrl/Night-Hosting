require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Import db first to trigger table creation and admin seed
const db = require('./db');

const { authenticateToken } = require('./auth');
const pm2Manager = require('./pm2Manager');

const authRoutes = require('./routes/auth');
const botsRoutes = require('./routes/bots');
const filesRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/bots', botsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/admin', adminRoutes);

// Serve static frontend
const publicDir = path.join(__dirname, '../../public');
app.use(express.static(publicDir));

// SPA fallback — only for non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Socket.io — console log streaming
io.on('connection', (socket) => {
  socket.on('subscribe-console', ({ botId, token } = {}) => {
    if (!botId || !token) {
      socket.emit('console', '[Night Host] Missing botId or token\n');
      return;
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      socket.emit('console', '[Night Host] Invalid or expired token\n');
      return;
    }

    const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(botId);
    if (!bot) {
      socket.emit('console', '[Night Host] Bot not found\n');
      return;
    }

    const isOwner = bot.user_id === payload.id;
    const isAdmin = payload.role === 'admin';

    if (!isOwner && !isAdmin) {
      socket.emit('console', '[Night Host] Access denied\n');
      return;
    }

    pm2Manager.streamLogs(bot.user_id, bot.id, socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Night Host panel running on port ${PORT}`);
});

// Expiry background job — runs every 5 minutes
setInterval(async () => {
  try {
    const now = new Date().toISOString();
    // Get all bots that are expired and not already marked expired
    const expiredBots = db.prepare(
      "SELECT * FROM bots WHERE expires_at IS NOT NULL AND expires_at < ? AND status != 'expired'"
    ).all(now);

    for (const bot of expiredBots) {
      // Check if user has enough coins for auto-renewal
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(bot.user_id);
      const renewalCost = bot.plan === 'weekly' ? 20 : bot.plan === 'monthly' ? 40 : null;

      let renewed = false;
      if (renewalCost !== null && user && user.coins >= renewalCost) {
        // Auto-renew: deduct coins, extend expires_at
        const durationMs = bot.plan === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
        const newExpiry = new Date(Date.now() + durationMs).toISOString();
        db.prepare('UPDATE users SET coins = coins - ? WHERE id = ?').run(renewalCost, user.id);
        db.prepare('UPDATE bots SET expires_at = ? WHERE id = ?').run(newExpiry, bot.id);
        db.prepare(
          'INSERT INTO coins_transactions (id, user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)'
        ).run(uuidv4(), user.id, -renewalCost, `Auto-renewal: ${bot.plan} plan for bot ${bot.name}`, new Date().toISOString());
        renewed = true;
        console.log(`[expiry] Auto-renewed bot ${bot.id} (${bot.name}) for user ${user.username}`);
      }

      if (!renewed) {
        // Stop the PM2 process and mark as expired
        try {
          await pm2Manager.stopBot(bot.user_id, bot.id);
        } catch (e) {
          console.warn(`[expiry] Could not stop pm2 for bot ${bot.id}:`, e.message);
        }
        db.prepare("UPDATE bots SET status = 'expired' WHERE id = ?").run(bot.id);
        console.log(`[expiry] Expired bot ${bot.id} (${bot.name}) for user ${user ? user.username : bot.user_id}`);
      }
    }
  } catch (err) {
    console.error('[expiry] Background job error:', err);
  }
}, 300000);
