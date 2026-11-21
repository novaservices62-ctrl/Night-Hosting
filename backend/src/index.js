require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

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
