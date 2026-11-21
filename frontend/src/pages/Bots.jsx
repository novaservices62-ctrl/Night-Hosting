import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api';

const PLAN_COSTS = { trial: 10, weekly: 20, monthly: 40 };

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

function StatusBadge({ status }) {
  const isRunning = status === 'online' || status === 'running';
  const isExpired = status === 'expired';
  if (isRunning) {
    return (
      <span className="flex items-center gap-1.5 text-green-400 text-sm">
        <span className="w-2 h-2 rounded-full bg-green-400" />Running
      </span>
    );
  }
  if (isExpired) {
    return (
      <span className="flex items-center gap-1.5 text-red-400 text-sm">
        <span className="w-2 h-2 rounded-full bg-red-500" />Expired
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-gray-400 text-sm">
      <span className="w-2 h-2 rounded-full bg-gray-500" />Stopped
    </span>
  );
}

function DropZone({ onFiles }) {
  const [dragging, setDragging] = useState(false);
  const [fileList, setFileList] = useState([]);
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFileList(dropped);
    onFiles(dropped);
  }

  function handleChange(e) {
    const selected = Array.from(e.target.files);
    setFileList(selected);
    onFiles(selected);
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-indigo-400 bg-indigo-900/20'
            : 'border-gray-700 hover:border-indigo-600 hover:bg-gray-800/50'
        }`}
      >
        <div className="text-4xl mb-3">☁️</div>
        <p className="text-gray-400 text-sm">Drop .zip or files here, or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleChange}
        />
      </div>
      {fileList.length > 0 && (
        <ul className="mt-3 space-y-1">
          {fileList.map((f, i) => (
            <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
              <span className="text-indigo-400">📄</span> {f.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateBotModal({ onClose, onCreate, coins, onCoinsRefresh }) {
  const [form, setForm] = useState({ name: '', runtime: 'node', entryFile: 'index.js', plan: 'trial' });
  const [uploadFiles, setUploadFiles] = useState([]);
  const [createdBot, setCreatedBot] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  const planCost = PLAN_COSTS[form.plan] || 10;
  const notEnoughCoins = coins !== null && coins < planCost;

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    if (notEnoughCoins) {
      setError(`Not enough coins. You need ${planCost} coins but have ${coins}.`);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/bots', form);
      setCreatedBot(data);
      onCreate(data);
      if (onCoinsRefresh) onCoinsRefresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create bot.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!uploadFiles || uploadFiles.length === 0 || !createdBot) return;
    setUploading(true);
    setError('');
    const fd = new FormData();
    for (const f of uploadFiles) fd.append('files', f);
    try {
      await api.post(`/bots/${createdBot.id}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-gray-900 rounded-2xl p-7 w-full max-w-md border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-white">
            {createdBot ? 'Upload Bot Files' : 'New Deployment'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/50 border border-red-700 text-red-300 text-sm">
            {error}
          </div>
        )}

        {!createdBot ? (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Bot Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="My Awesome Bot"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Runtime</label>
              <select
                name="runtime"
                value={form.runtime}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="node">Node.js</option>
                <option value="python">Python</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Entry File</label>
              <input
                type="text"
                name="entryFile"
                value={form.entryFile}
                onChange={handleChange}
                required
                placeholder="index.js"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Plan</label>
              <div className="space-y-2">
                {[
                  { key: 'trial', label: 'Trial', cost: 10, days: '1 day' },
                  { key: 'weekly', label: 'Weekly', cost: 20, days: '7 days' },
                  { key: 'monthly', label: 'Monthly', cost: 40, days: '30 days' },
                ].map((p) => (
                  <label
                    key={p.key}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                      form.plan === p.key
                        ? 'border-indigo-500 bg-indigo-900/30'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="plan"
                        value={p.key}
                        checked={form.plan === p.key}
                        onChange={handleChange}
                        className="accent-indigo-500"
                      />
                      <span className="text-white font-medium">{p.label}</span>
                      <span className="text-gray-400 text-xs">{p.days}</span>
                    </div>
                    <span className="text-yellow-300 font-semibold text-sm">{p.cost} 🪙</span>
                  </label>
                ))}
              </div>
              <div className={`mt-2 text-xs ${notEnoughCoins ? 'text-red-400' : 'text-gray-500'}`}>
                Your balance: {coins !== null ? `${coins} coins` : '…'}
                {notEnoughCoins && ` — need ${planCost - (coins || 0)} more coins`}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || notEnoughCoins}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Creating…' : 'Create Bot'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="text-green-400 text-sm">
              ✓ Bot <strong>{createdBot.name}</strong> created. Upload your bot files below.
            </div>
            <DropZone onFiles={setUploadFiles} />
            {uploadDone ? (
              <div className="text-green-400 text-sm">✓ Files uploaded successfully!</div>
            ) : (
              <button
                onClick={handleUpload}
                disabled={uploading || uploadFiles.length === 0}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
              >
                {uploading ? 'Uploading…' : 'Upload Files'}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-gray-400 hover:text-white"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Bots() {
  const navigate = useNavigate();
  const [bots, setBots] = useState([]);
  const [coins, setCoins] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const intervalRef = useRef(null);

  const fetchMe = useCallback(async () => {
    try {
      const meRes = await api.get('/bots/me');
      setCoins(meRes.data.coins);
    } catch {
      // ignore
    }
  }, []);

  const fetchBots = useCallback(async () => {
    try {
      const { data } = await api.get('/bots');
      setBots(data);
    } catch {
      // ignore background refresh errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBots();
    fetchMe();
    intervalRef.current = setInterval(() => {
      fetchBots();
      fetchMe();
    }, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchBots, fetchMe]);

  function handleCreated() {
    fetchBots();
    fetchMe();
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">My Bots</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            New Deployment
          </button>
        </div>

        {coins !== null && (
          <div className="mb-5 inline-flex items-center gap-2 px-4 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-xl">
            <span className="text-yellow-400 text-lg">🪙</span>
            <span className="text-yellow-300 font-semibold">{coins} coins</span>
          </div>
        )}

        {/* Table */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Uptime</th>
                <th className="text-left px-5 py-3">Memory</th>
                <th className="text-left px-5 py-3">CPU</th>
                <th className="text-left px-5 py-3">Storage</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-gray-600 text-sm">
                    Loading bots…
                  </td>
                </tr>
              )}
              {!loading && bots.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="text-4xl mb-3">🤖</div>
                    <p className="text-gray-500">No bots yet. Create your first deployment!</p>
                  </td>
                </tr>
              )}
              {!loading && bots.map((bot) => {
                const memUsed = bot.memory !== undefined ? Number(bot.memory).toFixed(0) : null;
                const memLimit = 512;
                const memPct = memUsed !== null ? Math.min(100, (Number(memUsed) / memLimit) * 100) : 0;
                const cpuVal = bot.cpu !== undefined ? Number(bot.cpu).toFixed(1) : null;
                return (
                  <tr
                    key={bot.id}
                    onClick={() => navigate(`/bots/${bot.id}`)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{bot.name}</span>
                        <RuntimeBadge runtime={bot.runtime} />
                      </div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={bot.status} /></td>
                    <td className="px-5 py-3 text-gray-400">—</td>
                    <td className="px-5 py-3">
                      {memUsed !== null ? (
                        <div className="min-w-[120px]">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{memUsed} MB</span>
                            <span>{memLimit} MB</span>
                          </div>
                          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${memPct}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-300">
                      {cpuVal !== null ? `${cpuVal}% / 25%` : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-500">—</td>
                    <td className="px-5 py-3 text-gray-500">›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {showModal && (
        <CreateBotModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreated}
          coins={coins}
          onCoinsRefresh={fetchMe}
        />
      )}
    </div>
  );
}
