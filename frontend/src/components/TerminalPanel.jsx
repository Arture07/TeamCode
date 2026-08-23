import React, { useState, useRef, useEffect } from "react";
import TerminalComponent from "./TerminalComponent";

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
    const name = customName || (isAi ? "🤖 Agente IA" : `Terminal ${terminals.length + 1}`);
    setTerminals((prev) => [...prev, { id: newId, name, isAi }]);
    setActiveTerminalId(newId);
  };

  const handleCloseTerminal = (idToClose, e) => {
    e?.stopPropagation();
    if (stompClient?.connected) {
      try {
        stompClient.publish({
          destination: `/app/terminal.close/${sessionId}/${idToClose}`,
        });
      } catch (_) { }
    }
    delete apisRef.current[idToClose];

    setTerminals((prev) => {
      const filtered = prev.filter((t) => t.id !== idToClose);
      if (filtered.length === 0) {
        return [{ id: "main", name: "Terminal 1", isAi: false }];
      }
      return filtered;
    });

    if (activeTerminalId === idToClose) {
      const remaining = terminals.filter((t) => t.id !== idToClose);
      setActiveTerminalId(remaining.length > 0 ? remaining[remaining.length - 1].id : "main");
    }
  };

  const startRename = (t, e) => {
    e.stopPropagation();
    setEditingId(t.id);
    setEditingName(t.name);
  };

  const saveRename = () => {
    if (editingId && editingName.trim()) {
      setTerminals((prev) =>
        prev.map((t) => (t.id === editingId ? { ...t, name: editingName.trim() } : t))
      );
    }
    setEditingId(null);
    setEditingName("");
  };

  if (terminalMinimized) return null;

  return (
    <footer
      className="flex-shrink-0 border-t-2 terminal-footer flex flex-col"
      style={{
        backgroundColor: "var(--terminal-bg-color)",
        borderColor: "var(--panel-border-color)",
        height: `${terminalHeight}px`,
        maxHeight: "none",
      }}
    >
      {/* Top Header: Main Tabs (TERMINAL / OUTPUT / PROBLEMS) & Window Controls */}
      <div className="flex justify-between items-center px-4 py-1 border-b border-[var(--panel-border-color)] bg-[var(--panel-bg-color)] select-none">
        <div className="flex space-x-6 items-center">
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
            OUTPUT
          </span>
          <span
            onClick={() => setActiveTerminalTab("PROBLEMS")}
            className={`text-xs font-bold cursor-pointer pb-1 transition-all ${activeTerminalTab === "PROBLEMS"
              ? "border-b-2 border-[var(--primary-color)]"
              : "opacity-50 hover:opacity-100"
              }`}
            style={{ color: "var(--text-color)" }}
          >
            PROBLEMS
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
            title="Maximizar/Reduzir Painel"
            className="hover:text-[var(--primary-color)] transition-colors p-1"
            style={{ color: "var(--text-color)" }}
          >
            <span
              className={`codicon ${terminalHeight === 240 ? "codicon-chevron-up" : "codicon-chevron-down"}`}
            ></span>
          </button>
          <button
            onClick={() => {
              setTerminalMinimized(true);
              try {
                localStorage.setItem(
                  "teamcode-terminal-minimized",
                  "1",
                );
              } catch (_) { }
            }}
            title="Fechar Painel"
            className="hover:text-[var(--primary-color)] transition-colors p-1"
            style={{ color: "var(--text-color)" }}
          >
            <span className="codicon codicon-close"></span>
          </button>
        </div>
      </div>

      {/* Sub-bar for Multi-Terminal Tabs */}
      {activeTerminalTab === "TERMINAL" && (
        <div className="flex items-center px-2 py-1 bg-[var(--bg-color)] border-b border-[var(--panel-border-color)] overflow-x-auto space-x-1 select-none">
          {terminals.map((term) => {
            const isActive = term.id === activeTerminalId;
            return (
              <div
                key={term.id}
                onClick={() => setActiveTerminalId(term.id)}
                onDoubleClick={(e) => startRename(term, e)}
                className={`group flex items-center space-x-2 px-3 py-1 rounded text-xs cursor-pointer border transition-all ${
                  isActive
                    ? "bg-[var(--panel-bg-color)] border-[var(--primary-color)] font-semibold shadow-sm"
                    : "bg-transparent border-transparent opacity-70 hover:opacity-100 hover:bg-[var(--hover-bg-color)]"
                }`}
                style={{ color: "var(--text-color)" }}
                title="Clique para alternar, duplo clique para renomear"
              >
                <span className={`codicon ${term.isAi ? "codicon-hubot text-emerald-400" : "codicon-terminal"}`}></span>
                {editingId === term.id ? (
                  <input
                    type="text"
                    value={editingName}
                    autoFocus
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={saveRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent border-b border-[var(--primary-color)] outline-none px-1 text-xs w-24"
                  />
                ) : (
                  <span className="truncate max-w-[120px]">{term.name}</span>
                )}
                {terminals.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTerminal(term.id, e)}
                    title="Encerrar este terminal"
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 rounded transition-opacity"
                  >
                    <span className="codicon codicon-close text-[10px]"></span>
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={() => handleAddTerminal(false)}
            title="Novo Terminal"
            className="p-1 px-1.5 rounded hover:bg-[var(--hover-bg-color)] text-xs opacity-70 hover:opacity-100 transition-all"
            style={{ color: "var(--text-color)" }}
          >
            <span className="codicon codicon-plus"></span>
          </button>
        </div>
      )}

      {/* Main Terminal View Area */}
      <div className="flex-grow relative min-h-0">
        <div className={`h-full w-full ${activeTerminalTab === "TERMINAL" ? "" : "hidden"}`}>
          {terminals.map((term) => (
            <div
              key={term.id}
              className={`h-full w-full ${activeTerminalId === term.id ? "" : "hidden"}`}
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
              />
            </div>
          ))}
        </div>
        <div
          className={`h-full w-full overflow-y-auto ${activeTerminalTab === "OUTPUT" ? "" : "hidden"}`}
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
                Execute comandos no terminal para ver a saída aqui.
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
        <div
          className={`h-full w-full overflow-y-auto ${activeTerminalTab === "PROBLEMS" ? "" : "hidden"}`}
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
                      setActiveTerminalTab("TERMINAL");
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
                  ></span>
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
