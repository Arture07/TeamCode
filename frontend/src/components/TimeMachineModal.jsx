import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '../utils/auth';
import { DiffEditor } from '@monaco-editor/react';

export default function TimeMachineModal({ isOpen, onClose, sessionId, activeFile, currentContent, onRestore }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  useEffect(() => {
    if (isOpen && activeFile) {
      fetchHistory();
    }
  }, [isOpen, activeFile]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tree/${sessionId}/history?path=${encodeURIComponent(activeFile)}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
        if (data.length > 0) {
          setSelectedSnapshot(data[0]);
        }
      }
    } catch (e) {
      console.error("Erro ao buscar histórico", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSnapshot = async () => {
    try {
      await fetch(`/api/tree/${sessionId}/snapshot`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          path: activeFile,
          content: currentContent,
          username: localStorage.getItem('username') || 'User'
        })
      });
      fetchHistory();
    } catch (e) {
      console.error("Erro ao salvar snapshot", e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div
        className="w-full max-w-5xl h-[85vh] flex flex-col border-2 neo-shadow"
        style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)' }}
      >
        <div className="flex justify-between items-center p-4 border-b-2" style={{ borderColor: 'var(--panel-border-color)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-color)' }}>
            <span className="codicon codicon-history mr-2" />
            Time Machine: {activeFile}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={handleSnapshot}
              className="px-4 py-1 text-sm font-bold border-2 bg-blue-500 text-white neo-shadow-button"
              style={{ borderColor: 'var(--panel-border-color)' }}
            >
              Criar Snapshot Agora
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 font-bold border-2 neo-shadow-button"
              style={{ borderColor: 'var(--panel-border-color)', color: 'var(--text-color)', backgroundColor: 'var(--input-bg-color)' }}
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* History List */}
          <div className="w-1/4 border-r-2 overflow-y-auto" style={{ borderColor: 'var(--panel-border-color)' }}>
            {loading ? (
              <div className="p-4 text-center">Carregando...</div>
            ) : history.length === 0 ? (
              <div className="p-4 text-center text-sm opacity-60">Nenhum snapshot encontrado.</div>
            ) : (
              history.map((snap) => (
                <div
                  key={snap.id}
                  onClick={() => setSelectedSnapshot(snap)}
                  className={`p-3 cursor-pointer border-b border-opacity-20 flex flex-col hover:bg-black/10 transition-colors ${selectedSnapshot?.id === snap.id ? 'bg-black/10 font-bold' : ''}`}
                >
                  <span className="text-sm">{new Date(snap.createdAt).toLocaleString()}</span>
                  <span className="text-xs opacity-60">Por: {snap.createdBy || 'Sistema'}</span>
                </div>
              ))
            )}
          </div>

          {/* Diff Editor */}
          <div className="w-3/4 flex flex-col bg-[#1e1e1e]">
            {selectedSnapshot ? (
              <>
                <div className="p-2 bg-[#2d2d2d] text-white text-xs flex justify-between items-center">
                  <span>Esquerda: Snapshot ({new Date(selectedSnapshot.createdAt).toLocaleTimeString()}) | Direita: Atual</span>
                  <button
                    onClick={() => { onRestore(selectedSnapshot.content); onClose(); }}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 font-bold text-white rounded-sm"
                  >
                    Reverter para este Snapshot
                  </button>
                </div>
                <DiffEditor
                  height="100%"
                  original={selectedSnapshot.content}
                  modified={currentContent}
                  language={activeFile.split('.').pop()}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false }
                  }}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-white/50">
                Selecione um snapshot para comparar
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
