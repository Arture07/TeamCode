import React, { useState } from 'react';

export default function ClaimSessionModal({ isOpen, onClose, sessionId, onClaimed }) {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      let token = localStorage.getItem('jwtToken');
      let currentUsername = username;

      // 1. If not authenticated, authenticate first
      if (!token) {
        const endpoint = isLoginTab ? '/api/users/login' : '/api/users/register';
        const payload = isLoginTab
          ? { username, password }
          : { username, password, email: email || `${username}@example.com` };

        const authRes = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!authRes.ok) {
          const errData = await authRes.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || (isLoginTab ? 'Falha ao autenticar' : 'Falha ao cadastrar'));
        }

        const authData = await authRes.json();
        token = authData.token || authData.jwt;
        if (!token) throw new Error('Token de autenticação não retornado pelo servidor.');

        localStorage.setItem('jwtToken', token);
        localStorage.setItem('username', authData.username || username);
        currentUsername = authData.username || username;
      }

      // 2. Claim the session to transfer ownership
      const claimRes = await fetch(`/api/sessions/${sessionId}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!claimRes.ok) {
        const claimErr = await claimRes.json().catch(() => ({}));
        throw new Error(claimErr.message || claimErr.error || 'Falha ao vincular a sala à sua conta.');
      }

      setSuccessMsg('Sala salva com sucesso na sua conta! Agora ela é permanente.');
      if (onClaimed) onClaimed(currentUsername);

      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1500);

    } catch (err) {
      setError(err.message || 'Ocorreu um erro ao processar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-md rounded-2xl border-2 shadow-2xl p-6 relative overflow-hidden"
        style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)', color: 'var(--text-color)' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-lg opacity-60 hover:opacity-100 transition-opacity p-1"
        >
          <span className="codicon codicon-close" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl shrink-0">
            <span className="codicon codicon-save" />
          </div>
          <div>
            <h3 className="text-base font-bold">Salvar Sala na Sua Conta</h3>
            <p className="text-xs opacity-75">Torne este projeto permanente e acesse pelo Dashboard</p>
          </div>
        </div>

        {/* Guest Benefits Highlight */}
        <div className="mb-5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-1.5">
          <div className="font-bold text-amber-400 flex items-center gap-1.5">
            <span className="codicon codicon-shield text-xs" />
            <span>Vantagens da Conta Gratuita:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 opacity-90 text-[11px]">
            <li>Sua sala nunca expira após 24 horas</li>
            <li>Cota expandida de IA (200 mensagens diárias)</li>
            <li>Até 5 abas simultâneas de Terminal</li>
            <li>Sincronização com GitHub / GitLab (Git Push & Pull)</li>
          </ul>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-4 text-xs font-bold" style={{ borderColor: 'var(--panel-border-color)' }}>
          <button
            onClick={() => { setIsLoginTab(true); setError(''); }}
            className={`flex-1 py-2 text-center transition-colors border-b-2 ${isLoginTab ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
          >
            Entrar em Conta Existente
          </button>
          <button
            onClick={() => { setIsLoginTab(false); setError(''); }}
            className={`flex-1 py-2 text-center transition-colors border-b-2 ${!isLoginTab ? 'border-[var(--primary-color)] text-[var(--primary-color)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
          >
            Criar Conta Gratuita
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <span className="codicon codicon-error" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <span className="codicon codicon-check" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">Nome de Usuário</label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="seu_usuario"
              className="w-full p-2.5 border-2 rounded-lg text-xs outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', color: 'var(--text-color)' }}
            />
          </div>

          {!isLoginTab && (
            <div>
              <label className="block text-xs font-semibold mb-1 opacity-80">E-mail (opcional)</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full p-2.5 border-2 rounded-lg text-xs outline-none focus:ring-2"
                style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', color: 'var(--text-color)' }}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1 opacity-80">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-2.5 border-2 rounded-lg text-xs outline-none focus:ring-2"
              style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', color: 'var(--text-color)' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-2 bg-[var(--primary-color)] hover:brightness-110 text-white font-bold text-xs rounded-lg shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading && <span className="codicon codicon-loading codicon-modifier-spin" />}
            <span>{isLoginTab ? 'Entrar & Salvar Sala' : 'Criar Conta & Salvar Sala'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
