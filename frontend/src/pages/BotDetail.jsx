import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api, { getBotById, getBotEnv, saveBotEnv, uploadZip, renewBot } from '../api';
import { createSocket } from '../socket';

// ─── Helpers ────────────────────────────────────────────────────────────────

const PLAN_COSTS = { trial: 10, weekly: 20, monthly: 40 };

function StatusBadge({ status }) {
  const isRunning = status === 'online' || status === 'running';
  const isExpired = status === 'expired';
  if (isRunning) return <span className="px-3 py-1 rounded-full bg-green-900/60 text-green-300 text-sm font-semibold border border-green-700">Running</span>;
  if (isExpired) return <span className="px-3 py-1 rounded-full bg-red-900/60 text-red-300 text-sm font-semibold border border-red-700">Expired</span>;
  return <span className="px-3 py-1 rounded-full bg-gray-800 text-gray-400 text-sm font-semibold border border-gray-700">Stopped</span>;
}

function Toast({ msg, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium border ${
      type === 'success'
        ? 'bg-green-800 text-green-200 border-green-600'
        : 'bg-red-800 text-red-200 border-red-600'
    }`}>
      {msg}
    </div>
  );
}

// ─── FileTree (from FileManager) ────────────────────────────────────────────

function FileTree({ nodes, onSelect, selectedPath, depth = 0 }) {
  const [collapsed, setCollapsed] = useState({});
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <li key={node.path}>
          {node.type === 'dir' ? (
            <div>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [node.path]: !c[node.path] }))}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                className="w-full text-left flex items-center gap-1.5 py-1 px-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded text-sm transition-colors"
              >
                <span>{collapsed[node.path] ? '▶' : '▼'}</span>
                <span>📁</span>
                <span>{node.name}</span>
              </button>
              {!collapsed[node.path] && node.children && (
                <FileTree nodes={node.children} onSelect={onSelect} selectedPath={selectedPath} depth={depth + 1} />
              )}
            </div>
          ) : (
            <button
              onClick={() => onSelect(node)}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className={`w-full text-left flex items-center gap-1.5 py-1 px-2 rounded text-sm transition-colors ${
                selectedPath === node.path
                  ? 'bg-indigo-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span>📄</span>
              <span>{node.name}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Console Tab ─────────────────────────────────────────────────────────────

function ConsoleTab({ botId }) {
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState('');
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('nh_token');
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe-console', { botId, token });
    });

    socket.on('console', (data) => {
      const line = typeof data === 'string' ? data : data.line || JSON.stringify(data);
      setLines((prev) => {
        const next = [...prev, line];
        return next.length > 500 ? next.slice(next.length - 500) : next;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [botId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  function handleSend() {
    if (!input.trim()) return;
    const token = localStorage.getItem('nh_token');
    socketRef.current?.emit('bot-input', { botId, token, input });
    setInput('');
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setLines([])}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="flex-1 bg-black rounded-xl border border-gray-800 p-4 font-mono text-sm text-green-400 overflow-y-auto min-h-0" style={{ minHeight: '400px' }}>
        {lines.length === 0 && (
          <div className="text-gray-600 italic">No output yet…</div>
        )}
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all leading-5">{line}</div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Send command…"
          className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600"
        />
        <button
          onClick={handleSend}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm transition-colors"
        >
          Run
        </button>
      </div>
    </div>
  );
}

// ─── Files Tab ───────────────────────────────────────────────────────────────

function FilesTab({ botId }) {
  const [tree, setTree] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  function showToast(msg, type) {
    setToast({ msg, type });
  }

  const fetchFiles = useCallback(async () => {
    try {
      const { data } = await api.get(`/files/${botId}/files`);
      const list = Array.isArray(data) ? data : data.files || [];
      setTree(list);
      const flat = [];
      function flatten(nodes) {
        for (const n of nodes) {
          if (n.type === 'dir' && n.children) flatten(n.children);
          else flat.push(n);
        }
      }
      flatten(list);
      setFiles(flat);
    } catch {
      showToast('Failed to load files.', 'error');
    }
  }, [botId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  async function handleSelectFile(node) {
    setSelectedFile(node);
    setLoadingContent(true);
    setContent('');
    try {
      const { data } = await api.get(`/files/${botId}/files/content`, { params: { path: node.path } });
      const text = typeof data === 'string' ? data : data.content || '';
      setContent(text);
      setOriginalContent(text);
    } catch {
      showToast('Failed to load file.', 'error');
    } finally {
      setLoadingContent(false);
    }
  }

  async function handleSave() {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await api.put(`/files/${botId}/files/content`, { path: selectedFile.path, content });
      setOriginalContent(content);
      showToast('File saved.', 'success');
    } catch {
      showToast('Failed to save file.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedFile) return;
    if (!window.confirm(`Delete "${selectedFile.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/files/${botId}/files`, { params: { path: selectedFile.path } });
      setSelectedFile(null);
      setContent('');
      setOriginalContent('');
      showToast('File deleted.', 'success');
      fetchFiles();
    } catch {
      showToast('Failed to delete file.', 'error');
    }
  }

  async function handleUploadFiles(fileList) {
    const fd = new FormData();
    for (const f of fileList) fd.append('files', f);
    try {
      await api.post(`/bots/${botId}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('Files uploaded.', 'success');
      fetchFiles();
    } catch {
      showToast('Upload failed.', 'error');
    }
  }

  async function handleZipDrop(fileList) {
    const zip = fileList.find((f) => f.name.endsWith('.zip'));
    if (zip) {
      const fd = new FormData();
      fd.append('files', zip);
      try {
        await uploadZip(botId, fd);
        showToast('Zip uploaded.', 'success');
        fetchFiles();
      } catch {
        showToast('Zip upload failed.', 'error');
      }
    } else {
      await handleUploadFiles(fileList);
    }
  }

  const isDirty = content !== originalContent;
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex gap-4 h-full" style={{ minHeight: '500px' }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Left sidebar: tree */}
      <div className="w-56 bg-gray-900 rounded-xl border border-gray-800 p-3 overflow-y-auto flex-shrink-0">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 px-2">Files</div>
        {tree.length === 0 ? (
          <div className="text-gray-600 text-xs px-2">No files found.</div>
        ) : (
          <FileTree nodes={tree} onSelect={handleSelectFile} selectedPath={selectedFile?.path} />
        )}
      </div>

      {/* Right: editor or file list */}
      <div className="flex-1 flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
          <input
            type="text"
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-600"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUploadFiles(Array.from(e.target.files))}
          />
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleZipDrop(Array.from(e.dataTransfer.files));
            }}
            className={`px-3 py-2 rounded-lg text-xs border border-dashed transition-colors cursor-default ${
              dragging ? 'border-indigo-400 bg-indigo-900/20 text-indigo-300' : 'border-gray-700 text-gray-500'
            }`}
          >
            Drop zip
          </div>
        </div>

        {/* Editor or file list */}
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-gray-300">{selectedFile.path}</span>
                {isDirty && <span className="w-2 h-2 rounded-full bg-yellow-400" title="Unsaved" />}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedFile(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-800 hover:bg-red-700 text-white transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
            {loadingContent ? (
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Loading…</div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full bg-gray-950 text-gray-200 font-mono text-sm p-5 resize-none focus:outline-none border-0"
              />
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Size</th>
                  <th className="text-left px-5 py-3">Modified</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-600">No files found.</td>
                  </tr>
                )}
                {filteredFiles.map((f) => (
                  <tr
                    key={f.path}
                    onClick={() => handleSelectFile(f)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-indigo-400 font-mono text-xs">
                      <span className="mr-2">📄</span>{f.name}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {f.size !== undefined ? `${f.size} B` : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {f.modified ? new Date(f.modified).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Environment Tab ──────────────────────────────────────────────────────────

function EnvTab({ botId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getBotEnv(botId)
      .then(({ data }) => {
        let normalized = [];
        if (Array.isArray(data)) {
          normalized = data.map((r) => ({ key: r.key || '', value: r.value || '' }));
        } else if (data && typeof data === 'object') {
          const src = data.vars || data;
          normalized = Object.entries(src).map(([k, v]) => ({ key: k, value: String(v) }));
        }
        setRows(normalized);
      })
      .catch(() => setError('Failed to load environment variables.'))
      .finally(() => setLoading(false));
  }, [botId]);

  function updateRow(i, field, value) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function addRow() {
    setRows((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeRow(i) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError('');
    const vars = {};
    for (const r of rows) {
      if (r.key.trim()) vars[r.key.trim()] = r.value;
    }
    try {
      await saveBotEnv(botId, vars);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save environment variables.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-500 text-sm">Loading…</div>;

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">{error}</div>
      )}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left px-5 py-3">Key</th>
              <th className="text-left px-5 py-3">Value</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-gray-600">No variables set.</td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) => updateRow(i, 'key', e.target.value)}
                    placeholder="KEY"
                    className="w-full bg-gray-800 border border-gray-700 text-white font-mono text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-600"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateRow(i, 'value', e.target.value)}
                    placeholder="value"
                    className="w-full bg-gray-800 border border-gray-700 text-white font-mono text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-600"
                  />
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => removeRow(i)} className="text-gray-500 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3">
        <button
          onClick={addRow}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + Add Row
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ bot, botId, onUpdate }) {
  const navigate = useNavigate();
  const [name, setName] = useState(bot.name || '');
  const [entryFile, setEntryFile] = useState(bot.entry_file || bot.entryFile || '');
  const [runtime, setRuntime] = useState(bot.runtime || 'node');
  const [savingName, setSavingName] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savingRuntime, setSavingRuntime] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  function flash(message) {
    setMsg(message);
    setTimeout(() => setMsg(''), 2500);
  }

  async function saveName() {
    setSavingName(true);
    setError('');
    try {
      await api.put(`/bots/${botId}`, { name });
      onUpdate();
      flash('Name updated.');
    } catch {
      setError('Failed to update name.');
    } finally {
      setSavingName(false);
    }
  }

  async function saveEntry() {
    setSavingEntry(true);
    setError('');
    try {
      await api.put(`/bots/${botId}`, { entryFile });
      onUpdate();
      flash('Entry file updated.');
    } catch {
      setError('Failed to update entry file.');
    } finally {
      setSavingEntry(false);
    }
  }

  async function saveRuntime() {
    setSavingRuntime(true);
    setError('');
    try {
      await api.put(`/bots/${botId}`, { runtime });
      onUpdate();
      flash('Runtime updated.');
    } catch {
      setError('Failed to update runtime.');
    } finally {
      setSavingRuntime(false);
    }
  }

  async function handleRenew() {
    setRenewing(true);
    setError('');
    try {
      await renewBot(botId);
      onUpdate();
      flash('Plan renewed.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to renew plan.');
    } finally {
      setRenewing(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this bot? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`/bots/${botId}`);
      navigate('/bots');
    } catch {
      setError('Failed to delete bot.');
      setDeleting(false);
    }
  }

  const planCost = PLAN_COSTS[bot.plan] || 10;

  return (
    <div className="max-w-lg space-y-6">
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-900/40 border border-red-700 text-red-300 text-sm">{error}</div>
      )}
      {msg && (
        <div className="px-4 py-3 rounded-lg bg-green-900/40 border border-green-700 text-green-300 text-sm">{msg}</div>
      )}

      {/* Rename */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-white font-semibold mb-4">Rename Bot</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={saveName}
            disabled={savingName}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {savingName ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Entry File */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-white font-semibold mb-4">Entry File</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={entryFile}
            onChange={(e) => setEntryFile(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={saveEntry}
            disabled={savingEntry}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {savingEntry ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Runtime */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-white font-semibold mb-4">Runtime</h3>
        <div className="flex gap-3">
          <select
            value={runtime}
            onChange={(e) => setRuntime(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="node">Node.js</option>
            <option value="python">Python</option>
          </select>
          <button
            onClick={saveRuntime}
            disabled={savingRuntime}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {savingRuntime ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Plan */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-white font-semibold mb-4">Plan</h3>
        <div className="text-sm text-gray-400 space-y-1 mb-4">
          <div>Current plan: <span className="text-white capitalize">{bot.plan || '—'}</span></div>
          <div>
            Expires: <span className="text-white">
              {bot.expires_at ? new Date(bot.expires_at).toLocaleString() : '—'}
            </span>
          </div>
        </div>
        <button
          onClick={handleRenew}
          disabled={renewing}
          className="px-4 py-2.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {renewing ? 'Renewing…' : `Renew — ${planCost} 🪙`}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-950/30 rounded-xl border border-red-800 p-5">
        <h3 className="text-red-400 font-semibold mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-400 mb-4">Deleting this bot is permanent and cannot be undone.</p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {deleting ? 'Deleting…' : 'Delete Bot'}
        </button>
      </div>
    </div>
  );
}

// ─── BotDetail Page ───────────────────────────────────────────────────────────

export default function BotDetail() {
  const { botId } = useParams();
  const navigate = useNavigate();
  const [bot, setBot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('console');
  const [acting, setActing] = useState('');

  const fetchBot = useCallback(async () => {
    setError('');
    try {
      const { data } = await getBotById(botId);
      setBot(data);
    } catch {
      setError('Failed to load bot.');
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    fetchBot();
  }, [fetchBot]);

  async function doAction(action) {
    setActing(action);
    try {
      await api.post(`/bots/${botId}/${action}`);
      await fetchBot();
    } catch (err) {
      alert(err.response?.data?.error || `Failed to ${action} bot.`);
    } finally {
      setActing('');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-950">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="text-gray-500">Loading…</div>
        </main>
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="flex min-h-screen bg-gray-950">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="text-red-400">{error || 'Bot not found.'}</div>
        </main>
      </div>
    );
  }

  const isRunning = bot.status === 'online' || bot.status === 'running';
  const isExpired = bot.status === 'expired';
  const tabs = ['console', 'files', 'environment', 'settings'];

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        {/* Back */}
        <button
          onClick={() => navigate('/bots')}
          className="text-gray-400 hover:text-white text-sm mb-6 inline-flex items-center gap-1 transition-colors"
        >
          ← All Bots
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-indigo-700 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {bot.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{bot.name}</h1>
              <div className="mt-1.5">
                <StatusBadge status={bot.status} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {!isExpired && (
              <button
                onClick={() => doAction('restart')}
                disabled={!!acting}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {acting === 'restart' ? '…' : 'Restart'}
              </button>
            )}
            {isRunning ? (
              <button
                onClick={() => doAction('stop')}
                disabled={!!acting}
                className="px-4 py-2 bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {acting === 'stop' ? '…' : 'Stop'}
              </button>
            ) : (
              !isExpired && (
                <button
                  onClick={() => doAction('start')}
                  disabled={!!acting}
                  className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  {acting === 'start' ? '…' : 'Start'}
                </button>
              )
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'CPU', value: bot.cpu !== undefined ? `${Number(bot.cpu).toFixed(1)}%` : '—' },
            { label: 'Memory', value: bot.memory !== undefined ? `${Number(bot.memory).toFixed(0)} MB` : '—' },
            { label: 'Storage', value: '—' },
            { label: 'Uptime', value: '—' },
            { label: 'Plan', value: bot.plan ? bot.plan.charAt(0).toUpperCase() + bot.plan.slice(1) : '—' },
            { label: 'Expires', value: bot.expires_at ? new Date(bot.expires_at).toLocaleDateString() : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-900 rounded-xl border border-gray-800 px-4 py-3">
              <div className="text-xs text-gray-500 mb-0.5">{label}</div>
              <div className="text-white font-semibold text-sm truncate">{value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-800">
          {tabs.map((t) => (
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

        {/* Tab content */}
        <div>
          {tab === 'console' && <ConsoleTab botId={botId} />}
          {tab === 'files' && <FilesTab botId={botId} />}
          {tab === 'environment' && <EnvTab botId={botId} />}
          {tab === 'settings' && <SettingsTab bot={bot} botId={botId} onUpdate={fetchBot} />}
        </div>
      </main>
    </div>
  );
}
