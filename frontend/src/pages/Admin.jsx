import React, { useEffect, useState, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../api';

function StatusDot({ status }) {
  const isRunning = status === 'online' || status === 'running';
  const isCrashed = status === 'crashed';
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${
      isRunning ? 'text-green-400' : isCrashed ? 'text-red-400' : 'text-gray-400'
    }`}>
      <span className={`w-2 h-2 rounded-full ${
        isRunning ? 'bg-green-400' : isCrashed ? 'bg-red-500' : 'bg-gray-500'
      }`} />
      <span className="capitalize">{status || 'stopped'}</span>
    </span>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, botsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/bots'),
      ]);
      setUsers(usersRes.data);
      setBots(botsRes.data);
    } catch {
      // silently fail on background refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 15000);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  async function toggleUser(id) {
    await api.put(`/admin/users/${id}/toggle`);
    fetchData();
  }

  async function botAction(id, action) {
    await api.post(`/admin/bots/${id}/${action}`);
    fetchData();
  }

  // Build a user_id → username map for the bots table
  const userMap = {};
  for (const u of users) userMap[u.id] = u.username;

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Admin Panel</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          {['users', 'bots'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && <div className="text-gray-500 text-sm">Loading…</div>}

        {/* Users Table */}
        {!loading && tab === 'users' && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Username</th>
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-gray-600 text-center">No users found.</td>
                  </tr>
                )}
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{u.username}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        u.role === 'admin'
                          ? 'bg-indigo-900 text-indigo-300'
                          : 'bg-gray-700 text-gray-300'
                      }`}>
                        {u.role || 'user'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        !u.enabled
                          ? 'bg-red-900 text-red-300'
                          : 'bg-green-900 text-green-300'
                      }`}>
                        {!u.enabled ? 'Disabled' : 'Enabled'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => toggleUser(u.id)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                          !u.enabled
                            ? 'bg-green-700 hover:bg-green-600 text-white'
                            : 'bg-red-800 hover:bg-red-700 text-white'
                        }`}
                      >
                        {!u.enabled ? 'Enable' : 'Disable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bots Table */}
        {!loading && tab === 'bots' && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Bot Name</th>
                  <th className="text-left px-5 py-3">Owner</th>
                  <th className="text-left px-5 py-3">Runtime</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">CPU</th>
                  <th className="text-left px-5 py-3">Memory</th>
                  <th className="text-left px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bots.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-gray-600 text-center">No bots found.</td>
                  </tr>
                )}
                {bots.map((bot) => (
                  <tr key={bot.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{bot.name}</td>
                    <td className="px-5 py-3 text-gray-300">
                      {userMap[bot.user_id] || bot.user_id || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        bot.runtime === 'node'
                          ? 'bg-green-900 text-green-300'
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {bot.runtime === 'node' ? 'Node.js' : 'Python'}
                      </span>
                    </td>
                    <td className="px-5 py-3"><StatusDot status={bot.status} /></td>
                    <td className="px-5 py-3 text-gray-300">
                      {bot.cpu !== undefined ? `${Number(bot.cpu).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-300">
                      {bot.memory !== undefined ? `${Number(bot.memory).toFixed(0)} MB` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => botAction(bot.id, 'start')}
                          className="px-2 py-1 text-xs font-semibold rounded bg-green-700 hover:bg-green-600 text-white transition-colors"
                        >
                          Start
                        </button>
                        <button
                          onClick={() => botAction(bot.id, 'stop')}
                          className="px-2 py-1 text-xs font-semibold rounded bg-yellow-700 hover:bg-yellow-600 text-white transition-colors"
                        >
                          Stop
                        </button>
                        <button
                          onClick={() => botAction(bot.id, 'restart')}
                          className="px-2 py-1 text-xs font-semibold rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors"
                        >
                          Restart
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
