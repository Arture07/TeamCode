// frontend/src/components/ConfirmDialog.jsx
import React from 'react';

export default function ConfirmDialog({ open, title = 'Confirmar', message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="p-6 w-full max-w-md space-y-4 border-2 glass-panel neo-shadow" style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)', color: 'var(--text-color)'}}>
        <h2 className="text-xl font-bold" style={{ color: 'var(--primary-color)' }}>{title}</h2>
        <p className="text-sm" style={{ color: 'var(--text-muted-color)' }}>{message}</p>
        <div className="flex justify-end space-x-3 pt-2">
          <button onClick={onCancel} className="px-4 py-2 font-bold border-2 neo-shadow-button" style={{ borderColor: 'var(--panel-border-color)'}}>{cancelLabel}</button>
          <button onClick={onConfirm} className="px-6 py-2 font-bold border-2 neo-shadow-button" style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)', borderColor: 'var(--panel-border-color)'}}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
