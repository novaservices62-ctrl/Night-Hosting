import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api';

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
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [node.path]: !c[node.path] }))
                }
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                className="w-full text-left flex items-center gap-1.5 py-1 px-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded text-sm transition-colors"
              >
                <span>{collapsed[node.path] ? '▶' : '▼'}</span>
                <span>📁</span>
                <span>{node.name}</span>
              </button>
              {!collapsed[node.path] && node.children && (
                <FileTree
                  nodes={node.children}
                  onSelect={onSelect}
                  selectedPath={selectedPath}
                  depth={depth + 1}
                />
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

export default function FileManager() {
  const { botId } = useParams();
  const navigate = useNavigate();
  const [tree, setTree] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [toast, setToast] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [botName, setBotName] = useState('');

  useEffect(() => {
    api.get(`/bots/${botId}`)
      .then(({ data }) => setBotName(data.name))
      .catch(() => {});
  }, [botId]);

  const fetchTree = useCallback(async () => {
    try {
      const { data } = await api.get(`/files/${botId}/files`);
      setTree(Array.isArray(data) ? data : data.files || []);
    } catch {
      showToast('Failed to load file tree.', 'error');
    }
  }, [botId]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  async function handleSelectFile(node) {
    setSelectedFile(node);
    setLoadingContent(true);
    setContent('');
    try {
      const { data } = await api.get(`/files/${botId}/files/content`, {
        params: { path: node.path },
      });
      const text = typeof data === 'string' ? data : data.content || '';
      setContent(text);
      setOriginalContent(text);
    } catch {
      showToast('Failed to load file content.', 'error');
    } finally {
      setLoadingContent(false);
    }
  }

  async function handleSave() {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await api.put(`/files/${botId}/files/content`, {
        path: selectedFile.path,
        content,
      });
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
      fetchTree();
    } catch {
      showToast('Failed to delete file.', 'error');
    }
  }

  function showToast(msg, type) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const isDirty = content !== originalContent;

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 flex flex-col p-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/bots')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-white">
            Files{botName ? ` — ${botName}` : ''}
          </h1>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
              toast.type === 'success'
                ? 'bg-green-800 text-green-200 border border-green-600'
                : 'bg-red-800 text-red-200 border border-red-600'
            }`}
          >
            {toast.msg}
          </div>
        )}

        <div className="flex flex-1 gap-5 min-h-0">
          {/* Left: file tree */}
          <div className="w-64 bg-gray-900 rounded-xl border border-gray-800 p-3 overflow-y-auto flex-shrink-0">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 px-2">Files</div>
            {tree.length === 0 ? (
              <div className="text-gray-600 text-sm px-2">No files found.</div>
            ) : (
              <FileTree
                nodes={tree}
                onSelect={handleSelectFile}
                selectedPath={selectedFile?.path}
              />
            )}
          </div>

          {/* Right: editor */}
          <div className="flex-1 flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            {selectedFile ? (
              <>
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-gray-300">{selectedFile.path}</span>
                    {isDirty && (
                      <span className="w-2 h-2 rounded-full bg-yellow-400" title="Unsaved changes" />
                    )}
                  </div>
                  <div className="flex gap-2">
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
                  <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                    Loading…
                  </div>
                ) : (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    spellCheck={false}
                    className="flex-1 w-full bg-gray-950 text-gray-200 font-mono text-sm p-5 resize-none focus:outline-none border-0"
                    style={{ minHeight: 0 }}
                  />
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                Select a file to edit
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
