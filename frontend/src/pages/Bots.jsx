import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import BotCard from '../components/BotCard';
import api from '../api';

function CreateBotModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', runtime: 'node', entryFile: 'index.js' });
  const [files, setFiles] = useState(null);
  const [createdBot, setCreatedBot] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/bots', form);
      setCreatedBot(data);
      onCreate(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create bot.');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!files || files.length === 0 || !createdBot) return;
    setUploading(true);
    setError('');
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
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
            {createdBot ? 'Upload Bot Files' : 'Create New Bot'}
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
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Creating…' : 'Create Bot'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="text-green-400 text-sm mb-2">
              ✓ Bot <strong>{createdBot.name}</strong> created. Upload your bot files below.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Select Files</label>
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(e.target.files)}
                className="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-700 file:text-white file:cursor-pointer hover:file:bg-indigo-600"
              />
            </div>
            {uploadDone ? (
              <div className="text-green-400 text-sm">✓ Files uploaded successfully!</div>
            ) : (
              <button
                onClick={handleUpload}
                disabled={uploading || !files || files.length === 0}
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
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const intervalRef = useRef(null);

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
    intervalRef.current = setInterval(fetchBots, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchBots]);

  async function handleStart(id) {
    await api.post(`/bots/${id}/start`);
    fetchBots();
  }
  async function handleStop(id) {
    await api.post(`/bots/${id}/stop`);
    fetchBots();
  }
  async function handleRestart(id) {
    await api.post(`/bots/${id}/restart`);
    fetchBots();
  }
  async function handleDelete(id) {
    if (!window.confirm('Delete this bot? This cannot be undone.')) return;
    await api.delete(`/bots/${id}`);
    fetchBots();
  }
  function handleConsole(id) {
    navigate(`/bots/${id}/console`);
  }
  function handleFiles(id) {
    navigate(`/bots/${id}/files`);
  }

  function handleCreated() {
    fetchBots();
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-white">My Bots</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            Create Bot
          </button>
        </div>

        {loading && <div className="text-gray-500">Loading bots…</div>}

        {!loading && bots.length === 0 && (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">🤖</div>
            <p>No bots yet. Create your first one!</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onStart={handleStart}
              onStop={handleStop}
              onRestart={handleRestart}
              onDelete={handleDelete}
              onConsole={handleConsole}
              onFiles={handleFiles}
            />
          ))}
        </div>
      </main>

      {showModal && (
        <CreateBotModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreated}
        />
      )}
    </div>
  );
}
