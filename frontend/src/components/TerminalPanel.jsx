import React, { useState, useRef, useEffect } from "react";
import TerminalComponent from "./TerminalComponent";
import DebugConsole from "./DebugConsole";

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
    { id: "main", name: "Terminal 1", isAi: false },
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState("main");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const apisRef = useRef({});

  // Ensure active terminal API is mirrored to parent terminalApiRef
  useEffect(() => {
    if (apisRef.current[activeTerminalId]) {
      terminalApiRef.current = apisRef.current[activeTerminalId];
    }
  }, [activeTerminalId, terminalApiRef]);

  const handleAddTerminal = (isAi = false, customName = null) => {
    const newId = isAi ? "ai" : `term_${Date.now().toString(36)}`;
    const exists = terminals.find((t) => t.id === newId);
    if (exists) {
      setActiveTerminalId(newId);
      return;
    }
    const name = customName || (isAi ? "Agente IA" : `Terminal ${terminals.length + 1}`);
    setTerminals((prev) => [...prev, { id: newId, name, isAi }]);
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
      setTerminals([{ id: "main", name: "Terminal 1", isAi: false }]);
      setActiveTerminalId("main");
    } else {
      setTerminals(remaining);
      if (activeTerminalId === idToClose) {
        setActiveTerminalId(remaining[remaining.length - 1].id);
      }
    }
  };

  const startEditing = (term, e) => {
    e.stopPropagation();
    setEditingId(term.id);
    setEditingName(term.name);
  };

  const saveEditing = (id) => {
    if (editingName.trim()) {
      setTerminals((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, name: editingName.trim() } : t,
        ),
      );
    }
    setEditingId(null);
  };

  if (terminalMinimized) return null;

  return (
    <footer
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
            className={`text-xs font-bold cursor-pointer pb-1 transition-all ${activeTerminalTab === "TERMINAL"
                ? "border-b-2 border-[var(--primary-color)]"
                : "opacity-50 hover:opacity-100"
              }`}
            style={{ color: "var(--text-color)" }}
          >
            TERMINAL ({terminals.length})
          </span>

          <span
            onClick={() => setActiveTerminalTab("OUTPUT")}
            className={`text-xs font-bold cursor-pointer pb-1 transition-all ${activeTerminalTab === "OUTPUT"
                ? "border-b-2 border-[var(--primary-color)]"
                : "opacity-50 hover:opacity-100"
              }`}
            style={{ color: "var(--text-color)" }}
          >
            OUTPUT{terminalOutput.length > 0 ? ` (${terminalOutput.length})` : ""}
          </span>

          <span
            onClick={() => setActiveTerminalTab("DEBUG_CONSOLE")}
            className={`text-xs font-bold cursor-pointer pb-1 transition-all ${activeTerminalTab === "DEBUG_CONSOLE"
                ? "border-b-2 border-[var(--primary-color)]"
                : "opacity-50 hover:opacity-100"
              }`}
            style={{ color: "var(--text-color)" }}
          >
            DEBUG CONSOLE{debugLogs.length > 0 ? ` (${debugLogs.length})` : ""}
          </span>

          <span
            onClick={() => setActiveTerminalTab("PROBLEMS")}
            className={`text-xs font-bold cursor-pointer pb-1 transition-all ${activeTerminalTab === "PROBLEMS"
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
                  String(newHeight),
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
              className={`codicon ${terminalHeight === 240
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
                className={`flex items-center space-x-2 px-2.5 py-0.5 rounded text-xs cursor-pointer border transition-all ${isActive
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
                  color: "var(--text-color)",
                }}
              >
                <span
                  className={`codicon ${term.isAi ? "codicon-sparkle text-purple-400" : "codicon-terminal"
                    }`}
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
                    className="bg-transparent border-b border-[var(--primary-color)] outline-none text-xs w-20 px-0.5"
                    style={{ color: "var(--text-color)" }}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => startEditing(term, e)}
                    title="Clique duplo para renomear"
                  >
                    {term.name}
                  </span>
                )}
                {terminals.length > 1 && (
                  <span
                    onClick={(e) => handleCloseTerminal(term.id, e)}
                    className="codicon codicon-close opacity-50 hover:opacity-100 hover:text-red-400 ml-1 cursor-pointer"
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
          className={`h-full w-full relative ${activeTerminalTab === "TERMINAL" ? "" : "hidden"
            }`}
        >
          {terminals.map((term) => (
            <div
              key={term.id}
              className={`absolute inset-0 h-full w-full ${activeTerminalId === term.id ? "block" : "hidden"
                }`}
            >
              <TerminalComponent
                sessionId={sessionId}
                terminalId={term.id}
                stompClient={stompClient}
                onApiReady={(api) => {
                  apisRef.current[term.id] = api;
                  if (term.id === activeTerminalId) {
                    terminalApiRef.current = api;
                  }
                  if (terminalBufferRef?.current?.length > 0 && term.id === "main") {
                    terminalBufferRef.current.forEach((chunk) => api.write(chunk));
                    terminalBufferRef.current = [];
                  }
                }}
              />
            </div>
          ))}
        </div>

        {/* Tab 2: Output Container */}
        <div
          className={`h-full w-full overflow-y-auto ${activeTerminalTab === "OUTPUT" ? "" : "hidden"
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
                        ? "#ef4444"
                        : "var(--text-color)",
                  }}
                >
                  <span className="opacity-50">
                    [{output.timestamp}]
                  </span>{" "}
                  {output.message}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab 3: Debug Console Container */}
        <div
          className={`h-full w-full ${activeTerminalTab === "DEBUG_CONSOLE" ? "" : "hidden"
            }`}
        >
          <DebugConsole
            debugLogs={debugLogs}
            onClearLogs={onClearDebugLogs}
            debugScope={debugScope}
            onEvaluate={onEvaluateDebug}
          />
        </div>

        {/* Tab 4: Problems Diagnostics Container */}
        <div
          className={`h-full w-full overflow-y-auto ${activeTerminalTab === "PROBLEMS" ? "" : "hidden"
            }`}
          style={{
            backgroundColor: "var(--terminal-bg-color)",
            color: "var(--text-color)",
          }}
        >
          {problems.length === 0 ? (
            <div className="p-4">
              <p className="text-sm opacity-70">
                Nenhum problema detectado.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--panel-border-color)]">
              {problems.map((problem, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.setPosition({
                        lineNumber: problem.line,
                        column: problem.column,
                      });
                      editorRef.current.revealLineInCenter(
                        problem.line,
                      );
                      editorRef.current.focus();
                    }
                  }}
                  className="p-3 hover:bg-[var(--input-bg-color)] cursor-pointer transition-colors flex items-start space-x-3"
                >
                  <span
                    className={`codicon mt-0.5 ${problem.severity === "error"
                        ? "codicon-error text-red-500"
                        : problem.severity === "warning"
                          ? "codicon-warning text-yellow-500"
                          : "codicon-info text-blue-500"
                      }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-color)" }}
                    >
                      {problem.message}
                    </p>
                    <p className="text-xs opacity-60 mt-1">
                      {problem.filePath} [{problem.line},{" "}
                      {problem.column}]
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

export default TerminalPanel;
