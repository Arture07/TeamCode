import React, { useState, useEffect, useCallback } from "react";

/**
 * GitPanel — IDE-grade source control panel for TeamCode.
 * Designed with VS Code / Antigravity ergonomics:
 * - Staged Changes vs Changes (Unstaged) accordions
 * - Primary "✓ Commit" and "Commit & Push" actions
 * - Real-time auto-refresh on file edits / saves
 * - Integrates with central Monaco DiffEditor & Editor tabs
 * - Interactive Git Commit Graph tree with expandable commit diffs
 * - Dedicated PAT Auth Modal for GitHub/GitLab
 * - 100% Codicons (Zero Emojis)
 */
export default function GitPanel({
  sessionId,
  getAuthHeaders,
  publishTreeEvent,
  loadTree,
  onOpenDiff,
  onOpenCommitDiff,
  onOpenFile,
  refreshTrigger,
}) {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [unstagedFiles, setUnstagedFiles] = useState([]);
  const [commits, setCommits] = useState([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Accordion open/close states
  const [stagedOpen, setStagedOpen] = useState(true);
  const [changesOpen, setChangesOpen] = useState(true);
  const [graphOpen, setGraphOpen] = useState(true);

  // Commit inspection in Graph
  const [selectedCommitHash, setSelectedCommitHash] = useState(null);
  const [commitDetailsMap, setCommitDetailsMap] = useState({});

  // Advanced Git & Auth states
  const [gitToken, setGitToken] = useState(localStorage.getItem("teamcode-git-token") || "");
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState("");
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [discardConfirmFile, setDiscardConfirmFile] = useState(null);
  const [isGeneratingAiMsg, setIsGeneratingAiMsg] = useState(false);

  const headers = getAuthHeaders ? getAuthHeaders() : { "Content-Type": "application/json" };

  // --- Keyboard Shortcuts (Escape to close modals) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setCloneModalOpen(false);
        setBranchModalOpen(false);
        setTokenModalOpen(false);
        setShowBranchDropdown(false);
        setDiscardConfirmFile(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- API Calls ---
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/git/${sessionId}/status`, { headers });
      const data = await res.json();
      setInitialized(data.initialized ?? false);
      setStagedFiles(data.stagedFiles ?? []);
      setUnstagedFiles(data.unstagedFiles ?? []);
      setError(null);
    } catch (e) {
      console.warn("Erro ao obter status git:", e);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/git/${sessionId}/log?limit=30`, { headers });
      const data = await res.json();
      setCommits(data.commits ?? []);
    } catch (e) {
      console.warn("Erro ao obter log:", e);
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
      console.warn("Erro ao carregar branches:", e);
    }
  }, [sessionId]);

  // Load everything on mount
  useEffect(() => {
    const initLoad = async () => {
      await fetchStatus();
      await fetchBranches();
      await fetchLog();
    };
    initLoad();
  }, [fetchStatus, fetchBranches, fetchLog]);

  // Auto-refresh status whenever user modifies files in Monaco editor
  useEffect(() => {
    if (refreshTrigger > 0 && initialized) {
      fetchStatus();
    }
  }, [refreshTrigger, initialized, fetchStatus]);

  const triggerCollaborationReload = async (data) => {
    if (data && data.treeUpdated) {
      if (loadTree) await loadTree();
      if (publishTreeEvent) publishTreeEvent("reload", "", "");
    }
  };

  // --- Actions ---
  const handleSaveToken = (close = true) => {
    localStorage.setItem("teamcode-git-token", gitToken.trim());
    if (close) {
      setTokenModalOpen(false);
      setSuccessMsg("Token Git salvo com sucesso!");
      setTimeout(() => setSuccessMsg(null), 3000);
    }
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
        await fetchLog();
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
        body: JSON.stringify({ url: cloneUrl.trim(), token: gitToken.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setCloneModalOpen(false);
        setCloneUrl("");
        setSuccessMsg("Repositório clonado com sucesso!");
        setTimeout(() => setSuccessMsg(null), 4000);
        await fetchStatus();
        await fetchBranches();
        await fetchLog();
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
    setSuccessMsg("Sincronizando com o remote (Pull)...");
    try {
      const res = await fetch(`/api/git/${sessionId}/pull`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ token: gitToken.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Repositório atualizado com sucesso!");
        setTimeout(() => setSuccessMsg(null), 3000);
        await fetchStatus();
        await fetchLog();
        await triggerCollaborationReload(data);
      } else {
        if (data.requiresAuth) {
          setTokenModalOpen(true);
        }
        setError(data.error || "Erro ao realizar Pull");
        setSuccessMsg(null);
      }
    } catch (e) {
      setError("Erro de rede ao realizar Pull");
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
        body: JSON.stringify({ branch: currentBranch, token: gitToken.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.upToDate) {
          setSuccessMsg("Tudo atualizado: nenhum commit novo pendente para enviar.");
        } else {
          setSuccessMsg("Commits enviados com sucesso ao GitHub!");
        }
        setTimeout(() => setSuccessMsg(null), 3500);
        await fetchStatus();
        await fetchLog();
      } else {
        if (data.requiresAuth) {
          setTokenModalOpen(true);
        }
        setError(data.error || "Erro ao realizar Push");
        setSuccessMsg(null);
      }
    } catch (e) {
      setError("Erro de rede ao realizar Push");
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
        setSuccessMsg(`Branch ativa: ${branchName}`);
        setTimeout(() => setSuccessMsg(null), 3000);
        await fetchStatus();
        await fetchBranches();
        await fetchLog();
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
      setError("Erro ao preparar arquivos (Stage All)");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStageFile = async (filePath, e) => {
    if (e) e.stopPropagation();
    setActionLoading(true);
    try {
      await fetch(`/api/git/${sessionId}/add`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ files: [filePath] }),
      });
      await fetchStatus();
      if (onOpenDiff) onOpenDiff({ path: filePath, isStaged: true });
    } catch (e) {
      setError("Erro ao preparar arquivo");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnstageAll = async () => {
    setActionLoading(true);
    try {
      await fetch(`/api/git/${sessionId}/unstage`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await fetchStatus();
    } catch (e) {
      setError("Erro ao desmarcar arquivos (Unstage All)");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnstageFile = async (filePath, e) => {
    if (e) e.stopPropagation();
    setActionLoading(true);
    try {
      await fetch(`/api/git/${sessionId}/unstage`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ files: [filePath] }),
      });
      await fetchStatus();
      if (onOpenDiff) onOpenDiff({ path: filePath, isStaged: false });
    } catch (e) {
      setError("Erro ao desmarcar arquivo");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDiscardFiles = async (files = null) => {
    setActionLoading(true);
    setError(null);
    try {
      const body = files ? { files } : {};
      const res = await fetch(`/api/git/${sessionId}/discard`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setDiscardConfirmFile(null);
        await fetchStatus();
        await triggerCollaborationReload(data);
      } else {
        setError(data.error || "Erro ao descartar alterações");
      }
    } catch (e) {
      setError("Erro ao descartar alterações");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCommit = async (andPush = false) => {
    if (!commitMessage.trim()) {
      setError("Por favor, digite uma mensagem de commit.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      // Se nada estiver no stage mas houver arquivos alterados, prepara tudo automaticamente
      if (stagedFiles.length === 0 && unstagedFiles.length > 0) {
        await fetch(`/api/git/${sessionId}/add`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      }

      const username = localStorage.getItem("username") || "TeamCode User";
      const res = await fetch(`/api/git/${sessionId}/commit`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ message: commitMessage.trim(), username }),
      });
      const data = await res.json();
      if (data.success) {
        setCommitMessage("");
        setSuccessMsg("Commit realizado com sucesso!");
        setTimeout(() => setSuccessMsg(null), 2500);
        await fetchStatus();
        await fetchLog();
        if (andPush) {
          await handlePush();
        }
      } else {
        setError(data.error || data.message || "Erro ao criar commit");
      }
    } catch (e) {
      setError("Erro ao criar commit: " + (e.message || e));
    } finally {
      setActionLoading(false);
    }
  };

  // Click on a commit node in the graph to expand modified files
  const handleCommitClick = async (commit) => {
    if (selectedCommitHash === commit.hash) {
      setSelectedCommitHash(null);
      return;
    }

    setSelectedCommitHash(commit.hash);
    if (!commitDetailsMap[commit.hash]) {
      setCommitDetailsMap((prev) => ({
        ...prev,
        [commit.hash]: { loading: true, files: [], parentHash: "" },
      }));

      try {
        const res = await fetch(`/api/git/${sessionId}/commit-details?hash=${encodeURIComponent(commit.hash)}`, { headers });
        const data = await res.json();
        setCommitDetailsMap((prev) => ({
          ...prev,
          [commit.hash]: {
            loading: false,
            files: data.files || [],
            parentHash: data.parentHash || "",
          },
        }));
      } catch (e) {
        console.error("Erro ao carregar detalhes do commit:", e);
        setCommitDetailsMap((prev) => ({
          ...prev,
          [commit.hash]: { loading: false, files: [], parentHash: "" },
        }));
      }
    }
  };

  // Generate Commit Message with Gemini AI
  const handleGenerateAiCommitMessage = async () => {
    setIsGeneratingAiMsg(true);
    setError(null);
    try {
      const diffRes = await fetch(`/api/git/${sessionId}/diff`, { headers });
      const diffData = await diffRes.json();
      const rawDiff = diffData.diff || "";

      if (!rawDiff.trim()) {
        setCommitMessage("chore: update files");
        setIsGeneratingAiMsg(false);
        return;
      }

      const prompt = `Gere uma mensagem de commit concisa seguindo a convenção Conventional Commits (ex: feat:, fix:, chore:, refactor:) para o seguinte git diff:\n\n${rawDiff.substring(0, 3000)}\n\nResponda APENAS com a mensagem de commit em uma única linha, sem aspas e sem explicações.`;

      const aiRes = await fetch(`/api/ai/chat`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          prompt,
          currentFile: "",
          fileContent: "",
        }),
      });

      if (aiRes.ok) {
        const text = await aiRes.text();
        const cleanMsg = text.replace(/["`]/g, "").trim().split("\n")[0];
        if (cleanMsg) setCommitMessage(cleanMsg);
      }
    } catch (e) {
      console.error("Falha na geração de mensagem IA:", e);
    } finally {
      setIsGeneratingAiMsg(false);
    }
  };

  const handleFileItemClick = (filePath, isStaged) => {
    if (onOpenDiff) {
      onOpenDiff({ path: filePath, isStaged });
    } else if (onOpenFile) {
      onOpenFile(filePath);
    }
  };

  // Helper to split filename and directory path for VS Code look
  const splitPath = (fullPath) => {
    const parts = fullPath.split("/");
    const fileName = parts.pop() || fullPath;
    const dirPath = parts.join("/");
    return { fileName, dirPath };
  };

  const getStatusBadge = (statusCode, status) => {
    const code = statusCode ? statusCode.trim() : "";
    if (code === "M" || status === "modified") {
      return <span className="font-bold text-xs" style={{ color: "#e2b93d" }}>M</span>;
    }
    if (code === "A" || status === "added") {
      return <span className="font-bold text-xs" style={{ color: "#73c991" }}>A</span>;
    }
    if (code === "D" || status === "deleted") {
      return <span className="font-bold text-xs" style={{ color: "#f14c4c" }}>D</span>;
    }
    if (code === "U" || status === "untracked") {
      return <span className="font-bold text-xs" style={{ color: "#73c991" }}>U</span>;
    }
    if (code === "R" || status === "renamed") {
      return <span className="font-bold text-xs" style={{ color: "#569cd6" }}>R</span>;
    }
    return <span className="font-bold text-xs" style={{ color: "var(--text-muted-color)" }}>?</span>;
  };

  // --- Render: Loading State ---
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-xs font-mono" style={{ color: "var(--text-muted-color)" }}>
        <span className="codicon codicon-loading codicon-modifier-spin mr-2" />
        Carregando Source Control...
      </div>
    );
  }

  // --- Render: Not Initialized ---
  if (!initialized) {
    return (
      <div className="h-full flex flex-col justify-between p-4 overflow-y-auto" style={{ color: "var(--text-color)" }}>
        <div className="space-y-6 text-center pt-8">
          <div
            className="w-14 h-14 mx-auto border-2 flex items-center justify-center text-2xl neo-shadow"
            style={{
              backgroundColor: "var(--primary-color)",
              borderColor: "var(--panel-border-color)",
              color: "#000000",
            }}
          >
            <span className="codicon codicon-source-control" />
          </div>

          <div className="space-y-2">
            <h3 className="text-base font-bold" style={{ color: "var(--text-color)" }}>
              Nenhum Repositório Git
            </h3>
            <p className="text-xs max-w-xs mx-auto leading-relaxed" style={{ color: "var(--text-muted-color)" }}>
              Esta sessão ainda não possui versionamento. Inicialize um repositório local ou clone do GitHub.
            </p>
          </div>

          {error && (
            <div className="p-3 border-2 text-xs text-left" style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.5)", color: "rgb(252, 165, 165)" }}>
              {error}
            </div>
          )}

          <div className="space-y-3 max-w-xs mx-auto pt-2">
            <button
              onClick={handleInit}
              disabled={actionLoading}
              className="w-full py-2.5 px-4 border-2 font-bold text-xs neo-shadow-button flex items-center justify-center gap-2"
              style={{
                backgroundColor: "var(--button-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--button-text-color)",
              }}
            >
              <span className={`codicon ${actionLoading ? "codicon-loading codicon-modifier-spin" : "codicon-repo"}`} />
              <span>Inicializar Repositório Local</span>
            </button>

            <button
              onClick={() => setCloneModalOpen(true)}
              disabled={actionLoading}
              className="w-full py-2.5 px-4 border-2 font-bold text-xs neo-shadow-button flex items-center justify-center gap-2"
              style={{
                backgroundColor: "var(--input-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--text-color)",
              }}
            >
              <span className="codicon codicon-repo-clone" />
              <span>Clonar Repositório Remoto</span>
            </button>
          </div>
        </div>

        {/* Modal: Clone */}
        {cloneModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="p-6 border-2 glass-panel neo-shadow w-full max-w-md space-y-4" style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--panel-border-color)" }}>
                <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--text-color)" }}>
                  <span className="codicon codicon-repo-clone" />
                  <span>Clonar Repositório Git</span>
                </h3>
                <button onClick={() => setCloneModalOpen(false)} className="hover:opacity-75">
                  <span className="codicon codicon-close" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold mb-1" style={{ color: "var(--text-color)" }}>URL do Repositório (.git):</label>
                  <input
                    type="text"
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                    placeholder="https://github.com/usuario/repositorio.git"
                    className="w-full p-2.5 border-2 focus:outline-none focus:ring-2 font-mono"
                    style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)", color: "var(--text-color)" }}
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1" style={{ color: "var(--text-color)" }}>
                    Personal Access Token (PAT): <span className="font-normal opacity-60">(Obrigatório para repos privados)</span>
                  </label>
                  <input
                    type="password"
                    value={gitToken}
                    onChange={(e) => setGitToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxx"
                    className="w-full p-2.5 border-2 focus:outline-none focus:ring-2 font-mono"
                    style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)", color: "var(--text-color)" }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--panel-border-color)" }}>
                <button
                  onClick={() => setCloneModalOpen(false)}
                  className="px-4 py-2 border font-bold text-xs"
                  style={{ borderColor: "var(--panel-border-color)", color: "var(--text-muted-color)" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClone}
                  disabled={actionLoading || !cloneUrl.trim()}
                  className="px-4 py-2 border-2 font-bold text-xs neo-shadow-button disabled:opacity-50"
                  style={{ backgroundColor: "var(--primary-color)", borderColor: "var(--panel-border-color)", color: "#000000" }}
                >
                  {actionLoading ? "Clonando..." : "Confirmar Clone"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Render: Main Source Control Workspace (VS Code / Antigravity Style) ---
  return (
    <div className="h-full flex flex-col overflow-hidden text-xs select-none" style={{ color: "var(--text-color)" }}>
      {/* 1. Header Toolbar */}
      <div
        className="h-10 px-3 border-b flex items-center justify-between flex-shrink-0"
        style={{
          backgroundColor: "var(--header-bg-color, var(--panel-bg-color))",
          borderColor: "var(--panel-border-color)",
        }}
      >
        <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5 opacity-85">
          <span className="codicon codicon-source-control" />
          <span>Source Control</span>
        </span>

        {/* Header Action Icons */}
        <div className="flex items-center gap-1">
          {/* Branch Pill Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="px-2 py-0.5 border flex items-center gap-1 text-[11px] font-bold hover:bg-black/10 transition-colors"
              style={{
                borderColor: "var(--panel-border-color)",
                backgroundColor: "var(--input-bg-color)",
              }}
              title="Alternar branch ativa"
            >
              <span className="codicon codicon-git-branch text-amber-400 text-[11px]" />
              <span className="truncate max-w-[80px]">{currentBranch || "main"}</span>
              <span className="codicon codicon-chevron-down text-[9px] opacity-70" />
            </button>

            {showBranchDropdown && (
              <div
                className="absolute top-full left-0 mt-1 w-48 border-2 glass-panel neo-shadow z-50 py-1"
                style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}
              >
                <div className="px-3 py-1 font-bold text-[10px] uppercase opacity-60 border-b" style={{ borderColor: "var(--panel-border-color)" }}>
                  Branches Locais
                </div>
                <div className="max-h-36 overflow-y-auto">
                  {branches.map((b) => (
                    <button
                      key={b}
                      onClick={() => handleCheckout(b)}
                      className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-black/10 text-xs font-mono"
                      style={{
                        backgroundColor: b === currentBranch ? "var(--primary-bg-color, rgba(255,140,0,0.15))" : "transparent",
                        color: b === currentBranch ? "var(--primary-color)" : "var(--text-color)",
                      }}
                    >
                      <span className="truncate">{b}</span>
                      {b === currentBranch && <span className="codicon codicon-check text-[11px]" />}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setBranchModalOpen(true); setShowBranchDropdown(false); }}
                  className="w-full text-left px-3 py-1.5 border-t flex items-center gap-1.5 font-bold text-[11px] hover:bg-black/10"
                  style={{ borderColor: "var(--panel-border-color)", color: "var(--primary-color)" }}
                >
                  <span className="codicon codicon-add" />
                  <span>Nova Branch...</span>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => { fetchStatus(); fetchLog(); }}
            disabled={actionLoading}
            className="p-1.5 hover:opacity-75 transition-opacity"
            title="Atualizar Status (Refresh)"
          >
            <span className={`codicon ${actionLoading ? "codicon-loading codicon-modifier-spin" : "codicon-refresh"}`} />
          </button>

          <button
            onClick={handlePull}
            disabled={actionLoading}
            className="p-1.5 hover:opacity-75 transition-opacity"
            title="Sincronizar Remote (Pull)"
          >
            <span className="codicon codicon-cloud-download" />
          </button>

          <button
            onClick={handlePush}
            disabled={actionLoading}
            className="p-1.5 hover:opacity-75 transition-opacity"
            title="Enviar Commits ao Remote (Push)"
          >
            <span className="codicon codicon-cloud-upload" />
          </button>

          <button
            onClick={() => setTokenModalOpen(true)}
            className="p-1.5 hover:opacity-75 transition-opacity"
            title="Configurar Personal Access Token (PAT)"
            style={{ color: gitToken ? "var(--primary-color)" : "var(--text-muted-color)" }}
          >
            <span className="codicon codicon-key" />
          </button>
        </div>
      </div>

      {/* 2. Commit Message & Action Area (VS Code Standard) */}
      <div className="p-3 border-b space-y-2 flex-shrink-0" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--panel-bg-color)" }}>
        <div className="relative">
          <textarea
            rows={2}
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Mensagem de commit (Ctrl+Enter para commit)"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleCommit(false);
              }
            }}
            className="w-full p-2 pr-8 border-2 focus:outline-none focus:ring-1 text-xs resize-none font-mono"
            style={{
              backgroundColor: "var(--input-bg-color)",
              borderColor: "var(--panel-border-color)",
              color: "var(--text-color)",
            }}
          />
          {/* AI Commit Message Generator Button */}
          <button
            onClick={handleGenerateAiCommitMessage}
            disabled={isGeneratingAiMsg || actionLoading}
            className="absolute top-2 right-2 p-1 text-purple-400 hover:text-purple-300 transition-colors"
            title="Gerar mensagem de commit com IA (Gemini)"
          >
            <span className={`codicon ${isGeneratingAiMsg ? "codicon-loading codicon-modifier-spin" : "codicon-sparkle"}`} />
          </button>
        </div>

        {/* Primary Commit Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleCommit(false)}
            disabled={actionLoading || !commitMessage.trim()}
            className="flex-1 py-1.5 px-3 border-2 font-bold text-xs neo-shadow-button flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={{
              backgroundColor: "var(--button-bg-color)",
              borderColor: "var(--panel-border-color)",
              color: "var(--button-text-color)",
            }}
            title="Criar Commit (Ctrl+Enter)"
          >
            <span className="codicon codicon-check" />
            <span>Commit</span>
          </button>

          <button
            onClick={() => handleCommit(true)}
            disabled={actionLoading || !commitMessage.trim()}
            className="py-1.5 px-2.5 border-2 font-bold text-xs neo-shadow-button flex items-center justify-center gap-1 disabled:opacity-50"
            style={{
              backgroundColor: "var(--input-bg-color)",
              borderColor: "var(--panel-border-color)",
              color: "var(--text-color)",
            }}
            title="Commit e Push para o Remote"
          >
            <span className="codicon codicon-cloud-upload" />
            <span className="hidden sm:inline">Commit & Push</span>
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMsg && (
        <div className="px-3 py-2 flex items-center justify-between text-xs border-b" style={{ backgroundColor: "rgba(115, 201, 145, 0.12)", color: "#73c991", borderColor: "var(--panel-border-color)" }}>
          <span className="flex items-center gap-1.5">
            <span className="codicon codicon-check" />
            <span>{successMsg}</span>
          </span>
          <button onClick={() => setSuccessMsg(null)}>
            <span className="codicon codicon-close" />
          </button>
        </div>
      )}
      {error && (
        <div className="px-3 py-2 flex items-center justify-between text-xs border-b" style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#f87171", borderColor: "var(--panel-border-color)" }}>
          <span className="flex items-center gap-1.5">
            <span className="codicon codicon-error" />
            <span className="leading-tight">{error}</span>
          </span>
          <button onClick={() => setError(null)}>
            <span className="codicon codicon-close" />
          </button>
        </div>
      )}

      {/* 3. Main Accordion Content Area */}
      <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: "var(--panel-border-color)" }}>
        
        {/* --- SECTION: STAGED CHANGES --- */}
        <div>
          <div
            onClick={() => setStagedOpen(!stagedOpen)}
            className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-black/5 font-bold uppercase tracking-wider text-[11px]"
            style={{ backgroundColor: "var(--header-bg-color, var(--panel-bg-color))", color: "var(--text-color)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className={`codicon ${stagedOpen ? "codicon-chevron-down" : "codicon-chevron-right"} text-[10px]`} />
              <span>Staged Changes</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] border font-mono" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}>
                {stagedFiles.length}
              </span>
            </div>

            {stagedFiles.length > 0 && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={handleUnstageAll}
                  disabled={actionLoading}
                  className="p-1 hover:text-red-400"
                  title="Desmarcar todos os arquivos (Unstage All)"
                >
                  <span className="codicon codicon-remove" />
                </button>
              </div>
            )}
          </div>

          {stagedOpen && (
            <div className="divide-y divide-black/5">
              {stagedFiles.length === 0 ? (
                <div className="px-4 py-2.5 text-[11px] opacity-50 italic">
                  Nenhum arquivo em stage
                </div>
              ) : (
                stagedFiles.map((f, i) => {
                  const { fileName, dirPath } = splitPath(f.path);
                  return (
                    <div
                      key={f.path + i}
                      onClick={() => handleFileItemClick(f.path, true)}
                      className="px-3 py-1.5 flex items-center justify-between hover:bg-black/10 cursor-pointer group font-mono text-xs"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span
                          onClick={(e) => { e.stopPropagation(); if (onOpenFile) onOpenFile(f.path); }}
                          className="codicon codicon-file-code opacity-75 flex-shrink-0 hover:text-blue-400"
                          title="Abrir no Editor"
                        />
                        <span className="font-bold truncate">{fileName}</span>
                        {dirPath && <span className="opacity-50 text-[10px] truncate">{dirPath}</span>}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Hover Action Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); if (onOpenFile) onOpenFile(f.path); }}
                            className="p-1 opacity-60 hover:opacity-100 hover:text-blue-400"
                            title="Abrir arquivo no Editor"
                          >
                            <span className="codicon codicon-go-to-file" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (onOpenDiff) onOpenDiff({ path: f.path, isStaged: true }); }}
                            className="p-1 opacity-60 hover:opacity-100 hover:text-amber-400"
                            title="Abrir Diff no Editor"
                          >
                            <span className="codicon codicon-diff" />
                          </button>
                          <button
                            onClick={(e) => handleUnstageFile(f.path, e)}
                            className="p-1 opacity-75 hover:opacity-100 hover:text-red-400"
                            title="Desmarcar arquivo (Unstage)"
                          >
                            <span className="codicon codicon-remove" />
                          </button>
                        </div>
                        {getStatusBadge(f.statusCode, f.status)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* --- SECTION: CHANGES (UNSTAGED) --- */}
        <div>
          <div
            onClick={() => setChangesOpen(!changesOpen)}
            className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-black/5 font-bold uppercase tracking-wider text-[11px]"
            style={{ backgroundColor: "var(--header-bg-color, var(--panel-bg-color))", color: "var(--text-color)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className={`codicon ${changesOpen ? "codicon-chevron-down" : "codicon-chevron-right"} text-[10px]`} />
              <span>Changes</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] border font-mono" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}>
                {unstagedFiles.length}
              </span>
            </div>

            {unstagedFiles.length > 0 && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleDiscardFiles(null)}
                  disabled={actionLoading}
                  className="p-1 hover:text-red-400"
                  title="Descartar todas as alterações"
                >
                  <span className="codicon codicon-discard" />
                </button>
                <button
                  onClick={handleStageAll}
                  disabled={actionLoading}
                  className="p-1 hover:text-green-400"
                  title="Preparar todos os arquivos (Stage All)"
                >
                  <span className="codicon codicon-add" />
                </button>
              </div>
            )}
          </div>

          {changesOpen && (
            <div className="divide-y divide-black/5">
              {unstagedFiles.length === 0 ? (
                <div className="px-4 py-2.5 text-[11px] opacity-50 italic">
                  Nenhuma alteração pendente
                </div>
              ) : (
                unstagedFiles.map((f, i) => {
                  const { fileName, dirPath } = splitPath(f.path);
                  return (
                    <div
                      key={f.path + i}
                      onClick={() => handleFileItemClick(f.path, false)}
                      className="px-3 py-1.5 flex items-center justify-between hover:bg-black/10 cursor-pointer group font-mono text-xs"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span
                          onClick={(e) => { e.stopPropagation(); if (onOpenFile) onOpenFile(f.path); }}
                          className="codicon codicon-file-code opacity-75 flex-shrink-0 hover:text-blue-400"
                          title="Abrir no Editor"
                        />
                        <span className="font-bold truncate">{fileName}</span>
                        {dirPath && <span className="opacity-50 text-[10px] truncate">{dirPath}</span>}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Hover Action Buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); if (onOpenFile) onOpenFile(f.path); }}
                            className="p-1 opacity-60 hover:opacity-100 hover:text-blue-400"
                            title="Abrir arquivo no Editor"
                          >
                            <span className="codicon codicon-go-to-file" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (onOpenDiff) onOpenDiff({ path: f.path, isStaged: false }); }}
                            className="p-1 opacity-60 hover:opacity-100 hover:text-amber-400"
                            title="Abrir Diff no Editor"
                          >
                            <span className="codicon codicon-diff" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDiscardConfirmFile(f.path); }}
                            className="p-1 opacity-75 hover:opacity-100 hover:text-red-400"
                            title="Descartar alterações neste arquivo"
                          >
                            <span className="codicon codicon-discard" />
                          </button>
                          <button
                            onClick={(e) => handleStageFile(f.path, e)}
                            className="p-1 opacity-75 hover:opacity-100 hover:text-green-400"
                            title="Preparar arquivo (Stage)"
                          >
                            <span className="codicon codicon-add" />
                          </button>
                        </div>
                        {getStatusBadge(f.statusCode, f.status)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* --- SECTION: GRAPH / COMMITS --- */}
        <div>
          <div
            onClick={() => setGraphOpen(!graphOpen)}
            className="px-3 py-1.5 flex items-center justify-between cursor-pointer hover:bg-black/5 font-bold uppercase tracking-wider text-[11px]"
            style={{ backgroundColor: "var(--header-bg-color, var(--panel-bg-color))", color: "var(--text-color)" }}
          >
            <div className="flex items-center gap-1.5">
              <span className={`codicon ${graphOpen ? "codicon-chevron-down" : "codicon-chevron-right"} text-[10px]`} />
              <span>Graph / Commits</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] border font-mono" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}>
                {commits.length}
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); fetchLog(); }}
              className="p-1 hover:opacity-75"
              title="Atualizar Histórico"
            >
              <span className="codicon codicon-refresh text-[11px]" />
            </button>
          </div>

          {graphOpen && (
            <div className="p-2 space-y-1.5">
              {commits.length === 0 ? (
                <div className="px-3 py-2 text-[11px] opacity-50 italic">
                  Nenhum commit registrado nesta branch
                </div>
              ) : (
                commits.map((c, idx) => {
                  const isSelected = selectedCommitHash === c.hash;
                  const details = commitDetailsMap[c.hash];

                  return (
                    <div
                      key={c.hash || idx}
                      className="rounded transition-colors overflow-hidden"
                      style={{
                        backgroundColor: isSelected ? "var(--primary-bg-color, rgba(255,140,0,0.12))" : "transparent",
                      }}
                    >
                      {/* Visual Commit Row */}
                      <div
                        onClick={() => handleCommitClick(c)}
                        className="flex items-start gap-2.5 p-2 rounded hover:bg-black/10 cursor-pointer select-none"
                      >
                        {/* Visual Commit Node & Connecting Line */}
                        <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                          <span
                            className={`w-3 h-3 rounded-full border-2 flex-shrink-0 transition-transform ${
                              isSelected ? "scale-125 ring-2 ring-amber-400/40" : ""
                            }`}
                            style={{
                              backgroundColor: isSelected ? "var(--primary-color)" : idx === 0 ? "var(--primary-color)" : "#3b82f6",
                              borderColor: isSelected ? "#ffffff" : "var(--panel-border-color)",
                            }}
                          />
                          {idx < commits.length - 1 && (
                            <span
                              className="w-0.5 h-7 border-l my-0.5 transition-all"
                              style={{
                                borderColor: isSelected ? "var(--primary-color)" : "var(--panel-border-color)",
                                borderStyle: isSelected ? "solid" : "dashed",
                                opacity: isSelected ? 1 : 0.4,
                              }}
                            />
                          )}
                        </div>

                        {/* Commit Information */}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`font-bold text-xs truncate ${isSelected ? "text-amber-400" : ""}`}
                              style={{ color: isSelected ? "var(--primary-color)" : "var(--text-color)" }}
                            >
                              {c.message}
                            </span>
                            <span
                              className="font-mono text-[10px] px-1.5 py-0.2 border flex-shrink-0"
                              style={{
                                backgroundColor: "var(--input-bg-color)",
                                borderColor: isSelected ? "var(--primary-color)" : "var(--panel-border-color)",
                                color: "var(--primary-color)",
                              }}
                            >
                              {c.shortHash}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] opacity-60">
                            <span className="truncate">{c.author}</span>
                            <span>•</span>
                            <span>{c.relativeDate}</span>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Modified Files in this Commit */}
                      {isSelected && (
                        <div
                          className="pl-6 pr-2 pb-2 pt-0.5 space-y-1 border-l-2 ml-3.5 mb-1"
                          style={{ borderColor: "var(--primary-color)" }}
                        >
                          {details?.loading ? (
                            <div className="py-1 text-[10px] opacity-60 flex items-center gap-1.5 font-mono">
                              <span className="codicon codicon-loading codicon-modifier-spin text-amber-400" />
                              <span>Carregando arquivos do commit...</span>
                            </div>
                          ) : details?.files?.length === 0 ? (
                            <div className="py-1 text-[10px] opacity-50 italic">
                              Nenhum arquivo modificado detectado neste commit
                            </div>
                          ) : (
                            details?.files?.map((f, fIdx) => {
                              const { fileName, dirPath } = splitPath(f.path);
                              const parentHash = details.parentHash || "";

                              return (
                                <div
                                  key={f.path + fIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onOpenCommitDiff) {
                                      onOpenCommitDiff({
                                        path: f.path,
                                        hash: c.hash,
                                        parentHash,
                                        shortHash: c.shortHash,
                                        shortParentHash: parentHash ? parentHash.substring(0, 7) : "",
                                        message: c.message,
                                      });
                                    }
                                  }}
                                  className="px-2 py-1 rounded flex items-center justify-between hover:bg-black/15 cursor-pointer group text-xs font-mono transition-colors border"
                                  style={{
                                    backgroundColor: "var(--input-bg-color)",
                                    borderColor: "var(--panel-border-color)",
                                  }}
                                  title={`Ver alterações de "${fileName}" no commit ${c.shortHash}`}
                                >
                                  <div className="flex items-center gap-1.5 truncate pr-1">
                                    <span className="codicon codicon-file-code text-blue-400 text-xs flex-shrink-0" />
                                    <span className="font-bold truncate">{fileName}</span>
                                    {dirPath && <span className="opacity-50 text-[10px] truncate">{dirPath}</span>}
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className="codicon codicon-diff opacity-0 group-hover:opacity-100 text-amber-400 text-xs" />
                                    {getStatusBadge(f.statusCode, f.status)}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL: TOKEN AUTH (PAT) --- */}
      {tokenModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="p-6 border-2 glass-panel neo-shadow w-full max-w-md space-y-4" style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--panel-border-color)" }}>
              <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: "var(--text-color)" }}>
                <span className="codicon codicon-key text-amber-400" />
                <span>Autenticação Git (Personal Access Token)</span>
              </h3>
              <button onClick={() => setTokenModalOpen(false)} className="hover:opacity-75">
                <span className="codicon codicon-close" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p style={{ color: "var(--text-muted-color)", lineHeight: "1.5" }}>
                Para fazer <strong>Push</strong> ou <strong>Pull</strong> em repositórios do GitHub/GitLab com segurança, informe um Personal Access Token (PAT) com escopo <code className="px-1 py-0.5 border" style={{ borderColor: "var(--panel-border-color)" }}>repo</code>.
              </p>

              <div>
                <label className="block font-bold mb-1" style={{ color: "var(--text-color)" }}>Personal Access Token (PAT):</label>
                <input
                  type="password"
                  value={gitToken}
                  onChange={(e) => setGitToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full p-2.5 border-2 focus:outline-none focus:ring-2 font-mono"
                  style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)", color: "var(--text-color)" }}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=TeamCode-Cloud-IDE"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1 font-bold"
                >
                  <span>Gerar novo token no GitHub</span>
                  <span className="codicon codicon-link-external text-[10px]" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--panel-border-color)" }}>
              <button
                onClick={() => setTokenModalOpen(false)}
                className="px-4 py-2 border font-bold text-xs"
                style={{ borderColor: "var(--panel-border-color)", color: "var(--text-muted-color)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSaveToken(true)}
                className="px-4 py-2 border-2 font-bold text-xs neo-shadow-button"
                style={{ backgroundColor: "var(--primary-color)", borderColor: "var(--panel-border-color)", color: "#000000" }}
              >
                Salvar Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CREATE BRANCH --- */}
      {branchModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="p-6 border-2 glass-panel neo-shadow w-full max-w-sm space-y-4" style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
            <h3 className="font-bold text-sm flex items-center gap-2 border-b pb-2" style={{ borderColor: "var(--panel-border-color)", color: "var(--text-color)" }}>
              <span className="codicon codicon-git-branch" />
              <span>Criar Nova Branch</span>
            </h3>

            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: "var(--text-color)" }}>Nome da Branch:</label>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feature/nova-tela"
                className="w-full p-2.5 border-2 focus:outline-none focus:ring-2 font-mono text-xs"
                style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)", color: "var(--text-color)" }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--panel-border-color)" }}>
              <button
                onClick={() => { setBranchModalOpen(false); setNewBranchName(""); }}
                className="px-3 py-1.5 border font-bold text-xs"
                style={{ borderColor: "var(--panel-border-color)", color: "var(--text-muted-color)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleCheckout(newBranchName, true)}
                disabled={actionLoading || !newBranchName.trim()}
                className="px-4 py-1.5 border-2 font-bold text-xs neo-shadow-button disabled:opacity-50"
                style={{ backgroundColor: "var(--primary-color)", borderColor: "var(--panel-border-color)", color: "#000000" }}
              >
                Criar e Alternar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DISCARD MODAL --- */}
      {discardConfirmFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="p-6 border-2 glass-panel neo-shadow w-full max-w-sm space-y-4" style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
            <h3 className="font-bold text-sm flex items-center gap-2 text-red-400">
              <span className="codicon codicon-warning" />
              <span>Descartar Alterações?</span>
            </h3>
            <p className="text-xs" style={{ color: "var(--text-muted-color)" }}>
              Tem certeza que deseja reverter todas as modificações no arquivo <strong className="font-mono" style={{ color: "var(--text-color)" }}>{discardConfirmFile}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--panel-border-color)" }}>
              <button
                onClick={() => setDiscardConfirmFile(null)}
                className="px-3 py-1.5 border font-bold text-xs"
                style={{ borderColor: "var(--panel-border-color)", color: "var(--text-muted-color)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDiscardFiles([discardConfirmFile])}
                className="px-4 py-1.5 border-2 font-bold text-xs neo-shadow-button bg-red-600 text-white hover:bg-red-500"
                style={{ borderColor: "var(--panel-border-color)" }}
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
