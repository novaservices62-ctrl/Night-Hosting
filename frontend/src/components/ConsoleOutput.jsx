import React, { useEffect, useRef } from 'react';

export default function ConsoleOutput({ lines }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="bg-black text-green-400 font-mono text-sm p-4 rounded overflow-y-auto h-96 border border-gray-700">
      {lines.length === 0 && (
        <div className="text-gray-600 italic">No output yet…</div>
      )}
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre-wrap break-all leading-5">
          {line}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
