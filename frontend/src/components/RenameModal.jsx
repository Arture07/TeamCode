// frontend/src/components/RenameModal.jsx
import React, { useEffect, useState } from 'react';

export default function RenameModal({ open, initialPath, onClose, onSubmit }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      const base = (initialPath || '').split('/').pop();
      setName(base || '');
    }
  }, [open, initialPath]);

  if (!open) return null;
  const parent = initialPath && initialPath.includes('/') ? initialPath.substring(0, initialPath.lastIndexOf('/')) : '';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="p-6 w-full max-w-md space-y-4 border-2 glass-panel neo-shadow" style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)', color: 'var(--text-color)'}}>
        <h2 className="text-xl font-bold" style={{ color: 'var(--primary-color)' }}>Renomear</h2>
        <div>
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted-color)' }}>{parent ? parent + '/' : ''}</div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2"
            style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', '--tw-ring-color': 'var(--primary-color)', color: 'var(--text-color)'}}
            onKeyDown={(e) => { if (e.key === 'Enter') onSubmit && onSubmit(name); if (e.key === 'Escape') onClose && onClose(); }}
          />
        </div>
        <div className="flex justify-end space-x-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 font-bold border-2 neo-shadow-button" style={{ borderColor: 'var(--panel-border-color)'}}>Cancelar</button>
          <button onClick={() => onSubmit && onSubmit(name)} className="px-6 py-2 font-bold border-2 neo-shadow-button" style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)', borderColor: 'var(--panel-border-color)'}}>Renomear</button>
        </div>
      </div>
    </div>
  );
}
