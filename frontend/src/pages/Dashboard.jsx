import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api';
import { useAuth } from '../App';

function StatCard({ label, value, color }) {
  return (
    <div className={`bg-gray-800 rounded-xl p-5 border border-gray-700`}>
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBots = useCallback(async () => {
    try {
      const { data } = await api.get('/bots');
      setBots(data);
    } catch {
      // silently ignore on background refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const total = bots.length;
  const running = bots.filter((b) => b.status === 'online' || b.status === 'running').length;
  const stopped = bots.filter((b) => b.status === 'stopped').length;
  const recent = bots.slice(0, 5);

  async function quickStart(id) {
    await api.post(`/bots/${id}/start`);
    fetchBots();
  }

  async function quickStop(id) {
    await api.post(`/bots/${id}/stop`);
    fetchBots();
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            Welcome back, <span className="text-indigo-400">{user?.username}</span> 👋
          </h1>
          <p className="text-gray-400 mt-1">Here's an overview of your bots.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <StatCard label="Total Bots" value={total} color="text-white" />
          <StatCard label="Running" value={running} color="text-green-400" />
          <StatCard label="Stopped" value={stopped} color="text-gray-400" />
        </div>

        {/* Recent bots */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Bots</h2>
            <button
              onClick={() => navigate('/bots')}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              View all →
            </button>
          </div>

          {loading && (
            <div className="text-gray-500 text-sm">Loading bots…</div>
          )}

          {!loading && recent.length === 0 && (
            <div className="text-gray-500 text-sm">
              No bots yet.{' '}
              <button onClick={() => navigate('/bots')} className="text-indigo-400 hover:underline">
                Create your first bot
              </button>
            </div>
          )}

          <div className="space-y-3">
            {recent.map((bot) => {
              const isRunning = bot.status === 'online' || bot.status === 'running';
              return (
                <div
                  key={bot.id}
                  className="bg-gray-800 rounded-xl px-5 py-3 border border-gray-700 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isRunning ? 'bg-green-400' : bot.status === 'crashed' ? 'bg-red-500' : 'bg-gray-500'
                      }`}
                    />
                    <span className="text-white font-medium">{bot.name}</span>
                    <span className="text-xs text-gray-500 capitalize">{bot.runtime}</span>
                  </div>
                  <div className="flex gap-2">
                    {!isRunning ? (
                      <button
                        onClick={() => quickStart(bot.id)}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors"
                      >
                        Start
                      </button>
                    ) : (
                      <button
                        onClick={() => quickStop(bot.id)}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white transition-colors"
                      >
                        Stop
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/bots/${bot.id}/console`)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-gray-600 hover:bg-gray-500 text-white transition-colors"
                    >
                      Console
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
