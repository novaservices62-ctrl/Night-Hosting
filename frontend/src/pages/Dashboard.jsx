import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api';
import { useAuth } from '../App';

function StatCard({ label, value, color, icon }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 flex items-center gap-4">
      <div className={`text-3xl ${color} select-none`}>{icon}</div>
      <div>
        <div className="text-sm text-gray-400 mb-0.5">{label}</div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800/50">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-5 py-3">
          <div className="h-4 bg-gray-800 rounded animate-pulse w-24" />
        </td>
      ))}
    </tr>
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

function StatusDot({ status }) {
  const isRunning = status === 'online' || status === 'running';
  const isExpired = status === 'expired';
  const isCrashed = status === 'crashed';
  const color = isRunning
    ? 'bg-green-400'
    : isExpired || isCrashed
    ? 'bg-red-500'
    : 'bg-gray-500';
  const label = isRunning ? 'Running' : isExpired ? 'Expired' : isCrashed ? 'Crashed' : 'Stopped';
  return (
    <span className="flex items-center gap-1.5 text-sm text-gray-300">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bots, setBots] = useState([]);
  const [coins, setCoins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAll = useCallback(async () => {
    setError('');
    try {
      const [botsRes, meRes] = await Promise.all([
        api.get('/bots'),
        api.get('/bots/me'),
      ]);
      setBots(botsRes.data);
      setCoins(meRes.data.coins);
    } catch {
      setError('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const total = bots.length;
  const running = bots.filter((b) => b.status === 'online' || b.status === 'running').length;
  const recent = bots.slice(0, 5);

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            Welcome back, <span className="text-indigo-400">{user?.username}</span> 👋
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Here's an overview of your bots.</p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Bots" value={loading ? '…' : total} color="text-white" icon="🤖" />
          <StatCard label="Running" value={loading ? '…' : running} color="text-green-400" icon="▶️" />
          <StatCard label="Coin Balance" value={loading ? '…' : coins !== null ? coins : '—'} color="text-yellow-400" icon="🪙" />
          <StatCard label="Storage Used" value="—" color="text-blue-400" icon="💾" />
        </div>

        {/* Recent bots */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Bots</h2>
            <button
              onClick={() => navigate('/bots')}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View all →
            </button>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Runtime</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Uptime</th>
                  <th className="text-left px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && [1, 2, 3].map((i) => <SkeletonRow key={i} />)}
                {!loading && recent.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-gray-600">
                      No bots yet.{' '}
                      <button onClick={() => navigate('/bots')} className="text-indigo-400 hover:underline">
                        Create your first bot
                      </button>
                    </td>
                  </tr>
                )}
                {!loading && recent.map((bot) => (
                  <tr key={bot.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{bot.name}</td>
                    <td className="px-5 py-3"><RuntimeBadge runtime={bot.runtime} /></td>
                    <td className="px-5 py-3"><StatusDot status={bot.status} /></td>
                    <td className="px-5 py-3 text-gray-400">—</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => navigate(`/bots/${bot.id}`)}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
