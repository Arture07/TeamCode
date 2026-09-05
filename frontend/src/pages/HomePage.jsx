import React, { useState, useEffect } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import { getAuthHeaders } from "../utils/auth";
import { useTranslation } from "../contexts/LanguageContext";
import LanguageSwitcher from "../components/LanguageSwitcher";

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
  const { t } = useTranslation();
  const [sessionName, setSessionName] = useState('');
  const [sessionPassword, setSessionPassword] = useState('');
  const [createdSession, setCreatedSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mySessions, setMySessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userRole, setUserRole] = useState(() => {
    try {
      const token = localStorage.getItem("jwtToken");
      if (token) {
        return JSON.parse(atob(token.split(".")[1])).role || "ROLE_USER";
      }
    } catch (_) {}
    return "ROLE_USER";
  });

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState(null);
  const [pwdSuccess, setPwdSuccess] = useState(null);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);
    if (newPassword.length < 6) {
      setPwdError(t("settings.passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError(t("settings.passwordsMismatch"));
      return;
    }
    setPwdLoading(true);
    try {
      const token = localStorage.getItem("jwtToken");
      const res = await fetch("/api/users/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setPwdSuccess(t("settings.passwordChangedSuccess"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
      }, 2000);
    } catch (err) {
      setPwdError(err.message || "Erro ao alterar senha");
    } finally {
      setPwdLoading(false);
    }
  };

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

  useEffect(() => { 
    fetchSessions();
    const token = localStorage.getItem("jwtToken");
    if (token) {
      fetch('/api/users/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          if (data.token) localStorage.setItem("jwtToken", data.token);
          if (data.role) setUserRole(data.role);
        }
      })
      .catch(() => {});
    }
  }, []);

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
        body: JSON.stringify({ sessionName, ownerUsername, rawPassword: sessionPassword }),
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

  const handleJoinSession = (publicId, isProtected = false) => {
    let pwd = '';
    if (isProtected) {
      pwd = prompt('Esta sessão é protegida. Digite a senha:');
      if (pwd === null) return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('sessionId', publicId);
    if (pwd) url.searchParams.set('pwd', pwd);
    window.location.href = url.href;
  };

  const filteredSessions = mySessions.filter(s =>
    s.sessionName?.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <>
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('home.deleteSessionTitle')}
        message={t('home.deleteSessionConfirm', { name: deleteTarget?.sessionName })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteTarget(null)}
      />

      {isPasswordModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setIsPasswordModalOpen(false)}
        >
          <div
            className="border-4 p-6 max-w-md w-full neo-shadow-card rounded-2xl relative"
            style={{
              backgroundColor: "var(--panel-bg-color)",
              borderColor: "var(--panel-border-color)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--primary-color)" }}>
                <span className="codicon codicon-key" />
                <span>{t("settings.changePasswordTitle")}</span>
              </h3>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-lg opacity-70 hover:opacity-100 cursor-pointer font-bold px-1"
                style={{ color: "var(--text-color)" }}
              >
                ✕
              </button>
            </div>

            <p className="text-xs mb-4" style={{ color: "var(--text-muted-color)" }}>
              {t("settings.changePasswordHint")}
            </p>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("settings.currentPassword")}
                className="w-full px-3 py-2 border-2 text-sm focus:outline-none"
                style={{
                  backgroundColor: "var(--input-bg-color)",
                  borderColor: "var(--panel-border-color)",
                  color: "var(--text-color)",
                }}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("settings.newPassword")}
                required
                minLength={6}
                className="w-full px-3 py-2 border-2 text-sm focus:outline-none"
                style={{
                  backgroundColor: "var(--input-bg-color)",
                  borderColor: "var(--panel-border-color)",
                  color: "var(--text-color)",
                }}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t("settings.confirmNewPassword")}
                required
                minLength={6}
                className="w-full px-3 py-2 border-2 text-sm focus:outline-none"
                style={{
                  backgroundColor: "var(--input-bg-color)",
                  borderColor: "var(--panel-border-color)",
                  color: "var(--text-color)",
                }}
              />

              {pwdSuccess && (
                <div className="p-2.5 border-2 text-xs text-green-400 bg-green-500/10 border-green-500/30 font-medium">
                  {pwdSuccess}
                </div>
              )}
              {pwdError && (
                <div className="p-2.5 border-2 text-xs text-red-400 bg-red-500/10 border-red-500/30 font-medium">
                  {pwdError}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 py-2 border-2 font-bold text-xs neo-shadow-button"
                  style={{
                    backgroundColor: "var(--panel-bg-color)",
                    borderColor: "var(--panel-border-color)",
                    color: "var(--text-color)",
                  }}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="flex-1 py-2 border-2 font-bold text-xs disabled:opacity-50 neo-shadow-button"
                  style={{
                    backgroundColor: "var(--button-bg-color)",
                    borderColor: "var(--panel-border-color)",
                    color: "var(--button-text-color)",
                  }}
                >
                  {pwdLoading ? t("common.loading") : t("settings.savePasswordBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="min-h-screen flex flex-col p-4 sm:p-6 md:p-8 transition-colors duration-500 overflow-y-auto">
        {/* Responsive Header Bar */}
        <header className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--panel-border-color)]">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = "/"}>
            <span className="text-2xl font-black tracking-tight" style={{ color: "var(--primary-color)" }}>
              CrewCode
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {ThemeSwitcher && <ThemeSwitcher />}
            <LanguageSwitcher variant="dropdown" />
            {userRole === "ROLE_SUPER_ADMIN" && (
              <a
                href="/admin"
                className="px-3 py-1.5 border-2 font-bold neo-shadow-button flex items-center gap-1.5 transition-all text-xs"
                style={{
                  backgroundColor: "rgba(245, 158, 11, 0.15)",
                  borderColor: "rgba(245, 158, 11, 0.5)",
                  color: "rgb(245, 158, 11)",
                }}
                title="Super Admin Console"
              >
                <span className="codicon codicon-shield text-amber-400" />
                <span>{t('home.adminConsole')}</span>
              </a>
            )}
            <button
              onClick={() => {
                setIsPasswordModalOpen(true);
                setPwdError(null);
                setPwdSuccess(null);
              }}
              className="px-3 py-1.5 border-2 font-bold neo-shadow-button flex items-center gap-1.5 transition-all text-xs"
              style={{
                backgroundColor: "var(--panel-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--text-color)",
              }}
              title={t('settings.changePasswordTitle')}
            >
              <span className="codicon codicon-key" />
              <span className="hidden sm:inline">{t('settings.changePasswordTitle')}</span>
            </button>
            <span className="font-bold text-xs sm:text-sm">
              {t('home.helloUser', { username: localStorage.getItem('username') || 'User' })}
            </span>
            <button
              onClick={() => { localStorage.clear(); window.location.href = "/"; }}
              className="px-3.5 py-1.5 border-2 font-bold neo-shadow-button text-xs sm:text-sm"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)', borderColor: 'var(--panel-border-color)' }}
            >
              {t('home.logout')}
            </button>
          </div>
        </header>

        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Create Session Panel */}
          <div
            className="p-6 sm:p-8 space-y-6 border-2 glass-panel neo-shadow md:col-span-1 h-fit"
            style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)' }}
          >
            <div className="text-center">
              <h1 className="text-4xl font-bold" style={{ color: 'var(--primary-color)' }}>CrewCode</h1>
              <p className="mt-2" style={{ color: 'var(--text-muted-color)' }}>{t('home.createSession')}</p>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                placeholder={t('home.sessionNamePlaceholder')}
                className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--input-bg-color)',
                  borderColor: 'var(--panel-border-color)',
                  '--tw-ring-color': 'var(--primary-color)',
                  color: 'var(--text-color)',
                  marginBottom: '1rem'
                }}
              />
              <input
                type="password"
                value={sessionPassword}
                onChange={(e) => setSessionPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                placeholder={t('home.passwordPlaceholder')}
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
                {isLoading ? t('common.loading') : t('home.createBtn')}
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
                <h3 className="font-bold text-green-400 flex items-center gap-1.5">
                  <span className="codicon codicon-check" /> {t('home.sessionCreatedSuccess')}
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted-color)' }}>{t('home.shareLink')}</p>
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
                  className="w-full font-bold py-2 border-2 mt-2 bg-green-600 text-white hover:bg-green-500 transition-colors flex items-center justify-center gap-1.5"
                  style={{ borderColor: 'var(--panel-border-color)' }}
                >
                  <span>{t('home.enterNow')}</span>
                  <span className="codicon codicon-arrow-right" />
                </button>
              </div>
            )}
          </div>

          {/* Sessions List */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-color)' }}>
                {t('home.mySessions')}
                {!loadingSessions && mySessions.length > 0 && (
                  <span className="ml-2 text-sm font-normal opacity-60">({filteredSessions.length}/{mySessions.length})</span>
                )}
              </h2>
              {mySessions.length > 0 && (
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder={t('home.searchPlaceholder')}
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
                {t('home.loadingSessions')}
              </p>
            ) : filteredSessions.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed" style={{ borderColor: 'var(--panel-border-color)' }}>
                {mySessions.length === 0 ? (
                  <>
                    <p style={{ color: 'var(--text-muted-color)' }}>{t('home.noSessionsYet')}</p>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-muted-color)' }}>{t('home.noSessionsFound')}</p>
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
                          title={t('home.deleteSessionTitle')}
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
                        <p className="text-xs opacity-60 mb-3 flex items-center gap-1" style={{ color: 'var(--text-muted-color)' }}>
                          <span className="codicon codicon-history text-[11px]" />
                          <span>{timeAgo(sess.createdAt)}</span>
                        </p>
                      )}
                    </div>
                    <button
                      className="w-full py-2 border-2 font-bold neo-shadow-button text-sm mt-2 flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', color: 'var(--text-color)' }}
                      onClick={(e) => { e.stopPropagation(); handleJoinSession(sess.publicId); }}
                    >
                      <span className="codicon codicon-arrow-right text-xs" />
                      <span>{t('home.joinSession')}</span>
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