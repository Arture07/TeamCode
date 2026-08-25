import React, { useState, useRef, useEffect } from "react";
import TerminalComponent from "./TerminalComponent";
import DebugConsole from "./DebugConsole";

const TERMINAL_COLORS = [
  { name: "Padrão", value: "" },
  { name: "Verde", value: "#34d399" },
  { name: "Azul", value: "#38bdf8" },
  { name: "Roxo", value: "#a78bfa" },
  { name: "Âmbar", value: "#fbbf24" },
  { name: "Vermelho", value: "#f87171" },
  { name: "Ciano", value: "#22d3ee" },
];

const TERMINAL_ICONS = [
  { name: "Terminal", icon: "codicon-terminal" },
  { name: "Código", icon: "codicon-code" },
  { name: "Servidor", icon: "codicon-server-process" },
  { name: "IA / Agente", icon: "codicon-sparkle" },
  { name: "Depurador", icon: "codicon-bug" },
  { name: "Bash / Script", icon: "codicon-file-binary" },
];

function TerminalPanel({
  terminalMinimized,
  terminalHeight,
  setTerminalHeight,
  activeTerminalTab,
  setActiveTerminalTab,
  terminalApiRef,
  terminalBufferRef,
  setTerminalOutput,
  setProblems,
  sessionId,
  stompClient,
  terminalOutput,
  problems,
  debugLogs = [],
  onClearDebugLogs,
  debugScope = {},
  onEvaluateDebug,
  editorRef,
  setTerminalMinimized,
}) {
  const [terminals, setTerminals] = useState([
    { id: "main", name: "Terminal 1", isAi: false, color: "", icon: "codicon-terminal" },
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState("main");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [contextMenu, setContextMenu] = useState(null); // { visible, x, y, termId, submenu }
  const apisRef = useRef({});
  const containerRef = useRef(null);

  // Ensure active terminal API is mirrored to parent terminalApiRef
  useEffect(() => {
    if (apisRef.current[activeTerminalId]) {
      terminalApiRef.current = apisRef.current[activeTerminalId];
    }
  }, [activeTerminalId, terminalApiRef]);

  // Global listener to close context menu
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (contextMenu && !e.target.closest("#terminal-context-menu")) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setEditingId(null);
      }
      // F2 to rename active terminal
      if (e.key === "F2" && activeTerminalTab === "TERMINAL" && !editingId) {
        const activeTerm = terminals.find((t) => t.id === activeTerminalId);
        if (activeTerm) {
          e.preventDefault();
          startEditing(activeTerm);
        }
      }
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("contextmenu", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("contextmenu", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu, activeTerminalTab, activeTerminalId, editingId, terminals]);

  const handleAddTerminal = (isAi = false, customName = null) => {
    const newId = isAi ? "ai" : `term_${Date.now().toString(36)}`;
    const exists = terminals.find((t) => t.id === newId);
    if (exists) {
      setActiveTerminalId(newId);
      return;
    }
    const name = customName || (isAi ? "Agente IA" : `Terminal ${terminals.length + 1}`);
    const icon = isAi ? "codicon-sparkle" : "codicon-terminal";
    setTerminals((prev) => [...prev, { id: newId, name, isAi, color: "", icon }]);
    setActiveTerminalId(newId);
  };

  const handleCloseTerminal = (idToClose, e) => {
    e?.stopPropagation();
    if (stompClient?.connected) {
      try {
        stompClient.publish({
          destination: `/app/terminal/${sessionId}/close`,
          body: JSON.stringify({ terminalId: idToClose }),
        });
      } catch (err) {
        console.error("Erro ao fechar processo de terminal:", err);
      }
    }

    delete apisRef.current[idToClose];
    const remaining = terminals.filter((t) => t.id !== idToClose);
    if (remaining.length === 0) {
      setTerminals([{ id: "main", name: "Terminal 1", isAi: false, color: "", icon: "codicon-terminal" }]);
      setActiveTerminalId("main");
    } else {
      setTerminals(remaining);
      if (activeTerminalId === idToClose) {
        setActiveTerminalId(remaining[remaining.length - 1].id);
      }
    }
    setContextMenu(null);
  };

  const handleRestartTerminal = (idToRestart) => {
    const api = apisRef.current[idToRestart];
    if (api && typeof api.restart === "function") {
      api.restart();
    } else if (stompClient?.connected) {
      try {
        stompClient.publish({
          destination: `/app/terminal/${sessionId}/restart`,
          body: JSON.stringify({ terminalId: idToRestart, cols: 80, rows: 24 }),
        });
      } catch (_) {}
    }
    setContextMenu(null);
  };

  const handleClearTerminal = (idToClear) => {
    const api = apisRef.current[idToClear];
    if (api && typeof api.clear === "function") {
      api.clear();
    }
    setContextMenu(null);
  };

  const handleChangeColor = (termId, color) => {
    setTerminals((prev) =>
      prev.map((t) => (t.id === termId ? { ...t, color } : t))
    );
    setContextMenu(null);
  };

  const handleChangeIcon = (termId, icon) => {
    setTerminals((prev) =>
      prev.map((t) => (t.id === termId ? { ...t, icon } : t))
    );
    setContextMenu(null);
  };

  const startEditing = (term, e) => {
    e?.stopPropagation();
    setEditingId(term.id);
    setEditingName(term.name);
    setContextMenu(null);
  };

  const saveEditing = (id) => {
    if (editingName.trim()) {
      setTerminals((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, name: editingName.trim() } : t
        )
      );
    }
    setEditingId(null);
  };

  const handleTabContextMenu = (e, term) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveTerminalId(term.id);

    const x = Math.min(e.clientX, window.innerWidth - 240);
    const y = Math.min(e.clientY, window.innerHeight - 300);

    setContextMenu({
      visible: true,
      x,
      y,
      termId: term.id,
      term,
      submenu: null,
    });
  };

  if (terminalMinimized) return null;

  return (
    <footer
      ref={containerRef}
      className="flex flex-col border-t-2 relative z-10 transition-all duration-300"
      style={{
        backgroundColor: "var(--terminal-bg-color)",
        borderColor: "var(--panel-border-color)",
        height: `${terminalHeight}px`,
        maxHeight: "none",
      }}
    >
      {/* Top Header: Main Tabs (TERMINAL / OUTPUT / DEBUG CONSOLE / PROBLEMS) & Window Controls */}
      <div className="flex justify-between items-center px-4 py-1 border-b border-[var(--panel-border-color)] bg-[var(--panel-bg-color)] select-none">
        <div className="flex space-x-5 items-center">
          <span
            onClick={() => setActiveTerminalTab("TERMINAL")}
            className={`text-xs font-bold cursor-pointer pb-1 transition-all ${
              activeTerminalTab === "TERMINAL"
                ? "border-b-2 border-[var(--primary-color)]"
                : "opacity-50 hover:opacity-100"
            }`}
            style={{ color: "var(--text-color)" }}
          >
            TERMINAL ({terminals.length})
          </span>

          <span
            onClick={() => setActiveTerminalTab("OUTPUT")}
            className={`text-xs font-bold cursor-pointer pb-1 transition-all ${
              activeTerminalTab === "OUTPUT"
                ? "border-b-2 border-[var(--primary-color)]"
                : "opacity-50 hover:opacity-100"
            }`}
            style={{ color: "var(--text-color)" }}
          >
            OUTPUT{terminalOutput.length > 0 ? ` (${terminalOutput.length})` : ""}
          </span>

          <span
            onClick={() => setActiveTerminalTab("DEBUG_CONSOLE")}
            className={`text-xs font-bold cursor-pointer pb-1 transition-all ${
              activeTerminalTab === "DEBUG_CONSOLE"
                ? "border-b-2 border-[var(--primary-color)]"
                : "opacity-50 hover:opacity-100"
            }`}
            style={{ color: "var(--text-color)" }}
          >
            DEBUG CONSOLE{debugLogs.length > 0 ? ` (${debugLogs.length})` : ""}
          </span>

          <span
            onClick={() => setActiveTerminalTab("PROBLEMS")}
            className={`text-xs font-bold cursor-pointer pb-1 transition-all ${
              activeTerminalTab === "PROBLEMS"
                ? "border-b-2 border-[var(--primary-color)]"
                : "opacity-50 hover:opacity-100"
            }`}
            style={{ color: "var(--text-color)" }}
          >
            PROBLEMS{problems.length > 0 ? ` (${problems.length})` : ""}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {activeTerminalTab === "TERMINAL" && (
            <button
              onClick={() => handleAddTerminal(false)}
              title="Criar novo terminal"
              className="flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-[var(--hover-bg-color)] hover:bg-[var(--primary-color)] hover:text-white transition-all"
              style={{ color: "var(--text-color)" }}
            >
              <span className="codicon codicon-plus"></span>
              <span>Novo Terminal</span>
            </button>
          )}

          <button
            onClick={() => {
              if (activeTerminalTab === "TERMINAL") {
                apisRef.current[activeTerminalId]?.clear();
              } else if (activeTerminalTab === "OUTPUT") {
                setTerminalOutput([]);
              } else if (activeTerminalTab === "DEBUG_CONSOLE") {
                if (onClearDebugLogs) onClearDebugLogs();
              } else if (activeTerminalTab === "PROBLEMS") {
                setProblems([]);
              }
            }}
            title="Limpar saída"
            className="hover:text-[var(--primary-color)] transition-colors p-1"
            style={{ color: "var(--text-color)" }}
          >
            <span className="codicon codicon-clear-all"></span>
          </button>

          <button
            onClick={() => {
              const newHeight = terminalHeight === 240 ? 400 : 240;
              setTerminalHeight(newHeight);
              try {
                localStorage.setItem(
                  "teamcode-terminal-height",
                  String(newHeight)
                );
              } catch (_) { }
              setTimeout(() => apisRef.current[activeTerminalId]?.fit(), 100);
            }}
            title={
              terminalHeight === 240
                ? "Maximizar Painel"
                : "Restaurar Painel"
            }
            className="hover:text-[var(--primary-color)] transition-colors p-1"
            style={{ color: "var(--text-color)" }}
          >
            <span
              className={`codicon ${
                terminalHeight === 240
                  ? "codicon-chevron-up"
                  : "codicon-chevron-down"
              }`}
            ></span>
          </button>

          <button
            onClick={() => setTerminalMinimized(true)}
            title="Minimizar painel"
            className="hover:text-[var(--primary-color)] transition-colors p-1"
            style={{ color: "var(--text-color)" }}
          >
            <span className="codicon codicon-close"></span>
          </button>
        </div>
      </div>

      {/* Sub-Header: Secondary Sub-Tabs for Multiple Terminals (Only when in TERMINAL tab) */}
      {activeTerminalTab === "TERMINAL" && (
        <div
          className="flex items-center px-4 py-1 space-x-2 border-b overflow-x-auto select-none"
          style={{
            borderColor: "var(--panel-border-color)",
            backgroundColor: "var(--terminal-header-bg)",
          }}
        >
          {terminals.map((term) => {
            const isActive = activeTerminalId === term.id;
            return (
              <div
                key={term.id}
                onClick={() => setActiveTerminalId(term.id)}
                onContextMenu={(e) => handleTabContextMenu(e, term)}
                className={`flex items-center space-x-2 px-2.5 py-0.5 rounded text-xs cursor-pointer border transition-all ${
                  isActive
                    ? "font-bold shadow-sm"
                    : "opacity-60 hover:opacity-100"
                }`}
                style={{
                  backgroundColor: isActive
                    ? "var(--input-bg-color)"
                    : "transparent",
                  borderColor: isActive
                    ? "var(--primary-color)"
                    : "transparent",
                  color: term.color || "var(--text-color)",
                }}
                title={`${term.name} (Clique com botão direito para opções)`}
              >
                <span
                  className={`codicon ${term.icon || (term.isAi ? "codicon-sparkle text-purple-400" : "codicon-terminal")}`}
                  style={{ color: term.color || (term.isAi ? "#c084fc" : undefined) }}
                />
                {editingId === term.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => saveEditing(term.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEditing(term.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="bg-transparent border-b border-[var(--primary-color)] outline-none text-xs w-24 px-0.5"
                    style={{ color: "var(--text-color)" }}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => startEditing(term, e)}
                    title="Clique duplo ou F2 para renomear"
                  >
                    {term.name}
                  </span>
                )}
                {terminals.length > 1 && (
                  <span
                    onClick={(e) => handleCloseTerminal(term.id, e)}
                    className="codicon codicon-close opacity-50 hover:opacity-100 hover:text-red-400 ml-1 cursor-pointer"
                    title="Encerrar Terminal"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Main Tab Content Area */}
      <div className="flex-1 relative min-h-0">
        {/* Tab 1: Terminals Container */}
        <div
          className={`h-full w-full relative ${
            activeTerminalTab === "TERMINAL" ? "" : "hidden"
          }`}
        >
          {terminals.map((term) => (
            <div
              key={term.id}
              className={`absolute inset-0 h-full w-full ${
                activeTerminalId === term.id ? "block" : "hidden"
              }`}
            >
              <TerminalComponent
                sessionId={sessionId}
                terminalId={term.id}
                stompClient={stompClient}
                registerApi={(api) => {
                  apisRef.current[term.id] = api;
                  if (term.id === activeTerminalId) {
                    terminalApiRef.current = api;
                  }
                  if (terminalBufferRef?.current?.length > 0 && term.id === "main") {
                    terminalBufferRef.current.forEach((chunk) => api.write(chunk));
                    terminalBufferRef.current = [];
                  }
                }}
                onApiReady={(api) => {
                  apisRef.current[term.id] = api;
                  if (term.id === activeTerminalId) {
                    terminalApiRef.current = api;
                  }
                }}
              />
            </div>
          ))}
        </div>

        {/* Tab 2: Output Container */}
        <div
          className={`h-full w-full overflow-y-auto ${
            activeTerminalTab === "OUTPUT" ? "" : "hidden"
          }`}
          style={{
            backgroundColor: "var(--terminal-bg-color)",
            color: "var(--text-color)",
          }}
        >
          {terminalOutput.length === 0 ? (
            <div className="p-4">
              <p className="text-sm opacity-70">
                Nenhuma saída de console ainda.
              </p>
              <p className="text-xs opacity-50 mt-2">
                Execute arquivos de código com o botão 'Run' para ver a saída aqui.
              </p>
            </div>
          ) : (
            <div className="p-4 font-mono text-sm space-y-2">
              {terminalOutput.map((output, idx) => (
                <div
                  key={idx}
                  className="whitespace-pre-wrap"
                  style={{
                    color:
                      output.type === "error"
                        ? "#EF4444"
                        : output.type === "success"
                        ? "#10B981"
                        : "inherit",
                  }}
                >
                  {output.text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab 3: Debug Console */}
        <div
          className={`h-full w-full overflow-hidden ${
            activeTerminalTab === "DEBUG_CONSOLE" ? "" : "hidden"
          }`}
          style={{
            backgroundColor: "var(--terminal-bg-color)",
            color: "var(--text-color)",
          }}
        >
          <DebugConsole
            debugLogs={debugLogs}
            onClearDebugLogs={onClearDebugLogs}
            debugScope={debugScope}
            onEvaluate={onEvaluateDebug}
          />
        </div>

        {/* Tab 4: Problems Container */}
        <div
          className={`h-full w-full overflow-y-auto ${
            activeTerminalTab === "PROBLEMS" ? "" : "hidden"
          }`}
          style={{
            backgroundColor: "var(--terminal-bg-color)",
            color: "var(--text-color)",
          }}
        >
          {problems.length === 0 ? (
            <div className="p-4">
              <p className="text-sm opacity-70">
                Nenhum problema detectado no workspace.
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {problems.map((problem, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (editorRef.current && problem.line) {
                      editorRef.current.revealLineInCenter(problem.line);
                      editorRef.current.setPosition({
                        lineNumber: problem.line,
                        column: problem.col || 1,
                      });
                      editorRef.current.focus();
                    }
                  }}
                  className="flex items-start space-x-2 p-2 rounded hover:bg-[var(--hover-bg-color)] cursor-pointer text-xs"
                >
                  <span
                    className={`codicon ${
                      problem.severity === "error"
                        ? "codicon-error text-red-500"
                        : "codicon-warning text-yellow-500"
                    } mt-0.5`}
                  ></span>
                  <div className="flex-1">
                    <p className="font-medium">{problem.message}</p>
                    <p className="opacity-50 text-[11px]">
                      {problem.file} [Linha {problem.line}, Coluna{" "}
                      {problem.col}]
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* VS Code-style Context Menu for Terminal Tabs */}
      {contextMenu && contextMenu.visible && (
        <div
          id="terminal-context-menu"
          className="fixed z-50 rounded-md border shadow-2xl py-1 text-xs select-none backdrop-blur-md animate-fadeIn"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
            minWidth: "220px",
            backgroundColor: "var(--panel-bg-color)",
            borderColor: "var(--panel-border-color)",
            color: "var(--text-color)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Split Terminal */}
          <div
            onClick={() => {
              handleAddTerminal(false);
              setContextMenu(null);
            }}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--hover-bg-color)] cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="codicon codicon-split-horizontal opacity-75" />
              <span>Split Terminal</span>
            </span>
            <span className="text-[10px] opacity-40 font-mono">Ctrl+Shift+5</span>
          </div>

          <div className="my-1 border-t" style={{ borderColor: "var(--panel-border-color)" }} />

          {/* Change Color Submenu */}
          <div
            className="relative flex items-center justify-between px-3 py-1.5 hover:bg-[var(--hover-bg-color)] cursor-pointer group"
            onMouseEnter={() => setContextMenu((prev) => ({ ...prev, submenu: "color" }))}
          >
            <span className="flex items-center gap-2">
              <span className="codicon codicon-color-mode opacity-75" />
              <span>Change Color...</span>
            </span>
            <span className="codicon codicon-chevron-right text-[10px] opacity-60" />

            {contextMenu.submenu === "color" && (
              <div
                className="absolute left-full top-0 ml-1 rounded-md border shadow-2xl py-1 z-50"
                style={{
                  minWidth: "140px",
                  backgroundColor: "var(--panel-bg-color)",
                  borderColor: "var(--panel-border-color)",
                }}
              >
                {TERMINAL_COLORS.map((c) => (
                  <div
                    key={c.name}
                    onClick={() => handleChangeColor(contextMenu.termId, c.value)}
                    className="flex items-center gap-2 px-3 py-1 hover:bg-[var(--hover-bg-color)] cursor-pointer"
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: c.value || "var(--text-color)",
                      }}
                    />
                    <span>{c.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Change Icon Submenu */}
          <div
            className="relative flex items-center justify-between px-3 py-1.5 hover:bg-[var(--hover-bg-color)] cursor-pointer group"
            onMouseEnter={() => setContextMenu((prev) => ({ ...prev, submenu: "icon" }))}
          >
            <span className="flex items-center gap-2">
              <span className="codicon codicon-symbol-customcolor opacity-75" />
              <span>Change Icon...</span>
            </span>
            <span className="codicon codicon-chevron-right text-[10px] opacity-60" />

            {contextMenu.submenu === "icon" && (
              <div
                className="absolute left-full top-0 ml-1 rounded-md border shadow-2xl py-1 z-50"
                style={{
                  minWidth: "150px",
                  backgroundColor: "var(--panel-bg-color)",
                  borderColor: "var(--panel-border-color)",
                }}
              >
                {TERMINAL_ICONS.map((ic) => (
                  <div
                    key={ic.name}
                    onClick={() => handleChangeIcon(contextMenu.termId, ic.icon)}
                    className="flex items-center gap-2 px-3 py-1 hover:bg-[var(--hover-bg-color)] cursor-pointer"
                  >
                    <span className={`codicon ${ic.icon}`} />
                    <span>{ic.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rename Terminal */}
          <div
            onClick={() => {
              const t = terminals.find((x) => x.id === contextMenu.termId);
              if (t) startEditing(t);
            }}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--hover-bg-color)] cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="codicon codicon-edit opacity-75" />
              <span>Rename...</span>
            </span>
            <span className="text-[10px] opacity-40 font-mono">F2</span>
          </div>

          <div className="my-1 border-t" style={{ borderColor: "var(--panel-border-color)" }} />

          {/* Restart Terminal */}
          <div
            onClick={() => handleRestartTerminal(contextMenu.termId)}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--hover-bg-color)] cursor-pointer text-cyan-400 hover:text-cyan-300"
            title="Reiniciar processo PTY da bash"
          >
            <span className="flex items-center gap-2">
              <span className="codicon codicon-refresh" />
              <span>Restart Terminal</span>
            </span>
          </div>

          {/* Clear Terminal */}
          <div
            onClick={() => handleClearTerminal(contextMenu.termId)}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-[var(--hover-bg-color)] cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="codicon codicon-clear-all opacity-75" />
              <span>Clear Terminal</span>
            </span>
          </div>

          <div className="my-1 border-t" style={{ borderColor: "var(--panel-border-color)" }} />

          {/* Kill Terminal */}
          <div
            onClick={(e) => handleCloseTerminal(contextMenu.termId, e)}
            className="flex items-center justify-between px-3 py-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-300 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="codicon codicon-trash" />
              <span>Kill Terminal</span>
            </span>
            <span className="text-[10px] opacity-60 font-mono">Delete</span>
          </div>
        </div>
      )}
    </footer>
  );
}

export default TerminalPanel;
