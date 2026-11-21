import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import api from '../api';
import { getCoinTransactions } from '../api';

export default function Billing() {
  const [coins, setCoins] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchAll() {
      setError('');
      try {
        const [meRes, txRes] = await Promise.all([
          api.get('/bots/me'),
          getCoinTransactions().catch(() => ({ data: [] })),
        ]);
        setCoins(meRes.data.coins);
        const txData = txRes.data;
        setTransactions(Array.isArray(txData) ? txData : txData.transactions || []);
      } catch {
        setError('Failed to load billing data.');
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Billing</h1>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Coin Balance Card */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 mb-8 flex items-center gap-6 max-w-sm">
          <span className="text-5xl select-none">🪙</span>
          <div>
            <div className="text-sm text-gray-400 mb-1">Coin Balance</div>
            <div className="text-4xl font-bold text-yellow-400">
              {loading ? '…' : coins !== null ? coins : '—'}
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Transaction History</h2>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Amount</th>
                  <th className="text-left px-5 py-3">Reason</th>
                  <th className="text-left px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-600">Loading…</td>
                  </tr>
                )}
                {!loading && transactions.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-gray-600">
                      No transactions yet.
                    </td>
                  </tr>
                )}
                {!loading && transactions.map((tx, i) => (
                  <tr key={tx.id || i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className={`px-5 py-3 font-semibold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                    <td className="px-5 py-3 text-gray-300">{tx.reason || '—'}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}
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
