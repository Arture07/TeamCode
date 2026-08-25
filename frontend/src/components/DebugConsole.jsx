import React, { useState, useRef, useEffect } from "react";

/**
 * DebugValueViewer — Formats and renders JavaScript values with syntax highlighting
 * and interactive object/array expansion.
 */
function DebugValueViewer({ value, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth === 0);

  if (value === null) {
    return <span className="text-gray-400 italic">null</span>;
  }
  if (value === undefined) {
    return <span className="text-gray-500 italic">undefined</span>;
  }
  if (typeof value === "number") {
    return <span className="text-cyan-400 font-mono">{String(value)}</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-amber-400 font-bold font-mono">{String(value)}</span>;
  }
  if (typeof value === "string") {
    return <span className="text-emerald-400 font-mono">"{value}"</span>;
  }
  if (typeof value === "function") {
    return <span className="text-purple-400 font-mono italic">ƒ {value.name || "anonymous"}()</span>;
  }
  if (Array.isArray(value)) {
    if (!expanded) {
      return (
        <span
          onClick={() => setExpanded(true)}
          className="cursor-pointer hover:underline text-blue-300 font-mono"
        >
          Array({value.length}) [{value.slice(0, 3).map(v => typeof v === 'string' ? `"${v}"` : String(v)).join(", ")}{value.length > 3 ? "..." : ""}]
        </span>
      );
    }
    return (
      <div className="font-mono text-xs pl-2">
        <span
          onClick={() => setExpanded(false)}
          className="cursor-pointer font-bold text-blue-400 select-none hover:underline"
        >
          ▼ Array({value.length})
        </span>
        <div className="pl-4 border-l border-white/10 space-y-0.5 mt-0.5">
          {value.map((item, idx) => (
            <div key={idx} className="flex items-start gap-1">
              <span className="text-purple-300 font-bold">{idx}:</span>
              <DebugValueViewer value={item} depth={depth + 1} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!expanded) {
      return (
        <span
          onClick={() => setExpanded(true)}
          className="cursor-pointer hover:underline text-amber-300 font-mono"
        >
          {`{ `}
          {keys.slice(0, 3).map(k => `${k}: ${typeof value[k] === 'string' ? `"${value[k]}"` : String(value[k])}`).join(", ")}
          {keys.length > 3 ? ", ..." : ""}
          {` }`}
        </span>
      );
    }
    return (
      <div className="font-mono text-xs pl-2">
        <span
          onClick={() => setExpanded(false)}
          className="cursor-pointer font-bold text-amber-400 select-none hover:underline"
        >
          ▼ Object
        </span>
        <div className="pl-4 border-l border-white/10 space-y-0.5 mt-0.5">
          {keys.map((key) => (
            <div key={key} className="flex items-start gap-1">
              <span className="text-cyan-300 font-bold">{key}:</span>
              <DebugValueViewer value={value[key]} depth={depth + 1} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return <span className="font-mono">{String(value)}</span>;
}

/**
 * DebugConsole — Interactive REPL & Console Output matching VS Code Debug Console.
 */
export default function DebugConsole({
  debugLogs = [],
  onClearLogs,
  debugScope = {},
  onEvaluate,
}) {
  const [inputVal, setInputVal] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [filterText, setFilterText] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debugLogs]);

  // Execute expression
  const handleExecute = (e) => {
    e.preventDefault();
    const cmd = inputVal.trim();
    if (!cmd) return;

    // Add to command history
    setHistory((prev) => [...prev, cmd]);
    setHistoryIdx(-1);
    setInputVal("");

    if (onEvaluate) {
      onEvaluate(cmd);
    }
  };

  // Up/Down History Navigation
  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const newIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(newIdx);
      setInputVal(history[newIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === -1) return;
      const newIdx = historyIdx + 1;
      if (newIdx >= history.length) {
        setHistoryIdx(-1);
        setInputVal("");
      } else {
        setHistoryIdx(newIdx);
        setInputVal(history[newIdx]);
      }
    }
  };

  const filteredLogs = debugLogs.filter((log) => {
    if (!filterText) return true;
    const search = filterText.toLowerCase();
    return (
      (log.text && String(log.text).toLowerCase().includes(search)) ||
      (log.expression && String(log.expression).toLowerCase().includes(search))
    );
  });

  return (
    <div
      className="h-full w-full flex flex-col font-mono text-xs select-text overflow-hidden"
      style={{
        backgroundColor: "var(--terminal-bg-color, var(--panel-bg-color))",
        color: "var(--text-color)",
      }}
    >
      {/* Console Subheader Bar */}
      <div
        className="h-8 px-3 border-b flex items-center justify-between flex-shrink-0 select-none text-[11px]"
        style={{
          borderColor: "var(--panel-border-color)",
          backgroundColor: "var(--header-bg-color, var(--panel-bg-color))",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="codicon codicon-debug-console text-amber-400" />
          <span className="font-bold opacity-80">Debug Console</span>
          <span className="opacity-40 text-[10px]">({debugLogs.length} logs)</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter Input */}
          <div className="relative flex items-center">
            <span className="codicon codicon-filter absolute left-2 opacity-50 text-[10px]" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filtrar console..."
              className="pl-6 pr-2 py-0.5 border text-[11px] focus:outline-none rounded"
              style={{
                backgroundColor: "var(--input-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--text-color)",
              }}
            />
          </div>

          <button
            onClick={onClearLogs}
            className="p-1 hover:opacity-75 transition-opacity"
            title="Limpar Console de Debug"
          >
            <span className="codicon codicon-clear-all text-[11px]" />
          </button>
        </div>
      </div>

      {/* Logs Output List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
        {filteredLogs.length === 0 ? (
          <div className="p-4 text-center opacity-40 italic text-xs">
            Nenhuma mensagem de depuração. Digite uma expressão abaixo para avaliar ou inicie a depuração com F5.
          </div>
        ) : (
          filteredLogs.map((log, idx) => {
            const isError = log.type === "error";
            const isWarn = log.type === "warn";
            const isInput = log.type === "input";
            const isResult = log.type === "result";

            return (
              <div
                key={log.id || idx}
                className="flex items-start gap-2 leading-relaxed"
                style={{
                  color: isError
                    ? "#f87171"
                    : isWarn
                    ? "#fbbf24"
                    : isInput
                    ? "#93c5fd"
                    : "var(--text-color)",
                }}
              >
                {/* Prefix Icon */}
                <div className="flex-shrink-0 mt-0.5 opacity-60">
                  {isInput ? (
                    <span className="codicon codicon-chevron-right text-blue-400 text-[11px]" />
                  ) : isError ? (
                    <span className="codicon codicon-error text-red-400 text-[11px]" />
                  ) : isWarn ? (
                    <span className="codicon codicon-warning text-amber-400 text-[11px]" />
                  ) : isResult ? (
                    <span className="codicon codicon-arrow-small-right opacity-60 text-[11px]" />
                  ) : (
                    <span className="codicon codicon-info text-[11px]" />
                  )}
                </div>

                {/* Log Timestamp */}
                {log.timestamp && (
                  <span className="opacity-40 text-[10px] flex-shrink-0 select-none">
                    [{log.timestamp}]
                  </span>
                )}

                {/* Content Payload */}
                <div className="flex-1 min-w-0 break-words whitespace-pre-wrap">
                  {isResult && log.value !== undefined ? (
                    <DebugValueViewer value={log.value} />
                  ) : (
                    <span>{log.text || String(log.value)}</span>
                  )}
                </div>

                {/* Source File Location */}
                {log.source && (
                  <span className="text-[10px] opacity-40 flex-shrink-0 select-none truncate max-w-[120px]">
                    {log.source}
                  </span>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* REPL Input Line at Bottom */}
      <form
        onSubmit={handleExecute}
        className="border-t p-2 flex items-center gap-2 flex-shrink-0"
        style={{
          borderColor: "var(--panel-border-color)",
          backgroundColor: "var(--input-bg-color)",
        }}
      >
        <span className="codicon codicon-chevron-right text-blue-400 font-bold text-sm select-none" />
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Avaliar expressão (ex: 2 + 2, console.log(variavel))..."
          className="flex-1 bg-transparent border-none focus:outline-none text-xs font-mono"
          style={{ color: "var(--text-color)" }}
        />
        <button
          type="submit"
          disabled={!inputVal.trim()}
          className="px-2 py-0.5 text-[11px] font-bold border rounded disabled:opacity-30 hover:bg-black/10 transition-colors"
          style={{ borderColor: "var(--panel-border-color)" }}
        >
          Enter
        </button>
      </form>
    </div>
  );
}
