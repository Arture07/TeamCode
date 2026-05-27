import React, { useState, useEffect, useCallback } from "react";

/**
 * GitPanel — VS Code-style source control panel for TeamCode.
 * Communicates with sync-service's /api/git/{sessionId}/* REST endpoints.
 */
export default function GitPanel({ sessionId, getAuthHeaders }) {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [commits, setCommits] = useState([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [diffContent, setDiffContent] = useState("");
  const [diffFile, setDiffFile] = useState(null);
  const [activeTab, setActiveTab] = useState("changes"); // changes | log | diff
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const headers = getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json" };

  // --- API Calls ---
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/git/${sessionId}/status`, { headers });
      const data = await res.json();
      setInitialized(data.initialized ?? false);
      setFiles(data.files ?? []);
      setError(null);
    } catch (e) {
      setError("Erro ao obter status git");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/git/${sessionId}/log?limit=20`, { headers });
      const data = await res.json();
      setCommits(data.commits ?? []);
    } catch (e) {
      setError("Erro ao obter log");
    }
  }, [sessionId]);

  const fetchDiff = useCallback(async (filePath = null) => {
    try {
      let url = `/api/git/${sessionId}/diff`;
      if (filePath) url += `?file=${encodeURIComponent(filePath)}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      setDiffContent(data.diff ?? "");
      setDiffFile(filePath);
      setActiveTab("diff");
    } catch (e) {
      setError("Erro ao obter diff");
    }
  }, [sessionId]);

  // Load status on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // --- Actions ---
  const handleInit = async () => {
    setActionLoading(true);
    try {
      const username = localStorage.getItem("username") || "TeamCode User";
      const res = await fetch(`/api/git/${sessionId}/init`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.success) {
        setInitialized(true);
        await fetchStatus();
      } else {
        setError(data.error || "Erro ao inicializar repositório");
      }
    } catch (e) {
      setError("Erro ao inicializar repositório");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStageAll = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/git/${sessionId}/add`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await fetchStatus();
    } catch (e) {
      setError("Erro ao stage ficheiros");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStageFile = async (filePath) => {
    setActionLoading(true);
    try {
      await fetch(`/api/git/${sessionId}/add`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ files: [filePath] }),
      });
      await fetchStatus();
    } catch (e) {
      setError("Erro ao stage ficheiro");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setActionLoading(true);
    try {
      const username = localStorage.getItem("username") || "TeamCode User";
      const res = await fetch(`/api/git/${sessionId}/commit`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ message: commitMessage, username }),
      });
      const data = await res.json();
      if (data.success) {
        setCommitMessage("");
        await fetchStatus();
        await fetchLog();
      } else {
        setError(data.message || "Nada para commit");
      }
    } catch (e) {
      setError("Erro ao criar commit");
    } finally {
      setActionLoading(false);
    }
  };

  // --- Status icon helpers ---
  const statusIcon = (status) => {
    switch (status) {
      case "modified": return { letter: "M", color: "#e2b93d" };
      case "added": return { letter: "A", color: "#73c991" };
      case "deleted": return { letter: "D", color: "#f14c4c" };
      case "untracked": return { letter: "U", color: "#73c991" };
      case "renamed": return { letter: "R", color: "#73c991" };
      default: return { letter: "?", color: "#858585" };
    }
  };

  // --- Styles ---
  const panelStyle = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    color: "var(--text-color)",
    fontSize: "13px",
    overflow: "hidden",
  };

  const headerStyle = {
    padding: "8px 12px",
    borderBottom: "1px solid var(--panel-border-color)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  };

  const tabBarStyle = {
    display: "flex",
    borderBottom: "1px solid var(--panel-border-color)",
    flexShrink: 0,
  };

  const tabStyle = (isActive) => ({
    padding: "6px 14px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: isActive ? "bold" : "normal",
    color: isActive ? "var(--primary-color)" : "var(--text-muted-color)",
    borderBottom: isActive ? "2px solid var(--primary-color)" : "2px solid transparent",
    background: "transparent",
    border: "none",
    transition: "all 0.15s",
  });

  const fileItemStyle = {
    display: "flex",
    alignItems: "center",
    padding: "4px 12px",
    cursor: "pointer",
    transition: "background 0.1s",
    gap: "8px",
  };

  // --- Render: Not initialized ---
  if (loading) {
    return (
      <div style={panelStyle}>
        <div style={{ ...headerStyle, justifyContent: "center" }}>
          <span style={{ color: "var(--text-muted-color)" }}>Carregando...</span>
        </div>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span className="font-bold" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="codicon codicon-source-control" style={{ fontSize: 16 }} />
            Source Control
          </span>
        </div>
        <div style={{ padding: 20, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted-color)", marginBottom: 16, lineHeight: 1.5 }}>
            Esta sessão não tem um repositório Git inicializado.
          </p>
          <button
            onClick={handleInit}
            disabled={actionLoading}
            className="neo-shadow-button"
            style={{
              padding: "10px 24px",
              backgroundColor: "var(--button-bg-color)",
              color: "var(--button-text-color)",
              border: "2px solid var(--panel-border-color)",
              fontWeight: "bold",
              cursor: "pointer",
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            {actionLoading ? "Inicializando..." : "Inicializar Repositório"}
          </button>
        </div>
      </div>
    );
  }

  // --- Render: Main panel ---
  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span className="font-bold" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="codicon codicon-source-control" style={{ fontSize: 16 }} />
          Source Control
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={fetchStatus}
            title="Refresh"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted-color)",
              padding: 4,
            }}
          >
            <span className="codicon codicon-refresh" style={{ fontSize: 14 }} />
          </button>
          <button
            onClick={handleStageAll}
            disabled={actionLoading}
            title="Stage All"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted-color)",
              padding: 4,
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            <span className="codicon codicon-add" style={{ fontSize: 14 }} />
          </button>
        </div>
      </div>

      {/* Commit input */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--panel-border-color)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Mensagem de commit"
            onKeyDown={(e) => e.key === "Enter" && handleCommit()}
            style={{
              flex: 1,
              padding: "6px 10px",
              backgroundColor: "var(--input-bg-color)",
              border: "1px solid var(--panel-border-color)",
              color: "var(--text-color)",
              fontSize: 12,
              outline: "none",
            }}
          />
          <button
            onClick={handleCommit}
            disabled={actionLoading || !commitMessage.trim()}
            title="Commit"
            className="neo-shadow-button"
            style={{
              padding: "6px 12px",
              backgroundColor: "var(--button-bg-color)",
              color: "var(--button-text-color)",
              border: "1px solid var(--panel-border-color)",
              fontWeight: "bold",
              fontSize: 12,
              cursor: "pointer",
              opacity: actionLoading || !commitMessage.trim() ? 0.5 : 1,
            }}
          >
            <span className="codicon codicon-check" style={{ fontSize: 14 }} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        <button style={tabStyle(activeTab === "changes")} onClick={() => { setActiveTab("changes"); fetchStatus(); }}>
          Changes {files.length > 0 && <span style={{ marginLeft: 4, opacity: 0.7 }}>({files.length})</span>}
        </button>
        <button style={tabStyle(activeTab === "log")} onClick={() => { setActiveTab("log"); fetchLog(); }}>
          Commits
        </button>
        <button style={tabStyle(activeTab === "diff")} onClick={() => setActiveTab("diff")}>
          Diff
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div style={{
          padding: "6px 12px",
          backgroundColor: "rgba(239, 68, 68, 0.1)",
          color: "#f87171",
          fontSize: 12,
          borderBottom: "1px solid var(--panel-border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "changes" && (
          <div>
            {files.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted-color)" }}>
                Nenhuma alteração detectada
              </div>
            ) : (
              files.map((f, i) => {
                const icon = statusIcon(f.status);
                return (
                  <div
                    key={f.path + i}
                    style={fileItemStyle}
                    className="git-file-item"
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--input-bg-color)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 3,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: "bold",
                        color: icon.color,
                        flexShrink: 0,
                      }}
                    >
                      {icon.letter}
                    </span>
                    <span
                      style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}
                      onClick={() => fetchDiff(f.path)}
                      title={`Clique para ver diff: ${f.path}`}
                    >
                      {f.path}
                    </span>
                    <button
                      onClick={() => handleStageFile(f.path)}
                      disabled={actionLoading}
                      title="Stage this file"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted-color)",
                        padding: "2px 4px",
                        flexShrink: 0,
                        opacity: actionLoading ? 0.5 : 1,
                      }}
                    >
                      <span className="codicon codicon-add" style={{ fontSize: 12 }} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "log" && (
          <div>
            {commits.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted-color)" }}>
                Nenhum commit encontrado
              </div>
            ) : (
              commits.map((c, i) => (
                <div
                  key={c.hash || i}
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--panel-border-color)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--input-bg-color)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--primary-color)", fontWeight: "bold" }}>
                      {c.shortHash}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-muted-color)" }}>
                      {c.relativeDate}
                    </span>
                  </div>
                  <div style={{ fontSize: 12 }}>{c.message}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted-color)", marginTop: 2 }}>
                    {c.author}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "diff" && (
          <div style={{ padding: 0 }}>
            {diffFile && (
              <div style={{
                padding: "6px 12px",
                backgroundColor: "var(--input-bg-color)",
                borderBottom: "1px solid var(--panel-border-color)",
                fontSize: 12,
                fontWeight: "bold",
              }}>
                {diffFile}
              </div>
            )}
            {diffContent ? (
              <pre style={{
                margin: 0,
                padding: 12,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontSize: 12,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}>
                {diffContent.split("\n").map((line, i) => {
                  let color = "var(--text-color)";
                  let bg = "transparent";
                  if (line.startsWith("+") && !line.startsWith("+++")) {
                    color = "#73c991";
                    bg = "rgba(115, 201, 145, 0.08)";
                  } else if (line.startsWith("-") && !line.startsWith("---")) {
                    color = "#f14c4c";
                    bg = "rgba(241, 76, 76, 0.08)";
                  } else if (line.startsWith("@@")) {
                    color = "#569cd6";
                  } else if (line.startsWith("diff ") || line.startsWith("index ")) {
                    color = "var(--text-muted-color)";
                  }
                  return (
                    <div key={i} style={{ color, backgroundColor: bg, padding: "0 4px" }}>
                      {line}
                    </div>
                  );
                })}
              </pre>
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted-color)" }}>
                {diffFile ? "Nenhuma diferença encontrada" : "Clique num ficheiro para ver o diff"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
