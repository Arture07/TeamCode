import React, { useState, useEffect } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import { getAuthHeaders } from "../utils/auth";

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `há ${Math.floor(diff / 86400)} dias`;
  return `há ${Math.floor(diff / 2592000)} meses`;
}

export default function HomePage({ ThemeSwitcher }) {
  const [sessionName, setSessionName] = useState('');
  const [createdSession, setCreatedSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mySessions, setMySessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchSessions = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) return;
      const res = await fetch(`/api/sessions?ownerUsername=${encodeURIComponent(username)}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMySessions(data);
      }
    } catch (e) {
      // Silently fail — sessions will appear empty
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      setError('Por favor, insira um nome para a sessão.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setCreatedSession(null);
    try {
      const ownerUsername = localStorage.getItem('username') || 'User';
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sessionName, ownerUsername }),
      });
      if (!res.ok) throw new Error(`Erro na API (${res.status})`);
      const data = await res.json();
      setCreatedSession(data);
      setSessionName('');
      fetchSessions();
    } catch (err) {
      setError('Não foi possível conectar ao serviço de sessão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/sessions/${deleteTarget.publicId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      setMySessions(prev => prev.filter(s => s.publicId !== deleteTarget.publicId));
    } catch (e) {
      // Silently fail
    } finally {
      setDeleteTarget(null);
    }
  };

  const getEditorLink = () => {
    if (!createdSession) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('sessionId', createdSession.publicId);
    return url.href;
  };

  const handleJoinSession = (publicId) => {
    const url = new URL(window.location.href);
    url.searchParams.set('sessionId', publicId);
    window.location.href = url.href;
  };

  const filteredSessions = mySessions.filter(s =>
    s.sessionName?.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Deletar sessão"
        message={`Tem certeza que deseja deletar a sessão "${deleteTarget?.sessionName}"? Todos os arquivos serão perdidos.`}
        confirmLabel="Deletar"
        cancelLabel="Cancelar"
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="min-h-screen flex flex-col p-8 transition-colors duration-500 overflow-y-auto">
        <div className="absolute top-6 right-6 flex items-center space-x-4 z-10">
          {ThemeSwitcher && <ThemeSwitcher />}
          <span className="font-bold">
            Olá, {localStorage.getItem('username') || 'User'}!
          </span>
          <button
            onClick={() => { localStorage.clear(); window.location.href = "/"; }}
            className="px-4 py-2 border-2 font-bold neo-shadow-button"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)', borderColor: 'var(--panel-border-color)' }}
          >
            Logout
          </button>
        </div>

        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {/* Create Session Panel */}
          <div
            className="p-8 space-y-6 border-2 glass-panel neo-shadow md:col-span-1 h-fit"
            style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)' }}
          >
            <div className="text-center">
              <h1 className="text-4xl font-bold" style={{ color: 'var(--primary-color)' }}>TeamCode</h1>
              <p className="mt-2" style={{ color: 'var(--text-muted-color)' }}>Crie uma sala colaborativa</p>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                placeholder="Nome do projeto..."
                className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--input-bg-color)',
                  borderColor: 'var(--panel-border-color)',
                  '--tw-ring-color': 'var(--primary-color)',
                  color: 'var(--text-color)',
                }}
              />
              <button
                onClick={handleCreateSession}
                disabled={isLoading}
                className="w-full font-bold py-3 border-2 disabled:opacity-50 neo-shadow-button"
                style={{
                  backgroundColor: 'var(--button-bg-color)',
                  color: 'var(--button-text-color)',
                  borderColor: 'var(--panel-border-color)',
                }}
              >
                {isLoading ? 'Criando...' : '+ Criar Sessão'}
              </button>
            </div>
            {error && (
              <div className="p-3 border-2" style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.5)',
                color: 'rgb(252, 165, 165)',
              }}>
                {error}
              </div>
            )}
            {createdSession && (
              <div className="p-4 border-2 space-y-2" style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderColor: 'rgba(34, 197, 94, 0.5)',
              }}>
                <h3 className="font-bold text-green-400">✓ Sessão criada!</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted-color)' }}>Compartilhe este link:</p>
                <input
                  type="text"
                  readOnly
                  value={getEditorLink()}
                  onClick={(e) => e.target.select()}
                  className="w-full p-2 border-2 text-xs font-mono cursor-pointer"
                  style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)' }}
                />
                <button
                  onClick={() => handleJoinSession(createdSession.publicId)}
                  className="w-full font-bold py-2 border-2 mt-2 bg-green-600 text-white hover:bg-green-500 transition-colors"
                  style={{ borderColor: 'var(--panel-border-color)' }}
                >
                  Entrar Agora →
                </button>
              </div>
            )}
          </div>

          {/* Sessions List */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-color)' }}>
                Meus Projetos
                {!loadingSessions && mySessions.length > 0 && (
                  <span className="ml-2 text-sm font-normal opacity-60">({filteredSessions.length}/{mySessions.length})</span>
                )}
              </h2>
              {mySessions.length > 0 && (
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="🔍 Filtrar por nome..."
                  className="px-3 py-2 border-2 focus:outline-none focus:ring-2 text-sm"
                  style={{
                    backgroundColor: 'var(--input-bg-color)',
                    borderColor: 'var(--panel-border-color)',
                    '--tw-ring-color': 'var(--primary-color)',
                    color: 'var(--text-color)',
                    maxWidth: '220px',
                  }}
                />
              )}
            </div>

            {loadingSessions ? (
              <p style={{ color: 'var(--text-muted-color)' }}>
                <span className="codicon codicon-loading codicon-modifier-spin mr-2" />
                Carregando sessões...
              </p>
            ) : filteredSessions.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed" style={{ borderColor: 'var(--panel-border-color)' }}>
                {mySessions.length === 0 ? (
                  <>
                    <p style={{ color: 'var(--text-muted-color)' }}>Você ainda não tem nenhuma sessão.</p>
                    <p className="text-sm mt-2 opacity-70">Crie um projeto ao lado para começar.</p>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-muted-color)' }}>Nenhuma sessão encontrada para "{filterQuery}".</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredSessions.map((sess) => (
                  <div
                    key={sess.publicId}
                    className="p-4 border-2 hover:-translate-y-1 transition-transform cursor-pointer neo-shadow flex flex-col justify-between group"
                    style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)' }}
                    onClick={() => handleJoinSession(sess.publicId)}
                  >
                    <div>
                      <div className="flex items-start justify-between mb-1 gap-2">
                        <h3 className="font-bold text-lg truncate leading-tight" style={{ color: 'var(--primary-color)' }}>
                          {sess.sessionName}
                        </h3>
                        <button
                          title="Deletar sessão"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget({ publicId: sess.publicId, sessionName: sess.sessionName }); }}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 text-red-400"
                        >
                          <span className="codicon codicon-trash" style={{ fontSize: 14 }} />
                        </button>
                      </div>
                      <p className="text-xs font-mono mb-1 truncate" style={{ color: 'var(--text-muted-color)' }}>
                        ID: {sess.publicId}
                      </p>
                      {sess.createdAt && (
                        <p className="text-xs opacity-60 mb-3" style={{ color: 'var(--text-muted-color)' }}>
                          🕒 {timeAgo(sess.createdAt)}
                        </p>
                      )}
                    </div>
                    <button
                      className="w-full py-2 border-2 font-bold neo-shadow-button text-sm mt-2"
                      style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', color: 'var(--text-color)' }}
                      onClick={(e) => { e.stopPropagation(); handleJoinSession(sess.publicId); }}
                    >
                      → Entrar na Sessão
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
