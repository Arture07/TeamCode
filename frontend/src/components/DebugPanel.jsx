import React, { useState } from "react";

/**
 * DebugPanel — Side view for Variables Scope, Watch Expressions, Call Stack,
 * and Breakpoints Management matching VS Code Run & Debug panel.
 */
export default function DebugPanel({
  isDebugging,
  isPaused,
  currentLine,
  activeFile,
  breakpoints = {},
  onToggleBreakpoint,
  onRemoveBreakpoint,
  onClearAllBreakpoints,
  onOpenFileAtLine,
  debugScope = {},
  callStack = [],
  watchExpressions = [],
  onAddWatch,
  onRemoveWatch,
  onStartDebug,
  onStopDebug,
}) {
  const [variablesOpen, setVariablesOpen] = useState(true);
  const [watchOpen, setWatchOpen] = useState(true);
  const [callStackOpen, setCallStackOpen] = useState(true);
  const [breakpointsOpen, setBreakpointsOpen] = useState(true);
  const [newWatchInput, setNewWatchInput] = useState("");
  const [isAddingWatch, setIsAddingWatch] = useState(false);

  // Flatten all breakpoints across files
  const breakpointList = [];
  Object.entries(breakpoints).forEach(([filePath, lines]) => {
    (lines || []).forEach((line) => {
      breakpointList.push({ filePath, line });
    });
  });

  const handleAddWatchSubmit = (e) => {
    e.preventDefault();
    if (newWatchInput.trim() && onAddWatch) {
      onAddWatch(newWatchInput.trim());
      setNewWatchInput("");
      setIsAddingWatch(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden text-xs select-none" style={{ color: "var(--text-color)" }}>
      {/* 1. Top Header Bar */}
      <div
        className="h-10 px-3 border-b flex items-center justify-between flex-shrink-0"
        style={{
          backgroundColor: "var(--header-bg-color, var(--panel-bg-color))",
          borderColor: "var(--panel-border-color)",
        }}
      >
        <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5 opacity-85">
          <span className="codicon codicon-debug-alt text-amber-400" />
          <span>Run and Debug</span>
        </span>

        {/* Primary Start / Stop Debug Button */}
        <div>
          {!isDebugging ? (
            <button
              onClick={onStartDebug}
              className="px-2.5 py-1 border-2 font-bold text-[11px] neo-shadow-button flex items-center gap-1 text-emerald-400 hover:bg-black/10 transition-colors"
              style={{
                borderColor: "var(--panel-border-color)",
                backgroundColor: "var(--input-bg-color)",
              }}
              title="Iniciar Depuração (F5)"
            >
              <span className="codicon codicon-play" />
              <span>Debug (F5)</span>
            </button>
          ) : (
            <button
              onClick={onStopDebug}
              className="px-2.5 py-1 border-2 font-bold text-[11px] neo-shadow-button flex items-center gap-1 text-red-400 hover:bg-black/10 transition-colors"
              style={{
                borderColor: "var(--panel-border-color)",
                backgroundColor: "var(--input-bg-color)",
              }}
              title="Parar Depuração (Shift+F5)"
            >
              <span className="codicon codicon-debug-stop" />
              <span>Parar</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Accordions Area */}
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: "var(--panel-border-color)" }}>
        
        {/* --- SECTION: VARIABLES --- */}
        <div>
          <div
            onClick={() => setVariablesOpen(!variablesOpen)}
            className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-black/5 font-bold uppercase tracking-wider text-[11px]"
            style={{ backgroundColor: "var(--header-bg-color, var(--panel-bg-color))", color: "var(--text-color)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className={`codicon ${variablesOpen ? "codicon-chevron-down" : "codicon-chevron-right"} text-[10px]`} />
              <span>Variables</span>
            </div>
            <span className="opacity-50 text-[10px] lowercase font-normal">
              {isPaused ? "paused at breakpoint" : isDebugging ? "running" : "idle"}
            </span>
          </div>

          {variablesOpen && (
            <div className="p-2 space-y-1 font-mono text-xs">
              {!isDebugging ? (
                <div className="px-2 py-1 text-[11px] opacity-40 italic">
                  Nenhuma sessão de depuração ativa
                </div>
              ) : Object.keys(debugScope).length === 0 ? (
                <div className="px-2 py-1 text-[11px] opacity-40 italic">
                  Nenhuma variável no escopo atual
                </div>
              ) : (
                Object.entries(debugScope).map(([key, val]) => (
                  <div key={key} className="px-2 py-1 rounded flex items-start justify-between gap-2 hover:bg-black/10">
                    <span className="text-cyan-400 font-bold truncate">{key}:</span>
                    <span className="truncate max-w-[140px] text-right" style={{ color: typeof val === "string" ? "#34d399" : typeof val === "number" ? "#38bdf8" : "#fbbf24" }}>
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* --- SECTION: WATCH --- */}
        <div>
          <div
            onClick={() => setWatchOpen(!watchOpen)}
            className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-black/5 font-bold uppercase tracking-wider text-[11px]"
            style={{ backgroundColor: "var(--header-bg-color, var(--panel-bg-color))", color: "var(--text-color)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className={`codicon ${watchOpen ? "codicon-chevron-down" : "codicon-chevron-right"} text-[10px]`} />
              <span>Watch</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] border font-mono" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}>
                {watchExpressions.length}
              </span>
            </div>

            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setIsAddingWatch(true)}
                className="p-1 hover:text-amber-400 transition-colors"
                title="Adicionar Expressão de Watch"
              >
                <span className="codicon codicon-add text-[11px]" />
              </button>
            </div>
          </div>

          {watchOpen && (
            <div className="p-2 space-y-1">
              {isAddingWatch && (
                <form onSubmit={handleAddWatchSubmit} className="flex items-center gap-1 mb-2">
                  <input
                    type="text"
                    autoFocus
                    value={newWatchInput}
                    onChange={(e) => setNewWatchInput(e.target.value)}
                    placeholder="Expressão a monitorar (ex: items.length)..."
                    className="flex-1 px-2 py-1 border text-xs font-mono focus:outline-none rounded"
                    style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)", color: "var(--text-color)" }}
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 text-xs border font-bold hover:bg-black/10 rounded"
                    style={{ borderColor: "var(--panel-border-color)" }}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingWatch(false)}
                    className="p-1 opacity-60 hover:opacity-100"
                  >
                    <span className="codicon codicon-close" />
                  </button>
                </form>
              )}

              {watchExpressions.length === 0 && !isAddingWatch ? (
                <div className="px-2 py-1 text-[11px] opacity-40 italic">
                  Nenhuma expressão monitorada. Clique em '+' para adicionar.
                </div>
              ) : (
                watchExpressions.map((w, idx) => (
                  <div key={idx} className="px-2 py-1 rounded flex items-center justify-between gap-2 hover:bg-black/10 group font-mono text-xs">
                    <div className="flex items-center gap-1 truncate">
                      <span className="text-purple-300 font-bold truncate">{w.expr}:</span>
                      <span className="text-emerald-400 truncate">{w.value !== undefined ? String(w.value) : "not available"}</span>
                    </div>
                    <button
                      onClick={() => onRemoveWatch && onRemoveWatch(w.expr)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-opacity flex-shrink-0"
                      title="Remover expressão"
                    >
                      <span className="codicon codicon-close text-[10px]" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* --- SECTION: CALL STACK --- */}
        <div>
          <div
            onClick={() => setCallStackOpen(!callStackOpen)}
            className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-black/5 font-bold uppercase tracking-wider text-[11px]"
            style={{ backgroundColor: "var(--header-bg-color, var(--panel-bg-color))", color: "var(--text-color)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className={`codicon ${callStackOpen ? "codicon-chevron-down" : "codicon-chevron-right"} text-[10px]`} />
              <span>Call Stack</span>
            </div>
          </div>

          {callStackOpen && (
            <div className="p-2 space-y-1">
              {!isDebugging ? (
                <div className="px-2 py-1 text-[11px] opacity-40 italic">
                  Nenhuma pilha de chamadas ativa
                </div>
              ) : callStack.length === 0 ? (
                <div className="px-2 py-1 rounded flex items-center gap-2 font-mono text-xs" style={{ backgroundColor: "var(--input-bg-color)" }}>
                  <span className="codicon codicon-debug-stackframe-active text-amber-400 text-xs" />
                  <span className="font-bold truncate">{activeFile ? activeFile.split("/").pop() : "main"}</span>
                  <span className="opacity-50 text-[10px]">line {currentLine || 1}</span>
                </div>
              ) : (
                callStack.map((frame, idx) => (
                  <div
                    key={idx}
                    onClick={() => onOpenFileAtLine && onOpenFileAtLine(frame.filePath, frame.line)}
                    className="px-2 py-1 rounded flex items-center justify-between gap-2 hover:bg-black/10 cursor-pointer font-mono text-xs"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="codicon codicon-debug-stackframe opacity-75 text-xs" />
                      <span className="font-bold truncate">{frame.funcName || "anonymous"}</span>
                    </div>
                    <span className="opacity-50 text-[10px] flex-shrink-0">
                      {frame.fileName}:{frame.line}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* --- SECTION: BREAKPOINTS --- */}
        <div>
          <div
            onClick={() => setBreakpointsOpen(!breakpointsOpen)}
            className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-black/5 font-bold uppercase tracking-wider text-[11px]"
            style={{ backgroundColor: "var(--header-bg-color, var(--panel-bg-color))", color: "var(--text-color)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className={`codicon ${breakpointsOpen ? "codicon-chevron-down" : "codicon-chevron-right"} text-[10px]`} />
              <span>Breakpoints</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] border font-mono" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}>
                {breakpointList.length}
              </span>
            </div>

            {breakpointList.length > 0 && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={onClearAllBreakpoints}
                  className="p-1 hover:text-red-400 transition-colors"
                  title="Remover todos os breakpoints"
                >
                  <span className="codicon codicon-close-all text-[11px]" />
                </button>
              </div>
            )}
          </div>

          {breakpointsOpen && (
            <div className="p-2 space-y-1">
              {breakpointList.length === 0 ? (
                <div className="px-2 py-1 text-[11px] opacity-40 italic">
                  Nenhum breakpoint definido. Clique na margem do editor (ou pressione F9) para adicionar.
                </div>
              ) : (
                breakpointList.map((bp, idx) => {
                  const fileName = bp.filePath.split("/").pop();
                  return (
                    <div
                      key={idx}
                      onClick={() => onOpenFileAtLine && onOpenFileAtLine(bp.filePath, bp.line)}
                      className="px-2 py-1 rounded flex items-center justify-between gap-2 hover:bg-black/10 cursor-pointer group font-mono text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white/20 flex-shrink-0" />
                        <span className="font-bold truncate">{fileName}</span>
                        <span className="opacity-50 text-[10px]">linha {bp.line}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRemoveBreakpoint) onRemoveBreakpoint(bp.filePath, bp.line);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-opacity flex-shrink-0"
                        title="Remover breakpoint"
                      >
                        <span className="codicon codicon-close text-[10px]" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
