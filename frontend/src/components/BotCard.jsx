import React from 'react';

function StatusBadge({ status }) {
  const configs = {
    online:   { dot: 'bg-green-400',  text: 'text-green-400',  label: 'Online'  },
    running:  { dot: 'bg-green-400',  text: 'text-green-400',  label: 'Running' },
    stopped:  { dot: 'bg-gray-500',   text: 'text-gray-400',   label: 'Stopped' },
    crashed:  { dot: 'bg-red-500',    text: 'text-red-400',    label: 'Crashed' },
    expired:  { dot: 'bg-red-600',    text: 'text-red-400',    label: 'Expired' },
  };
  const cfg = configs[status] || configs.stopped;
  return (
    <span className={`flex items-center gap-1.5 text-sm font-medium ${cfg.text}`}>
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function RuntimeBadge({ runtime }) {
  const isNode = runtime === 'node';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
      isNode ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'
    }`}>
      {isNode ? 'Node.js' : 'Python'}
    </span>
  );
}

export default function BotCard({
  bot,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onConsole,
  onFiles,
  onRenew,
}) {
  const isRunning = bot.status === 'online' || bot.status === 'running';
  const isExpired = bot.status === 'expired';

  const showRenew = bot.plan !== 'trial' && (() => {
    if (isExpired) return true;
    if (bot.expires_at && (new Date(bot.expires_at) - Date.now()) < 24 * 60 * 60 * 1000) return true;
    return false;
  })();

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">{bot.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <RuntimeBadge runtime={bot.runtime} />
            <StatusBadge status={bot.status} />
            {isExpired && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-900 text-red-300">EXPIRED</span>
            )}
          </div>
          {bot.plan && (
            <div className="text-xs text-gray-500 mt-1">
              <span className="capitalize">{bot.plan}</span>
              {bot.expires_at && (
                <span> · Expires {new Date(bot.expires_at).toLocaleDateString()}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-gray-900 rounded-lg px-3 py-2">
          <div className="text-gray-500 text-xs mb-0.5">CPU</div>
          <div className="text-white font-semibold">
            {bot.cpu !== undefined ? `${Number(bot.cpu).toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg px-3 py-2">
          <div className="text-gray-500 text-xs mb-0.5">Memory</div>
          <div className="text-white font-semibold">
            {bot.memory !== undefined ? `${Number(bot.memory).toFixed(0)} MB` : '—'}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        {!isRunning && !isExpired && (
          <button
            onClick={() => onStart(bot.id)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors"
          >
            Start
          </button>
        )}
        {isRunning && (
          <button
            onClick={() => onStop(bot.id)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white transition-colors"
          >
            Stop
          </button>
        )}
        {!isExpired && (
          <button
            onClick={() => onRestart(bot.id)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-600 text-white transition-colors"
          >
            Restart
          </button>
        )}
        <button
          onClick={() => onConsole(bot.id)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
        >
          Console
        </button>
        <button
          onClick={() => onFiles(bot.id)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-600 hover:bg-gray-500 text-white transition-colors"
        >
          Files
        </button>
        {showRenew && (
          <button
            onClick={() => onRenew(bot.id)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-700 hover:bg-purple-600 text-white transition-colors"
          >
            Renew
          </button>
        )}
        <button
          onClick={() => onDelete(bot.id)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-800 hover:bg-red-700 text-white transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
