const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BOT_BASE_PATH = process.env.BOT_BASE_PATH || '/home/nighthost/bots';

function spawnPromise(cmd, args, options) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`${cmd} exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', reject);
  });
}

function spawnPromiseIgnoreError(cmd, args, options) {
  return spawnPromise(cmd, args, options).catch(() => '[]');
}

async function startBot(userId, botId, runtime, entryFile) {
  const botDir = path.join(BOT_BASE_PATH, userId, botId);
  const processName = `nighthost-${userId}-${botId}`;
  const interpreter = runtime === 'python' ? 'python3' : 'node';

  await spawnPromise('pm2', [
    'start', entryFile,
    '--name', processName,
    '--interpreter', interpreter,
    '--no-autorestart', 'false',
    '--cwd', botDir
  ]);
}

async function stopBot(userId, botId) {
  const processName = `nighthost-${userId}-${botId}`;
  await spawnPromise('pm2', ['stop', processName]);
}

async function restartBot(userId, botId) {
  const processName = `nighthost-${userId}-${botId}`;
  await spawnPromise('pm2', ['restart', processName]);
}

async function deleteBot(userId, botId) {
  const processName = `nighthost-${userId}-${botId}`;
  await spawnPromiseIgnoreError('pm2', ['delete', processName]);
}

async function getBotStatus(userId, botId) {
  const processName = `nighthost-${userId}-${botId}`;
  try {
    const raw = await spawnPromiseIgnoreError('pm2', ['jlist']);
    const list = JSON.parse(raw || '[]');
    const proc = list.find((p) => p.name === processName);
    if (!proc) {
      return { status: 'stopped', cpu: 0, memory: 0 };
    }
    return {
      status: proc.pm2_env && proc.pm2_env.status ? proc.pm2_env.status : 'stopped',
      cpu: proc.monit ? proc.monit.cpu : 0,
      memory: proc.monit ? proc.monit.memory : 0
    };
  } catch {
    return { status: 'stopped', cpu: 0, memory: 0 };
  }
}

async function getAllStatuses() {
  try {
    const raw = await spawnPromiseIgnoreError('pm2', ['jlist']);
    const list = JSON.parse(raw || '[]');
    return list.map((p) => ({
      name: p.name,
      status: p.pm2_env && p.pm2_env.status ? p.pm2_env.status : 'stopped',
      cpu: p.monit ? p.monit.cpu : 0,
      memory: p.monit ? p.monit.memory : 0
    }));
  } catch {
    return [];
  }
}

function streamLogs(userId, botId, socket) {
  const processName = `nighthost-${userId}-${botId}`;
  const pm2LogDir = path.join(os.homedir(), '.pm2', 'logs');
  const outLog = path.join(pm2LogDir, `${processName}-out.log`);
  const errLog = path.join(pm2LogDir, `${processName}-error.log`);

  const tails = [];

  function tailFile(logPath) {
    const tail = spawn('tail', ['-f', '-n', '50', logPath], { stdio: ['ignore', 'pipe', 'pipe'] });

    tail.stdout.on('data', (data) => {
      socket.emit('console', data.toString());
    });

    tail.stderr.on('data', (data) => {
      socket.emit('console', data.toString());
    });

    tail.on('error', () => {
      socket.emit('console', `[Night Host] Log file not yet available: ${logPath}\n`);
    });

    tails.push(tail);
    return tail;
  }

  tailFile(outLog);
  tailFile(errLog);

  socket.on('disconnect', () => {
    tails.forEach((t) => {
      try { t.kill(); } catch {}
    });
  });
}

module.exports = { startBot, stopBot, restartBot, deleteBot, getBotStatus, getAllStatuses, streamLogs };
