import React, { useState, useEffect } from "react";
import ThemeSwitcher from "./ThemeSwitcher";
import PomodoroWidget from "./PomodoroWidget";

function EditorHeader({
  sessionId,
  activeView,
  setActiveView,
  participants,
  cursors,
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
    } catch (_) {}
    return "ROLE_USER";
  });

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
      .catch(() => {});
    }
  }, []);

  return (
    <header
      className="p-3 flex justify-between items-center shrink-0 z-10 border-b-2 editor-page-header"
      style={{
        backgroundColor: "var(--header-bg-color)",
        borderColor: "var(--panel-border-color)",
      }}
    >
      <div>
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--primary-color)" }}
        >
          TeamCode
        </h1>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex bg-[var(--input-bg-color)] rounded-md p-1 border" style={{ borderColor: 'var(--panel-border-color)' }}>
          <button
            onClick={() => setActiveView('code')}
            className={`px-3 py-1 rounded-sm text-sm font-bold ${activeView === 'code' ? 'bg-[var(--primary-color)] text-white' : 'text-[var(--text-color)]'}`}
          >
            Código
          </button>
          <button
            onClick={() => setActiveView('whiteboard')}
            className={`px-3 py-1 rounded-sm text-sm font-bold flex items-center gap-2 ${activeView === 'whiteboard' ? 'bg-[var(--primary-color)] text-white' : 'text-[var(--text-color)]'}`}
          >
            <span className="codicon codicon-paintcan"></span> Whiteboard
          </button>
        </div>
        {userRole === "ROLE_SUPER_ADMIN" && (
          <a
            href="/admin"
            className="px-3 py-1 text-sm border-2 font-bold neo-shadow-button flex items-center gap-1.5 transition-all"
            style={{
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              borderColor: "rgba(245, 158, 11, 0.5)",
              color: "rgb(245, 158, 11)",
            }}
            title="Console Super Admin"
          >
            <span>🛡️ Admin</span>
          </a>
        )}
        <ThemeSwitcher showFont={true} />
        <button
          onClick={() => {
            localStorage.removeItem("jwtToken");
            window.location.href = "/";
          }}
          className="px-3 py-1 text-sm border-2 font-bold neo-shadow-button hover:bg-red-500 hover:text-white"
          style={{
            borderColor: "var(--panel-border-color)",
            color: "var(--text-color)",
          }}
        >
          Logout
        </button>
        <div className="text-right relative group/participants">
          <h3 className="font-bold flex items-center gap-1.5 justify-end">
            <span className="codicon codicon-person" style={{ fontSize: 14 }} />
            Participantes ({participants.length})
          </h3>
          <div className="text-xs space-y-0.5 mt-0.5">
            {participants.map((p, idx) => {
              const username = typeof p === 'string' ? p : (p?.username || p?.userId || String(p));
              const cursorEntry = Object.values(cursors).find(c => c.username === username);
              const editingFile = cursorEntry?.filePath;
              const fileBasename = editingFile ? editingFile.split('/').pop() : null;
              const hue = (idx * 137 + 30) % 360;
              return (
                <div key={username} className="flex items-center justify-end gap-1.5" title={editingFile ? `Editando: ${editingFile}` : username}>
                  <span className="truncate max-w-[100px]" style={{ color: "var(--text-muted-color)" }}>
                    {fileBasename ? (
                      <span className="italic opacity-70">{fileBasename}</span>
                    ) : null}
                  </span>
                  <span className="font-semibold" style={{ color: "var(--text-color)" }}>{username}</span>
                  <span
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      backgroundColor: `hsl(${hue}, 70%, 55%)`,
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <PomodoroWidget
          sessionId={sessionId}
          stompClient={stompClient}
          username={localStorage.getItem("username") || "User"}
        />

        <div
          className="text-sm font-bold px-3 py-1 border-2"
          style={{
            backgroundColor: "var(--input-bg-color)",
            borderColor: "var(--panel-border-color)",
            color: "var(--text-color)",
          }}
        >
          Status: {status}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`p-2 rounded hover:bg-[var(--input-bg-color)] transition-colors ${showPreview ? "text-[var(--primary-color)]" : ""}`}
            title="Toggle Preview"
            style={{
              color: showPreview
                ? "var(--primary-color)"
                : "var(--text-color)",
            }}
          >
            <span className="codicon codicon-browser text-lg"></span>
          </button>

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
            className="p-2 rounded hover:bg-[var(--input-bg-color)] transition-colors"
            title="Restaurar Layout"
            style={{ color: "var(--text-color)" }}
          >
            <span className="codicon codicon-layout text-lg"></span>
          </button>

          <button
            onClick={() => {
              const newState = !terminalMinimized;
              setTerminalMinimized(newState);
              try {
                localStorage.setItem(
                  "teamcode-terminal-minimized",
                  newState ? "1" : "0",
                );
              } catch (_) { }
            }}
            className={`p-2 rounded hover:bg-[var(--input-bg-color)] transition-colors ${!terminalMinimized ? "text-[var(--primary-color)]" : ""}`}
            title="Toggle Terminal"
            style={{
              color: !terminalMinimized
                ? "var(--primary-color)"
                : "var(--text-color)",
            }}
          >
            <span className="codicon codicon-terminal text-lg"></span>
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded hover:bg-[var(--input-bg-color)] transition-colors ${showChat ? "text-[var(--primary-color)]" : ""}`}
            title="Toggle Chat"
            style={{
              color: showChat
                ? "var(--primary-color)"
                : "var(--text-color)",
            }}
          >
            <span className="codicon codicon-comment-discussion text-lg"></span>
          </button>

          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="p-2 rounded hover:bg-red-500/20 text-red-500 transition-colors flex items-center gap-1"
            title="Sair da sala"
          >
            <span className="codicon codicon-sign-out text-lg"></span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default EditorHeader;
