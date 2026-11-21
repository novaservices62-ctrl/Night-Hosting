const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = process.env.DB_PATH || './nighthost.db';

const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    runtime TEXT NOT NULL,
    entry_file TEXT NOT NULL,
    status TEXT DEFAULT 'stopped',
    created_at TEXT NOT NULL
  );
`);

// Idempotent migrations — wrap each in try/catch so re-runs don't crash
try {
  db.exec("ALTER TABLE users ADD COLUMN coins INTEGER DEFAULT 0");
} catch {}

try {
  db.exec("ALTER TABLE bots ADD COLUMN plan TEXT DEFAULT 'trial'");
} catch {}

try {
  db.exec("ALTER TABLE bots ADD COLUMN expires_at TEXT");
} catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS coins_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS bot_env (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT ''
  );
`);

// Seed admin user if not exists
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!existing) {
  const hashed = bcrypt.hashSync('admin123', 10);
  const { v4: uuidv4 } = require('uuid');
  db.prepare(
    'INSERT INTO users (id, username, password, role, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), 'admin', hashed, 'admin', 1, new Date().toISOString());
  console.log('Admin user seeded (username: admin, password: admin123)');
}

// Always ensure admin has 9999 coins
db.prepare('UPDATE users SET coins = 9999 WHERE username = ?').run('admin');

module.exports = db;
