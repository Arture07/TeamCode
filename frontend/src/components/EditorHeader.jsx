import React, { useState, useEffect } from "react";
import ThemeSwitcher from "./ThemeSwitcher";
import PomodoroWidget from "./PomodoroWidget";
import ClaimSessionModal from "./ClaimSessionModal";
import { useTranslation } from "../contexts/LanguageContext";

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
  sessionOwner = "",
  onKickUser,
}) {
  const { t } = useTranslation();
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
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [currentOwner, setCurrentOwner] = useState(sessionOwner);
  const myUsername = localStorage.getItem("username") || "User";
  const isGuest = !localStorage.getItem("jwtToken");
  const isOwner = Boolean(currentOwner && currentOwner.toLowerCase() === myUsername.toLowerCase());

  useEffect(() => {
    setCurrentOwner(sessionOwner);
  }, [sessionOwner]);

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
    <>
      <header
        className="h-10 px-2 sm:px-3 border-b-2 flex items-center justify-between select-none relative z-20 flex-shrink-0"
        style={{
          backgroundColor: "var(--header-bg-color)",
          borderColor: "var(--panel-border-color)",
        }}
      >
        {/* LEFT SECTION: Brand, View Navigation, Status */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <div className="flex items-center space-x-1.5 shrink-0">
            <span className="font-mono font-bold text-sm tracking-tight" style={{ color: "var(--primary-color)" }}>
              CrewCode
            </span>
          </div>

          {/* View Switcher Tabs: Code / Whiteboard / Git */}
          <div className="flex items-center space-x-1 pl-2 border-l" style={{ borderColor: 'var(--panel-border-color)' }}>
            <button
              onClick={() => setActiveView('code')}
              className={`px-2 py-0.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${activeView === 'code' ? 'bg-[var(--primary-color)] text-white shadow-sm' : 'hover:bg-[var(--input-bg-color)] opacity-70 hover:opacity-100'}`}
              style={{ color: activeView === 'code' ? '#fff' : 'var(--text-color)' }}
              title={t("header.codeEditor")}
            >
              <span className="codicon codicon-code" />
              <span className="hidden sm:inline">Editor</span>
            </button>

            <button
              onClick={() => setActiveView('whiteboard')}
              className={`px-2 py-0.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${activeView === 'whiteboard' ? 'bg-[var(--primary-color)] text-white shadow-sm' : 'hover:bg-[var(--input-bg-color)] opacity-70 hover:opacity-100'}`}
              style={{ color: activeView === 'whiteboard' ? '#fff' : 'var(--text-color)' }}
              title={t("header.whiteboard")}
            >
              <span className="codicon codicon-edit" />
              <span className="hidden sm:inline">Whiteboard</span>
            </button>

            <button
              onClick={() => setActiveView('git')}
              className={`px-2 py-0.5 text-xs font-bold rounded flex items-center gap-1 transition-colors ${activeView === 'git' ? 'bg-[var(--primary-color)] text-white shadow-sm' : 'hover:bg-[var(--input-bg-color)] opacity-70 hover:opacity-100'}`}
              style={{ color: activeView === 'git' ? '#fff' : 'var(--text-color)' }}
              title={t("header.git")}
            >
              <span className="codicon codicon-source-control" />
              <span className="hidden sm:inline">Git</span>
            </button>
          </div>

          {/* Guest Claim Button (Contextual PLG Banner) */}
          {isGuest && (
            <button
              onClick={() => setShowClaimModal(true)}
              className="px-2 py-0.5 text-xs font-bold rounded flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 hover:brightness-125 transition-all shadow-sm shrink-0 cursor-pointer ml-1 animate-pulse"
              title={t("header.claimRoom")}
            >
              <span className="codicon codicon-save text-xs text-amber-400" />
              <span className="hidden sm:inline">{t("header.claimBtn")}</span>
            </button>
          )}

          {/* Status Indicator */}
          <div className="hidden lg:flex items-center space-x-1 text-xs opacity-75 pl-2 border-l" style={{ borderColor: 'var(--panel-border-color)', color: "var(--text-color)" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: status === "Sincronizado!" ? "#22c55e" : "#ef4444",
                display: "inline-block",
              }}
            />
            <span className="text-[11px] truncate max-w-[120px]">{status}</span>
          </div>
        </div>

      {/* CENTER SECTION: Pomodoro Widget */}
      <div className="hidden md:flex items-center justify-center">
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
            title={t("header.connectedParticipants")}
          >
            <span className="codicon codicon-person text-xs text-emerald-500" />
            <span className="text-[11px] font-mono">{participants.length}</span>
          </button>

          {showParticipantsMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowParticipantsMenu(false)} />
              <div
                className="absolute right-0 top-full mt-1.5 w-64 rounded-lg border shadow-2xl p-2.5 z-40 text-xs backdrop-blur-md animate-fadeIn"
                style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)' }}
              >
                <div className="font-bold pb-1.5 mb-1.5 border-b flex justify-between items-center" style={{ borderColor: 'var(--panel-border-color)' }}>
                  <span>{t("header.connectedParticipants")}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                    {participants.length} {t("common.online")}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {participants.map((p, idx) => {
                    const username = typeof p === 'string' ? p : (p?.username || p?.userId || String(p));
                    const cursorEntry = Object.values(cursors).find(c => c.username === username);
                    const editingFile = cursorEntry?.filePath;
                    const fileBasename = editingFile ? editingFile.split('/').pop() : null;
                    const hue = (idx * 137 + 30) % 360;
                    const isThisUserOwner = Boolean(sessionOwner && sessionOwner.toLowerCase() === username.toLowerCase());
                    const isMe = username.toLowerCase() === myUsername.toLowerCase();

                    return (
                      <div key={username} className="flex items-center justify-between p-1.5 rounded hover:bg-[var(--input-bg-color)] transition-colors group">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            style={{
                              width: 8, height: 8, borderRadius: '50%',
                              backgroundColor: `hsl(${hue}, 70%, 55%)`,
                              flexShrink: 0,
                            }}
                          />
                          <span className="font-medium truncate" style={{ color: "var(--text-color)" }}>{username}</span>
                          {isThisUserOwner && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                              Host
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {fileBasename && (
                            <span className="text-[10px] italic truncate max-w-[70px] opacity-70" title={t("header.editing", { file: editingFile })}>
                              {fileBasename}
                            </span>
                          )}
                          {isOwner && !isMe && (
                            <button
                              onClick={() => {
                                if (window.confirm(t("header.confirmRemoveUser", { username }))) {
                                  if (onKickUser) onKickUser(username);
                                }
                              }}
                              className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                              title={t("header.removeUserFromRoom", { username })}
                            >
                              <span className="codicon codicon-close text-[11px]" />
                            </button>
                          )}
                        </div>
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
            title={showPreview ? t("header.hidePreview") : t("header.openPreview")}
          >
            <span className="codicon codicon-browser text-sm"></span>
          </button>

          {/* Toggle Terminal */}
          <button
            onClick={() => {
              const newState = !terminalMinimized;
              setTerminalMinimized(newState);
              try {
                localStorage.setItem("codesync-terminal-minimized", newState ? "1" : "0");
              } catch (_) { }
            }}
            className={`p-1.5 rounded hover:bg-[var(--input-bg-color)] transition-colors flex items-center justify-center ${!terminalMinimized ? "text-[var(--primary-color)]" : "text-[var(--text-color)] opacity-70 hover:opacity-100"}`}
            title={!terminalMinimized ? t("header.minimizeTerminal") : t("header.openTerminal")}
          >
            <span className="codicon codicon-terminal text-sm"></span>
          </button>

          {/* Toggle Chat */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-1.5 rounded hover:bg-[var(--input-bg-color)] transition-colors flex items-center justify-center ${showChat ? "text-[var(--primary-color)]" : "text-[var(--text-color)] opacity-70 hover:opacity-100"}`}
            title={showChat ? t("header.hideChat") : t("header.openChat")}
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
                localStorage.setItem("codesync-terminal-height", "240");
                localStorage.setItem("codesync-chat-height", "220");
              } catch (_) { }
            }}
            className="p-1.5 rounded hover:bg-[var(--input-bg-color)] text-[var(--text-color)] opacity-70 hover:opacity-100 transition-colors flex items-center justify-center"
            title={t("header.resetPanels")}
          >
            <span className="codicon codicon-layout text-sm"></span>
          </button>

          {/* Sair da Sala */}
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors flex items-center justify-center ml-1"
            title={t("header.leaveRoom")}
          >
            <span className="codicon codicon-sign-out text-sm"></span>
          </button>
        </div>
      </div>
    </header>

    <ClaimSessionModal
      isOpen={showClaimModal}
      onClose={() => setShowClaimModal(false)}
      sessionId={sessionId}
      onClaimed={(newOwner) => {
        setCurrentOwner(newOwner);
      }}
    />
  </>
  );
}

export default EditorHeader;
