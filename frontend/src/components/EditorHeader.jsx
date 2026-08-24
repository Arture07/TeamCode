import React, { useState, useEffect } from "react";
import ThemeSwitcher from "./ThemeSwitcher";
import PomodoroWidget from "./PomodoroWidget";

function EditorHeader({
  sessionId,
  activeView,
  setActiveView,
  participants = [],
  cursors = {},
  stompClient,
  status,
  showPreview,
  setShowPreview,
  resetPanelSizes,
  setTerminalHeight,
  setChatHeight,
  setTerminalMinimized,
  terminalMinimized,
  setShowChat,
  showChat,
  setShowSidebar,
}) {
  const [userRole, setUserRole] = useState(() => {
    try {
      const token = localStorage.getItem("jwtToken");
      if (token) {
        return JSON.parse(atob(token.split(".")[1])).role || "ROLE_USER";
      }
    } catch (_) { }
    return "ROLE_USER";
  });

  const [showParticipantsMenu, setShowParticipantsMenu] = useState(false);

  useEffect(() => {
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
        .catch(() => { });
    }
  }, []);

  return (
    <header
      className="h-[44px] px-3 flex justify-between items-center shrink-0 z-20 border-b-2 editor-page-header select-none"
      style={{
        backgroundColor: "var(--header-bg-color)",
        borderColor: "var(--panel-border-color)",
      }}
    >
      {/* LEFT SECTION: Brand & View Switcher */}
      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => window.location.href = "/"}>
          <span className="font-extrabold text-sm sm:text-base tracking-tight" style={{ color: "var(--primary-color)" }}>
            ⚡<span className="hidden sm:inline ml-1">TeamCode</span>
          </span>
        </div>

        {/* View Mode: Code vs Whiteboard (Icons only on < md, full text on md+) */}
        <div className="flex bg-[var(--input-bg-color)] rounded border p-0.5 text-xs font-semibold" style={{ borderColor: 'var(--panel-border-color)' }}>
          <button
            onClick={() => setActiveView('code')}
            className={`px-1.5 sm:px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${activeView === 'code' ? 'bg-[var(--primary-color)] text-white shadow-sm' : 'text-[var(--text-color)] opacity-80 hover:opacity-100'}`}
            title="Modo Código"
          >
            <span className="codicon codicon-code text-xs"></span>
            <span className="hidden md:inline">Código</span>
          </button>
          <button
            onClick={() => setActiveView('whiteboard')}
            className={`px-1.5 sm:px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${activeView === 'whiteboard' ? 'bg-[var(--primary-color)] text-white shadow-sm' : 'text-[var(--text-color)] opacity-80 hover:opacity-100'}`}
            title="Modo Whiteboard"
          >
            <span className="codicon codicon-paintcan text-xs"></span>
            <span className="hidden md:inline">Whiteboard</span>
          </button>
        </div>

        {/* Super Admin Badge Link (Icon only on mobile, text on md+) */}
        {userRole === "ROLE_SUPER_ADMIN" && (
          <a
            href="/admin"
            className="px-2 sm:px-2.5 py-1 text-xs font-bold rounded border flex items-center gap-1 transition-all hover:scale-105"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              borderColor: "rgba(245, 158, 11, 0.5)",
              color: "rgb(245, 158, 11)",
            }}
            title="Acessar Console Super Admin"
          >
            <span>🛡️</span>
            <span className="hidden lg:inline">Admin</span>
          </a>
        )}
      </div>

      {/* CENTER SECTION: Pomodoro Timer (Visible on md+ or compact) */}
      <div className="hidden md:flex items-center shrink-0">
        <PomodoroWidget
          sessionId={sessionId}
          stompClient={stompClient}
          username={localStorage.getItem("username") || "User"}
        />
      </div>

      {/* RIGHT SECTION: Participants, Tools, Theme & Leave */}
      <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
        {/* Participants Compact Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowParticipantsMenu(prev => !prev)}
            className="px-2 py-1 text-xs font-bold rounded border flex items-center gap-1 transition-colors hover:bg-[var(--input-bg-color)]"
            style={{ borderColor: 'var(--panel-border-color)', color: 'var(--text-color)' }}
            title="Ver Participantes Conectados"
          >
            <span className="codicon codicon-person text-xs text-emerald-500" />
            <span className="text-[11px] font-mono">{participants.length}</span>
          </button>

          {showParticipantsMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowParticipantsMenu(false)} />
              <div
                className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border shadow-xl p-2 z-40 text-xs backdrop-blur-md"
                style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)' }}
              >
                <div className="font-bold pb-1.5 mb-1.5 border-b flex justify-between items-center" style={{ borderColor: 'var(--panel-border-color)' }}>
                  <span>Participantes Conectados</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                    {participants.length} online
                  </span>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {participants.map((p, idx) => {
                    const username = typeof p === 'string' ? p : (p?.username || p?.userId || String(p));
                    const cursorEntry = Object.values(cursors).find(c => c.username === username);
                    const editingFile = cursorEntry?.filePath;
                    const fileBasename = editingFile ? editingFile.split('/').pop() : null;
                    const hue = (idx * 137 + 30) % 360;
                    return (
                      <div key={username} className="flex items-center justify-between p-1 rounded hover:bg-[var(--input-bg-color)]">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            style={{
                              width: 8, height: 8, borderRadius: '50%',
                              backgroundColor: `hsl(${hue}, 70%, 55%)`,
                              flexShrink: 0,
                            }}
                          />
                          <span className="font-medium truncate" style={{ color: "var(--text-color)" }}>{username}</span>
                        </div>
                        {fileBasename && (
                          <span className="text-[10px] italic truncate max-w-[80px] opacity-70" title={`Editando: ${editingFile}`}>
                            {fileBasename}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Theme Switcher */}
        <ThemeSwitcher showFont={false} />

        {/* Action Toggle Buttons (Always visible and never clipped) */}
        <div className="flex items-center space-x-0.5 sm:space-x-1 pl-1 border-l shrink-0" style={{ borderColor: 'var(--panel-border-color)' }}>
          {/* Toggle Preview */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`p-1.5 rounded hover:bg-[var(--input-bg-color)] transition-colors flex items-center justify-center ${showPreview ? "text-[var(--primary-color)]" : "text-[var(--text-color)] opacity-70 hover:opacity-100"}`}
            title={showPreview ? "Ocultar Preview" : "Abrir Preview"}
          >
            <span className="codicon codicon-browser text-sm"></span>
          </button>

          {/* Toggle Terminal */}
          <button
            onClick={() => {
              const newState = !terminalMinimized;
              setTerminalMinimized(newState);
              try {
                localStorage.setItem("teamcode-terminal-minimized", newState ? "1" : "0");
              } catch (_) { }
            }}
            className={`p-1.5 rounded hover:bg-[var(--input-bg-color)] transition-colors flex items-center justify-center ${!terminalMinimized ? "text-[var(--primary-color)]" : "text-[var(--text-color)] opacity-70 hover:opacity-100"}`}
            title={!terminalMinimized ? "Minimizar Terminal" : "Abrir Terminal"}
          >
            <span className="codicon codicon-terminal text-sm"></span>
          </button>

          {/* Toggle Chat */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-1.5 rounded hover:bg-[var(--input-bg-color)] transition-colors flex items-center justify-center ${showChat ? "text-[var(--primary-color)]" : "text-[var(--text-color)] opacity-70 hover:opacity-100"}`}
            title={showChat ? "Ocultar Chat" : "Abrir Chat"}
          >
            <span className="codicon codicon-comment-discussion text-sm"></span>
          </button>

          {/* Reset Layout */}
          <button
            onClick={() => {
              resetPanelSizes();
              setTerminalHeight(240);
              setChatHeight(220);
              setTerminalMinimized(false);
              setShowChat(true);
              setShowSidebar(true);
              try {
                localStorage.setItem("teamcode-terminal-height", "240");
                localStorage.setItem("teamcode-chat-height", "220");
              } catch (_) { }
            }}
            className="p-1.5 rounded hover:bg-[var(--input-bg-color)] text-[var(--text-color)] opacity-70 hover:opacity-100 transition-colors flex items-center justify-center"
            title="Restaurar Painéis"
          >
            <span className="codicon codicon-layout text-sm"></span>
          </button>

          {/* Sair da Sala */}
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors flex items-center justify-center ml-1"
            title="Sair da Sala (Voltar ao Início)"
          >
            <span className="codicon codicon-sign-out text-sm"></span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default EditorHeader;
