import React, { useState } from "react";

const FILE_TYPE_OPTIONS = [
  { label: "Todos", value: "" },
  { label: ".js / .jsx", value: "js" },
  { label: ".ts / .tsx", value: "ts" },
  { label: ".py", value: "py" },
  { label: ".java", value: "java" },
  { label: ".html", value: "html" },
  { label: ".css", value: "css" },
  { label: ".json", value: "json" },
  { label: ".md", value: "md" },
  { label: ".sh", value: "sh" },
];

export function HighlightedLine({ content, query, useRegex }) {
  if (!query) return <span>{content}</span>;
  try {
    const pattern = useRegex ? new RegExp(query, "gi") : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const parts = [];
    let lastIdx = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match.index > lastIdx) parts.push(<span key={lastIdx}>{content.slice(lastIdx, match.index)}</span>);
      parts.push(<mark key={match.index} style={{ backgroundColor: "var(--primary-color)", color: "var(--button-text-color)", borderRadius: "2px", padding: "0 1px" }}>{match[0]}</mark>);
      lastIdx = match.index + match[0].length;
      if (pattern.lastIndex === match.index) { pattern.lastIndex++; }
    }
    if (lastIdx < content.length) parts.push(<span key={lastIdx}>{content.slice(lastIdx)}</span>);
    return <>{parts}</>;
  } catch (_) {
    return <span>{content}</span>;
  }
}

function SearchModal({ isOpen, onClose, onSearch, results, onSelect }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState("");
  const [regexError, setRegexError] = useState(null);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (useRegex) {
      try { new RegExp(query); setRegexError(null); }
      catch (e) { setRegexError(e.message); return; }
    } else {
      setRegexError(null);
    }
    setLoading(true);
    await onSearch(query);
    setLoading(false);
  };

  const filteredResults = results.filter((r) => {
    if (fileTypeFilter) {
      const ext = r.path.split(".").pop().toLowerCase();
      const filterBase = fileTypeFilter.toLowerCase();
      if (filterBase === "js" && !["js", "jsx"].includes(ext)) return false;
      if (filterBase === "ts" && !["ts", "tsx"].includes(ext)) return false;
      if (!["js", "ts"].includes(filterBase) && ext !== filterBase) return false;
    }
    if (useRegex && query) {
      try {
        return new RegExp(query, "i").test(r.content);
      } catch (_) { return true; }
    }
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="p-6 w-full max-w-2xl h-[85vh] flex flex-col border-2 glass-panel neo-shadow"
        style={{
          backgroundColor: "var(--panel-bg-color)",
          borderColor: "var(--panel-border-color)",
          color: "var(--text-color)",
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2
            className="text-xl font-bold"
            style={{ color: "var(--primary-color)" }}
          >
            🔍 Busca Global
          </h2>
          <button onClick={onClose} className="text-xl font-bold hover:opacity-70 transition-opacity">
            &times;
          </button>
        </div>

        <div className="flex space-x-2 mb-3">
          <input
            id="search-modal-input"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setRegexError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={useRegex ? "Expressão regular..." : "Buscar em todos os arquivos..."}
            className="flex-grow p-3 border-2 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--input-bg-color)",
              borderColor: regexError ? "rgba(239,68,68,0.8)" : "var(--panel-border-color)",
              color: "var(--text-color)",
              "--tw-ring-color": "var(--primary-color)",
              fontFamily: useRegex ? "monospace" : "inherit",
            }}
          />
          <button
            id="search-modal-btn"
            onClick={handleSearch}
            className="px-6 py-2 border-2 font-bold neo-shadow-button"
            style={{
              backgroundColor: "var(--button-bg-color)",
              color: "var(--button-text-color)",
              borderColor: "var(--panel-border-color)",
            }}
          >
            Buscar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <button
            id="search-regex-toggle"
            onClick={() => { setUseRegex((v) => !v); setRegexError(null); }}
            title="Usar expressão regular"
            className="flex items-center gap-1.5 px-3 py-1.5 border-2 text-xs font-bold rounded transition-all"
            style={{
              backgroundColor: useRegex ? "var(--primary-color)" : "var(--input-bg-color)",
              color: useRegex ? "var(--button-text-color)" : "var(--text-muted-color)",
              borderColor: useRegex ? "var(--primary-color)" : "var(--panel-border-color)",
            }}
          >
            <span className="codicon codicon-regex" style={{ fontSize: 14 }} />
            Regex
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-muted-color)" }}>Tipo:</span>
            <select
              id="search-filetype-filter"
              value={fileTypeFilter}
              onChange={(e) => setFileTypeFilter(e.target.value)}
              className="border-2 px-2 py-1 text-xs focus:outline-none"
              style={{
                backgroundColor: "var(--input-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--text-color)",
              }}
            >
              {FILE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}
                  style={{ backgroundColor: "var(--panel-bg-color)", color: "var(--text-color)" }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {results.length > 0 && (
            <span className="text-xs ml-auto" style={{ color: "var(--text-muted-color)" }}>
              {filteredResults.length}/{results.length} resultado{results.length !== 1 ? "s" : ""}
              {fileTypeFilter || useRegex ? " (filtrado)" : ""}
            </span>
          )}
        </div>

        {regexError && (
          <div className="mb-2 px-3 py-1.5 text-xs border-2 rounded"
            style={{ borderColor: "rgba(239,68,68,0.5)", backgroundColor: "rgba(239,68,68,0.1)", color: "rgb(252,165,165)" }}>
            Regex inválido: {regexError}
          </div>
        )}

        <div className="flex-grow overflow-y-auto space-y-2 pr-2">
          {loading ? (
            <p className="text-center p-4">Buscando...</p>
          ) : (
            filteredResults.map((r, i) => (
              <div
                key={i}
                onClick={() => onSelect(r)}
                className="p-3 border-2 cursor-pointer hover:opacity-80 transition-opacity group"
                style={{
                  borderColor: "var(--panel-border-color)",
                  backgroundColor: "var(--input-bg-color)",
                }}
              >
                <div
                  className="font-bold text-sm mb-1 flex items-center gap-2"
                  style={{ color: "var(--primary-color)" }}
                >
                  <span className="codicon codicon-file" style={{ fontSize: 12 }} />
                  {r.path}
                  <span className="text-xs opacity-60 font-normal ml-auto">Linha {r.line}</span>
                </div>
                <div className="text-xs font-mono truncate opacity-80">
                  <HighlightedLine content={r.content} query={query} useRegex={useRegex} />
                </div>
              </div>
            ))
          )}
          {!loading && filteredResults.length === 0 && query && !regexError && (
            <p className="text-center p-4 opacity-60">
              Nenhum resultado encontrado.
            </p>
          )}
          {!loading && !query && (
            <p className="text-center p-8 opacity-40 text-sm">
              Digite um termo e pressione Enter ou clique em Buscar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchModal;
