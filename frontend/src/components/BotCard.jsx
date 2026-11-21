import React from 'react';

function StatusBadge({ status }) {
  const configs = {
    online:  { dot: 'bg-green-400',  text: 'text-green-400',  label: 'Online'  },
    running: { dot: 'bg-green-400',  text: 'text-green-400',  label: 'Running' },
    stopped: { dot: 'bg-gray-500',   text: 'text-gray-400',   label: 'Stopped' },
    crashed: { dot: 'bg-red-500',    text: 'text-red-400',    label: 'Crashed' },
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
}) {
  const isRunning = bot.status === 'online' || bot.status === 'running';

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">{bot.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <RuntimeBadge runtime={bot.runtime} />
            <StatusBadge status={bot.status} />
          </div>
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
        {!isRunning && (
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
        <button
          onClick={() => onRestart(bot.id)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-700 hover:bg-blue-600 text-white transition-colors"
        >
          Restart
        </button>
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
