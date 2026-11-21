import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ConsoleOutput from '../components/ConsoleOutput';
import { createSocket } from '../socket';
import api from '../api';

export default function Console() {
  const { botId } = useParams();
  const navigate = useNavigate();
  const [lines, setLines] = useState([]);
  const [botName, setBotName] = useState('');
  const socketRef = useRef(null);

  // Fetch bot name
  useEffect(() => {
    api.get(`/bots/${botId}`)
      .then(({ data }) => setBotName(data.name))
      .catch(() => {});
  }, [botId]);

  // Socket setup
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

  function handleClear() {
    setLines([]);
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/bots')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-white">
            Console{botName ? ` — ${botName}` : ''}
          </h1>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">
              {lines.length} line{lines.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleClear}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              Clear
            </button>
          </div>
          <ConsoleOutput lines={lines} />
        </div>
      </main>
    </div>
  );
}
