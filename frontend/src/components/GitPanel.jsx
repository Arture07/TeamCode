import React, { useState, useEffect, useCallback } from "react";

/**
 * GitPanel — IDE-grade source control panel for TeamCode.
 * Supports Clone, Pull, Push, Checkout, Branch Creation, and Token Auth.
 * Communicates with sync-service's /api/git/{sessionId}/* REST endpoints.
 */
export default function GitPanel({ sessionId, getAuthHeaders, publishTreeEvent, loadTree }) {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [commits, setCommits] = useState([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [diffContent, setDiffContent] = useState("");
  const [diffFile, setDiffFile] = useState(null);
  const [activeTab, setActiveTab] = useState("changes"); // changes | log | diff
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // --- Advanced Git States ---
  const [gitToken, setGitToken] = useState(localStorage.getItem("teamcode-git-token") || "");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState("");
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

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

  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch(`/api/git/${sessionId}/branches`, { headers });
      const data = await res.json();
      if (data.initialized) {
        setBranches(data.branches ?? []);
        setCurrentBranch(data.currentBranch ?? "");
      }
    } catch (e) {
      console.error("Erro ao carregar branches:", e);
    }
  }, [sessionId]);

  // Load status and branches on mount
  useEffect(() => {
    const initLoad = async () => {
      await fetchStatus();
      await fetchBranches();
    };
    initLoad();
  }, [fetchStatus, fetchBranches]);

  // Sync branches when tab switches to changes/commits
  useEffect(() => {
    if (initialized) {
      fetchBranches();
    }
  }, [activeTab, initialized, fetchBranches]);

  // --- Helpers ---
  const triggerCollaborationReload = async (data) => {
    if (data.treeUpdated) {
      if (loadTree) await loadTree();
      if (publishTreeEvent) publishTreeEvent("reload", "", "");
    }
  };

  // --- Actions ---
  const handleSaveToken = () => {
    localStorage.setItem("teamcode-git-token", gitToken);
    setShowTokenInput(false);
    setSuccessMsg("Token Git salvo com sucesso!");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleInit = async () => {
    setActionLoading(true);
    setError(null);
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
        await fetchBranches();
      } else {
        setError(data.error || "Erro ao inicializar repositório");
      }
    } catch (e) {
      setError("Erro ao inicializar repositório");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClone = async () => {
    if (!cloneUrl.trim()) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg("Clonando repositório remoto...");
    try {
      const res = await fetch(`/api/git/${sessionId}/clone`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ url: cloneUrl, token: gitToken }),
      });
      const data = await res.json();
      if (data.success) {
        setCloneModalOpen(false);
        setCloneUrl("");
        setSuccessMsg("Repositório clonado com sucesso!");
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchStatus();
        await fetchBranches();
        await triggerCollaborationReload(data);
      } else {
        setError(data.error || "Erro ao clonar repositório");
        setSuccessMsg(null);
      }
    } catch (e) {
      setError("Erro ao clonar repositório");
      setSuccessMsg(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePull = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg("Sincronizando (Pull)...");
    try {
      const res = await fetch(`/api/git/${sessionId}/pull`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ token: gitToken }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Repositório atualizado (Pull com sucesso)!");
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchStatus();
        await triggerCollaborationReload(data);
      } else {
        setError(data.error || "Erro ao realizar Pull");
        setSuccessMsg(null);
      }
    } catch (e) {
      setError("Erro ao realizar Pull");
      setSuccessMsg(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePush = async () => {
    setActionLoading(true);
    setError(null);
    setSuccessMsg("Enviando alterações (Push)...");
    try {
      const res = await fetch(`/api/git/${sessionId}/push`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ branch: currentBranch, token: gitToken }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Código enviado com sucesso (Push concluído)!");
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchStatus();
      } else {
        setError(data.error || "Erro ao realizar Push");
        setSuccessMsg(null);
      }
    } catch (e) {
      setError("Erro ao realizar Push");
      setSuccessMsg(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckout = async (branchName, create = false) => {
    setActionLoading(true);
    setError(null);
    setShowBranchDropdown(false);
    setSuccessMsg(create ? `Criando branch ${branchName}...` : `Alternando para ${branchName}...`);
    try {
      const res = await fetch(`/api/git/${sessionId}/checkout`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ branch: branchName, create }),
      });
      const data = await res.json();
      if (data.success) {
        setBranchModalOpen(false);
        setNewBranchName("");
        setSuccessMsg(`Switched to branch: ${branchName}`);
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchStatus();
        await fetchBranches();
        await triggerCollaborationReload(data);
      } else {
        setError(data.error || "Erro no Checkout");
        setSuccessMsg(null);
      }
    } catch (e) {
      setError("Erro no Checkout");
      setSuccessMsg(null);
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
    position: "relative",
  };

  const headerStyle = {
    padding: "8px 12px",
    borderBottom: "1px solid var(--panel-border-color)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  };

  const toolbarStyle = {
    padding: "6px 12px",
    borderBottom: "1px solid var(--panel-border-color)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "var(--header-bg-color)",
    gap: "6px",
    flexShrink: 0,
  };

  const toolbarButtonStyle = {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "var(--text-color)",
    padding: "4px 8px",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    borderRadius: "4px",
    transition: "background 0.15s",
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

  const modalBackdropStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(4px)",
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  };

  const modalContentStyle = {
    backgroundColor: "var(--panel-bg-color)",
    border: "2px solid var(--panel-border-color)",
    padding: "16px",
    width: "100%",
    maxWidth: "320px",
    borderRadius: "8px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
  };

  // --- Render: Loading ---
  if (loading) {
    return (
      <div style={panelStyle}>
        <div style={{ ...headerStyle, justifyContent: "center" }}>
          <span style={{ color: "var(--text-muted-color)" }}>Carregando...</span>
        </div>
      </div>
    );
  }

  // --- Render: Not initialized ---
  if (!initialized) {
    return (
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span className="font-bold" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="codicon codicon-source-control" style={{ fontSize: 16 }} />
            Source Control
          </span>
          <button
            onClick={() => setCloneModalOpen(true)}
            style={{ ...toolbarButtonStyle, border: "1px solid var(--panel-border-color)" }}
            title="Clonar repositório remoto"
          >
            <span className="codicon codicon-repo-clone" />
            <span>Clonar</span>
          </button>
        </div>

        {/* Git Auth settings toggle */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--panel-border-color)", backgroundColor: "var(--header-bg-color)" }}>
          <button
            onClick={() => setShowTokenInput(!showTokenInput)}
            style={{ background: "transparent", border: "none", color: "var(--primary-color)", fontSize: "11px", cursor: "pointer", textDecoration: "underline" }}
          >
            {showTokenInput ? "Ocultar chaves de autenticação" : "Configurar Token GitHub/GitLab"}
          </button>
        </div>

        {showTokenInput && (
          <div style={{ padding: "12px", borderBottom: "1px solid var(--panel-border-color)", backgroundColor: "var(--input-bg-color)", display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "11px", fontWeight: "bold" }}>Git Personal Access Token (PAT):</label>
            <input
              type="password"
              value={gitToken}
              onChange={(e) => setGitToken(e.target.value)}
              placeholder="ghp_xxxxxxxx ou glpat-xxxxxx"
              style={{ padding: "6px", backgroundColor: "var(--panel-bg-color)", border: "1px solid var(--panel-border-color)", color: "var(--text-color)", fontSize: "12px", outline: "none" }}
            />
            <button
              onClick={handleSaveToken}
              className="neo-shadow-button"
              style={{ padding: "6px", backgroundColor: "var(--button-bg-color)", color: "var(--button-text-color)", border: "1px solid var(--panel-border-color)", fontWeight: "bold", cursor: "pointer" }}
            >
              Salvar Token
            </button>
          </div>
        )}

        {/* Messages */}
        {successMsg && <div style={{ padding: "8px 12px", backgroundColor: "rgba(115,201,145,0.1)", color: "#73c991", borderBottom: "1px solid var(--panel-border-color)" }}>{successMsg}</div>}
        {error && <div style={{ padding: "8px 12px", backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", borderBottom: "1px solid var(--panel-border-color)" }}>{error}</div>}

        <div style={{ padding: 20, textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ color: "var(--text-muted-color)", lineHeight: 1.5 }}>
            Esta sessão não tem um repositório Git. Você pode inicializar um local ou clonar um remoto.
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
            {actionLoading ? "Inicializando..." : "Inicializar Repositório Local"}
          </button>
          
          <button
            onClick={() => setCloneModalOpen(true)}
            disabled={actionLoading}
            className="neo-shadow-button"
            style={{
              padding: "10px 24px",
              backgroundColor: "transparent",
              color: "var(--text-color)",
              border: "2px solid var(--panel-border-color)",
              fontWeight: "bold",
              cursor: "pointer",
              opacity: actionLoading ? 0.5 : 1,
            }}
          >
            Clonar Repositório Remoto
          </button>
        </div>

        {/* Modal: Clone */}
        {cloneModalOpen && (
          <div style={modalBackdropStyle}>
            <div style={modalContentStyle}>
              <h3 style={{ margin: "0 0 12px 0", fontWeight: "bold" }}>Clonar Repositório</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "11px", display: "block", marginBottom: "4px" }}>URL do Git (.git):</label>
                  <input
                    type="text"
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                    placeholder="https://github.com/usuario/repo.git"
                    style={{ width: "100%", padding: "6px", backgroundColor: "var(--input-bg-color)", border: "1px solid var(--panel-border-color)", color: "var(--text-color)", fontSize: "12px", outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", display: "block", marginBottom: "4px" }}>Token Git (PAT): <span style={{ opacity: 0.6 }}>(para repos privados)</span></label>
                  <input
                    type="password"
                    value={gitToken}
                    onChange={(e) => setGitToken(e.target.value)}
                    placeholder="Deixe em branco se público"
                    style={{ width: "100%", padding: "6px", backgroundColor: "var(--input-bg-color)", border: "1px solid var(--panel-border-color)", color: "var(--text-color)", fontSize: "12px", outline: "none" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  <button
                    onClick={handleClone}
                    disabled={actionLoading || !cloneUrl.trim()}
                    className="neo-shadow-button"
                    style={{ flex: 1, padding: "8px", backgroundColor: "var(--button-bg-color)", color: "var(--button-text-color)", border: "1px solid var(--panel-border-color)", fontWeight: "bold", cursor: "pointer", opacity: actionLoading || !cloneUrl.trim() ? 0.6 : 1 }}
                  >
                    Clonar
                  </button>
                  <button
                    onClick={() => { setCloneModalOpen(false); setCloneUrl(""); }}
                    className="neo-shadow-button"
                    style={{ flex: 1, padding: "8px", backgroundColor: "transparent", color: "var(--text-color)", border: "1px solid var(--panel-border-color)", fontWeight: "bold", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Render: Main Panel ---
  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span className="font-bold" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="codicon codicon-source-control" style={{ fontSize: 16 }} />
          Source Control
        </span>
        <button
          onClick={() => setShowTokenInput(!showTokenInput)}
          style={{ background: "transparent", border: "none", color: "var(--primary-color)", fontSize: "11px", cursor: "pointer" }}
          title="Configurar autenticação Git"
        >
          <span className="codicon codicon-key" />
        </button>
      </div>

      {/* Toolbar / IDE Buttons */}
      <div style={toolbarStyle}>
        {/* Branch Selector */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowBranchDropdown(!showBranchDropdown)}
            style={{ ...toolbarButtonStyle, border: "1px solid var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}
            title="Alternar branch"
          >
            <span className="codicon codicon-git-branch" style={{ color: "var(--primary-color)" }} />
            <span style={{ fontWeight: "bold" }}>{currentBranch || "Desconhecido"}</span>
            <span className="codicon codicon-chevron-down" style={{ fontSize: 9 }} />
          </button>
          
          {showBranchDropdown && (
            <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", backgroundColor: "var(--panel-bg-color)", border: "2px solid var(--panel-border-color)", borderRadius: "4px", zIndex: 20, width: "180px", boxShadow: "0 4px 15px rgba(0,0,0,0.5)", overflow: "hidden" }}>
              <div style={{ padding: "6px 8px", fontSize: "10px", fontWeight: "bold", borderBottom: "1px solid var(--panel-border-color)", color: "var(--text-muted-color)" }}>BRANCHES LOCAIS</div>
              <div style={{ maxHeight: "150px", overflow: "auto" }}>
                {branches.map((b) => (
                  <button
                    key={b}
                    onClick={() => handleCheckout(b)}
                    style={{ width: "100%", textAlign: "left", padding: "6px 12px", border: "none", background: b === currentBranch ? "var(--primary-bg-color)" : "transparent", color: "var(--text-color)", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    <span className="codicon codicon-git-branch" style={{ fontSize: 12, opacity: b === currentBranch ? 1 : 0.4 }} />
                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{b}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setBranchModalOpen(true); setShowBranchDropdown(false); }}
                style={{ width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderTop: "1px solid var(--panel-border-color)", backgroundColor: "var(--header-bg-color)", color: "var(--primary-color)", fontWeight: "bold", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <span className="codicon codicon-add" />
                <span>Nova Branch...</span>
              </button>
            </div>
          )}
        </div>

        {/* Remote Sync controls */}
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={handlePull}
            disabled={actionLoading}
            style={toolbarButtonStyle}
            title="Puxar alterações do remote (Pull)"
          >
            <span className="codicon codicon-cloud-download" />
            <span>Pull</span>
          </button>
          <button
            onClick={handlePush}
            disabled={actionLoading}
            style={toolbarButtonStyle}
            title="Enviar alterações ao remote (Push)"
          >
            <span className="codicon codicon-cloud-upload" />
            <span>Push</span>
          </button>
        </div>
      </div>

      {/* Auth Settings Panel inline */}
      {showTokenInput && (
        <div style={{ padding: "12px", borderBottom: "1px solid var(--panel-border-color)", backgroundColor: "var(--input-bg-color)", display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0 }}>
          <label style={{ fontSize: "11px", fontWeight: "bold" }}>Git Personal Access Token (PAT):</label>
          <input
            type="password"
            value={gitToken}
            onChange={(e) => setGitToken(e.target.value)}
            placeholder="ghp_xxxxxxxx ou glpat-xxxxxx"
            style={{ padding: "6px", backgroundColor: "var(--panel-bg-color)", border: "1px solid var(--panel-border-color)", color: "var(--text-color)", fontSize: "12px", outline: "none" }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleSaveToken}
              className="neo-shadow-button"
              style={{ flex: 1, padding: "6px", backgroundColor: "var(--button-bg-color)", color: "var(--button-text-color)", border: "1px solid var(--panel-border-color)", fontWeight: "bold", cursor: "pointer" }}
            >
              Salvar
            </button>
            <button
              onClick={() => setShowTokenInput(false)}
              className="neo-shadow-button"
              style={{ flex: 1, padding: "6px", backgroundColor: "transparent", color: "var(--text-color)", border: "1px solid var(--panel-border-color)", fontWeight: "bold", cursor: "pointer" }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Commit Input Area */}
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--panel-border-color)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Mensagem de commit (Ctrl+Enter para commit)"
            onKeyDown={(e) => e.key === "Enter" && !e.ctrlKey && handleCommit()}
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
            title="Commit Local"
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

      {/* Success / Error Messages */}
      {successMsg && (
        <div style={{
          padding: "6px 12px",
          backgroundColor: "rgba(115, 201, 145, 0.1)",
          color: "#73c991",
          fontSize: 12,
          borderBottom: "1px solid var(--panel-border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: "none", border: "none", color: "#73c991", cursor: "pointer" }}>✕</button>
        </div>
      )}
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

      {/* Content Area */}
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

      {/* Modal Dialog: Nova Branch */}
      {branchModalOpen && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ margin: "0 0 12px 0", fontWeight: "bold" }}>Criar Nova Branch</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="nome-da-nova-branch"
                style={{ width: "100%", padding: "6px", backgroundColor: "var(--input-bg-color)", border: "1px solid var(--panel-border-color)", color: "var(--text-color)", fontSize: "12px", outline: "none" }}
              />
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  onClick={() => handleCheckout(newBranchName, true)}
                  disabled={actionLoading || !newBranchName.trim()}
                  className="neo-shadow-button"
                  style={{ flex: 1, padding: "8px", backgroundColor: "var(--button-bg-color)", color: "var(--button-text-color)", border: "1px solid var(--panel-border-color)", fontWeight: "bold", cursor: "pointer", opacity: actionLoading || !newBranchName.trim() ? 0.6 : 1 }}
                >
                  Criar e Alternar
                </button>
                <button
                  onClick={() => { setBranchModalOpen(false); setNewBranchName(""); }}
                  className="neo-shadow-button"
                  style={{ flex: 1, padding: "8px", backgroundColor: "transparent", color: "var(--text-color)", border: "1px solid var(--panel-border-color)", fontWeight: "bold", cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Clone (When Repo initialized already but you still want to clone over it) */}
      {cloneModalOpen && (
        <div style={modalBackdropStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ margin: "0 0 12px 0", fontWeight: "bold" }}>Clonar Repositório</h3>
            <p style={{ fontSize: "11px", color: "var(--text-muted-color)", marginBottom: "8px", lineHeight: "1.4" }}>
              ⚠️ Isto irá **limpar** e sobrescrever todos os arquivos da sessão atual com o remote!
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", display: "block", marginBottom: "4px" }}>URL do Git (.git):</label>
                <input
                  type="text"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  placeholder="https://github.com/usuario/repo.git"
                  style={{ width: "100%", padding: "6px", backgroundColor: "var(--input-bg-color)", border: "1px solid var(--panel-border-color)", color: "var(--text-color)", fontSize: "12px", outline: "none" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", display: "block", marginBottom: "4px" }}>Token Git (PAT):</label>
                <input
                  type="password"
                  value={gitToken}
                  onChange={(e) => setGitToken(e.target.value)}
                  placeholder="Deixe em branco se público"
                  style={{ width: "100%", padding: "6px", backgroundColor: "var(--input-bg-color)", border: "1px solid var(--panel-border-color)", color: "var(--text-color)", fontSize: "12px", outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button
                  onClick={handleClone}
                  disabled={actionLoading || !cloneUrl.trim()}
                  className="neo-shadow-button"
                  style={{ flex: 1, padding: "8px", backgroundColor: "var(--button-bg-color)", color: "var(--button-text-color)", border: "1px solid var(--panel-border-color)", fontWeight: "bold", cursor: "pointer", opacity: actionLoading || !cloneUrl.trim() ? 0.6 : 1 }}
                >
                  Confirmar Clone
                </button>
                <button
                  onClick={() => { setCloneModalOpen(false); setCloneUrl(""); }}
                  className="neo-shadow-button"
                  style={{ flex: 1, padding: "8px", backgroundColor: "transparent", color: "var(--text-color)", border: "1px solid var(--panel-border-color)", fontWeight: "bold", cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
