const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../auth');

const router = express.Router();
const BOT_BASE_PATH = process.env.BOT_BASE_PATH || '/home/nighthost/bots';

router.use(authenticateToken);

// Resolve a path safely within a bot's directory, preventing traversal
function safeResolvePath(userId, botId, filePath) {
  const base = path.resolve(path.join(BOT_BASE_PATH, userId, botId));
  const resolved = path.resolve(path.join(base, filePath || ''));

  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    const err = new Error('Path traversal detected');
    err.status = 403;
    throw err;
  }

  return resolved;
}

// Build a recursive file tree for a directory
function buildTree(dirPath, rootPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.map((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      return {
        name: entry.name,
        path: relativePath,
        type: 'dir',
        children: buildTree(fullPath, rootPath)
      };
    }
    return {
      name: entry.name,
      path: relativePath,
      type: 'file'
    };
  });
}

// GET /api/files/:botId/files — list file tree
router.get('/:botId/files', (req, res) => {
  const userId = req.user.id;
  const botId = req.params.botId;
  const botDir = path.resolve(path.join(BOT_BASE_PATH, userId, botId));

  if (!fs.existsSync(botDir)) {
    return res.status(404).json({ error: 'Bot directory not found' });
  }

  try {
    const tree = buildTree(botDir, botDir);
    return res.json(tree);
  } catch (err) {
    console.error('List files error:', err);
    return res.status(500).json({ error: 'Failed to list files' });
  }
});

// GET /api/files/:botId/files/content?path=... — read file
router.get('/:botId/files/content', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  try {
    const resolved = safeResolvePath(req.user.id, req.params.botId, filePath);
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory' });
    }
    const content = fs.readFileSync(resolved, 'utf8');
    return res.json({ content });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Read file error:', err);
    return res.status(500).json({ error: 'Failed to read file' });
  }
});

// PUT /api/files/:botId/files/content — write file
router.put('/:botId/files/content', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: 'path is required' });
  }
  if (content === undefined || content === null) {
    return res.status(400).json({ error: 'content is required' });
  }

  try {
    const resolved = safeResolvePath(req.user.id, req.params.botId, filePath);
    const dir = path.dirname(resolved);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, content, 'utf8');
    return res.json({ message: 'Saved' });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Write file error:', err);
    return res.status(500).json({ error: 'Failed to save file' });
  }
});

// DELETE /api/files/:botId/files?path=... — delete file
router.delete('/:botId/files', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  try {
    const resolved = safeResolvePath(req.user.id, req.params.botId, filePath);
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found' });
    }
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is a directory; use bot delete to remove directories' });
    }
    fs.unlinkSync(resolved);
    return res.json({ message: 'Deleted' });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ error: 'Access denied' });
    }
    console.error('Delete file error:', err);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;
