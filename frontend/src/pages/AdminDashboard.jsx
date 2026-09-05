import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "../components/Toast";
import { getAuthHeaders } from "../utils/auth";
import ThemeSwitcher from "../components/ThemeSwitcher";

export default function AdminDashboard() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [systemMetrics, setSystemMetrics] = useState(null);
  const [aiMetrics, setAIMetrics] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [sessionsList, setSessionsList] = useState([]);
  const [activeRoomsData, setActiveRoomsData] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sessionFilter, setSessionFilter] = useState("ALL"); // ALL, ACTIVE, INACTIVE

  // Role Verification (dynamic state with /api/users/me sync)
  const [userRole, setUserRole] = useState(() => {
    try {
      const token = localStorage.getItem("jwtToken");
      if (token) {
        return JSON.parse(atob(token.split(".")[1])).role || "ROLE_USER";
      }
    } catch (_) { }
    return "ROLE_USER";
  });
  const [username, setUsername] = useState(() => localStorage.getItem("username") || "User");

  const isSuperAdmin = userRole === "ROLE_SUPER_ADMIN";

  const fetchDashboardData = useCallback(async () => {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
      setLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      // 1. Sync latest user profile and token from server
      try {
        const meRes = await fetch("/api/users/me", { headers: getAuthHeaders() });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.token) localStorage.setItem("jwtToken", meData.token);
          if (meData.role) setUserRole(meData.role);
          if (meData.username) setUsername(meData.username);
        }
      } catch (_) {}

      const headers = getAuthHeaders();

      // 2. Parallel fetching from microservices
      const [metricsRes, aiRes, statsRes, usersRes, sessionsRes, syncRes] = await Promise.allSettled([
        fetch("/api/sessions/admin/system-metrics", { headers }),
        fetch("/api/sessions/admin/ai-metrics", { headers }),
        fetch("/api/users/admin/stats", { headers }),
        fetch("/api/users/admin/users", { headers }),
        fetch("/api/sessions/admin/sessions", { headers }),
        fetch("/api/sync/admin/active-rooms", { headers }),
      ]);

      if (metricsRes.status === "fulfilled" && metricsRes.value.ok) {
        setSystemMetrics(await metricsRes.value.json());
      }
      if (aiRes.status === "fulfilled" && aiRes.value.ok) {
        setAIMetrics(await aiRes.value.json());
      }
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        setUserStats(await statsRes.value.json());
      }
      if (usersRes.status === "fulfilled") {
        if (usersRes.value.ok) {
          setUsersList(await usersRes.value.json());
        } else if (usersRes.value.status === 401 || usersRes.value.status === 403) {
          toast.error("Sua sessão expirou ou requer novo login para carregar os usuários.");
        }
      }
      if (sessionsRes.status === "fulfilled" && sessionsRes.value.ok) {
        setSessionsList(await sessionsRes.value.json());
      }
      if (syncRes.status === "fulfilled" && syncRes.value.ok) {
        setActiveRoomsData(await syncRes.value.json());
      }
    } catch (err) {
      console.error("Failed to load admin metrics", err);
      toast.error("Erro ao carregar dados do console administrativo");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15000); // 15s auto-refresh for live presence
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Actions
  const handleToggleUserActive = async (userId) => {
    try {
      const res = await fetch(`/api/users/admin/users/${userId}/toggle-active`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Falha ao alterar status");
      toast.success("Status do usuário atualizado!");
      fetchDashboardData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleToggleUserRole = async (userId, currentRole) => {
    const nextRole = currentRole === "ROLE_SUPER_ADMIN" ? "ROLE_USER" : "ROLE_SUPER_ADMIN";
    try {
      const res = await fetch(`/api/users/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Falha ao alterar papel");
      }
      toast.success(`Papel alterado para ${nextRole}!`);
      fetchDashboardData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDeleteUser = async (userId, userUsername) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário "${userUsername}"?`)) return;
    try {
      const res = await fetch(`/api/users/admin/users/${userId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Falha ao excluir usuário");
      }
      toast.success("Usuário excluído com sucesso!");
      fetchDashboardData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDeleteSession = async (publicId) => {
    if (!window.confirm(`Tem certeza que deseja encerrar a sala "${publicId}"?`)) return;
    try {
      const res = await fetch(`/api/sessions/admin/sessions/${publicId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Falha ao encerrar sala");
      toast.success("Sala encerrada e recursos liberados!");
      fetchDashboardData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleKickUser = async (sessionId, userId, userName) => {
    if (!window.confirm(`Deseja desconectar o usuário "${userName}" da sala?`)) return;
    try {
      const res = await fetch(`/api/sync/admin/sessions/${sessionId}/disconnect/${userId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Falha ao desconectar usuário");
      toast.success(`Usuário "${userName}" desconectado da sala!`);
      fetchDashboardData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
        style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
        <div className="p-8 border-4 max-w-md w-full neo-shadow-card rounded-2xl flex flex-col items-center"
          style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
          <span className="codicon codicon-shield text-6xl text-red-500 mb-4" />
          <h1 className="text-2xl font-black mb-2" style={{ color: "var(--primary-color)" }}>
            Acesso Restrito
          </h1>
          <p className="text-sm opacity-80 mb-6" style={{ color: "var(--text-muted-color)" }}>
            Esta área é exclusiva para a conta <b>Super Admin</b> do CrewCode. Seu usuário (<code>{username}</code>) não possui a permissão necessária.
          </p>
          <a
            href="/"
            className="w-full py-2.5 px-6 border-2 font-bold neo-shadow-button rounded-xl text-sm"
            style={{ backgroundColor: "var(--primary-color)", color: "#fff", borderColor: "var(--panel-border-color)" }}
          >
            Voltar para o Início
          </a>
        </div>
      </div>
    );
  }

  const onlineUsersSet = new Set(activeRoomsData?.onlineUsers || []);

  const filteredUsers = (usersList || []).filter((u) => {
    const q = searchTerm.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.provider?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  const activeRoomsList = activeRoomsData?.rooms || [];
  const activeSessionIds = new Set(activeRoomsList.map(r => r.sessionId));

  const filteredSessions = (sessionsList || []).filter((s) => {
    const isOnline = activeSessionIds.has(s.publicId);
    if (sessionFilter === "ACTIVE") return isOnline;
    if (sessionFilter === "INACTIVE") return !isOnline;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300"
      style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
      {/* Admin Top Navigation */}
      <header
        className="p-4 flex flex-wrap justify-between items-center border-b-2 gap-4 sticky top-0 z-30"
        style={{ backgroundColor: "var(--header-bg-color)", borderColor: "var(--panel-border-color)" }}
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 border-2 border-black flex items-center justify-center text-white font-black shadow-md">
            <span className="codicon codicon-shield text-xl" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--primary-color)" }}>
                CrewCode Admin Console
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                SUPER ADMIN
              </span>
            </div>
            <p className="text-xs opacity-70 flex items-center gap-1.5" style={{ color: "var(--text-muted-color)" }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>VM Host: Oracle Cloud Infrastructure (OCI Ubuntu 24.04)</span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <ThemeSwitcher showFont={false} />

          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className={`p-2 border-2 font-bold rounded-lg neo-shadow-button transition-all flex items-center gap-1.5 text-xs ${refreshing ? "opacity-50" : ""}`}
            style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)", color: "var(--text-color)" }}
            title="Atualizar Métricas"
          >
            <span className={`codicon codicon-refresh ${refreshing ? "codicon-modifier-spin" : ""}`} />
            <span>Atualizar</span>
          </button>

          <a
            href="/"
            className="px-4 py-2 border-2 font-bold rounded-lg neo-shadow-button transition-all text-xs flex items-center gap-1.5"
            style={{ backgroundColor: "var(--primary-color)", color: "#fff", borderColor: "var(--panel-border-color)" }}
          >
            <span className="codicon codicon-code" />
            <span>Abrir IDE</span>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* 4 Big KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Users */}
          <div className="p-4 border-2 rounded-xl glass-panel neo-shadow flex flex-col justify-between"
            style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ color: "var(--text-muted-color)" }}>
                Usuários & Presença
              </span>
              <span className="codicon codicon-organization text-xl text-blue-400" />
            </div>
            <div className="my-2">
              <span className="text-3xl font-black" style={{ color: "var(--text-color)" }}>
                {userStats?.totalUsers ?? (loading ? "..." : "0")}
              </span>
              <span className="text-xs ml-2 text-emerald-400 font-semibold">
                ({activeRoomsData?.uniqueOnlineUsersCount ?? 0} online agora)
              </span>
            </div>
            <div className="text-[11px] opacity-75 flex gap-2" style={{ color: "var(--text-muted-color)" }}>
              <span>{userStats?.activeUsers ?? 0} habilitados</span>
              <span>•</span>
              <span>Local: {userStats?.providers?.LOCAL || 0}</span>
              <span>Google: {userStats?.providers?.GOOGLE || 0}</span>
              <span>GitHub: {userStats?.providers?.GITHUB || 0}</span>
            </div>
          </div>

          {/* Active Sessions */}
          <div className="p-4 border-2 rounded-xl glass-panel neo-shadow flex flex-col justify-between"
            style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ color: "var(--text-muted-color)" }}>
                Salas Online (Tempo Real)
              </span>
              <span className="codicon codicon-live-share text-xl text-emerald-400" />
            </div>
            <div className="my-2">
              <span className="text-3xl font-black text-emerald-400">
                {activeRoomsData?.activeRoomsCount ?? (loading ? "..." : "0")}
              </span>
              <span className="text-xs ml-2 opacity-75 font-semibold" style={{ color: "var(--text-color)" }}>
                salas ativas ({sessionsList?.length ?? 0} salvas)
              </span>
            </div>
            <div className="text-[11px] opacity-75 flex items-center gap-1.5" style={{ color: "var(--text-muted-color)" }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{activeRoomsData?.totalConnectedParticipants ?? 0} conexões ativas via WebSocket</span>
            </div>
          </div>

          {/* AI Gemini Tokens */}
          <div className="p-4 border-2 rounded-xl glass-panel neo-shadow flex flex-col justify-between"
            style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ color: "var(--text-muted-color)" }}>
                Tokens Gemini (IA)
              </span>
              <span className="codicon codicon-sparkle text-xl text-amber-400" />
            </div>
            <div className="my-2">
              <span className="text-3xl font-black" style={{ color: "var(--text-color)" }}>
                {aiMetrics?.totalTokens ? Number(aiMetrics.totalTokens).toLocaleString() : (loading ? "..." : "0")}
              </span>
              <span className="text-xs ml-2 text-amber-400 font-semibold">
                (~${aiMetrics?.estimatedCostUsd ?? "0.00"} USD)
              </span>
            </div>
            <div className="text-[11px] opacity-75" style={{ color: "var(--text-muted-color)" }}>
              Hoje: {aiMetrics?.tokensToday ? Number(aiMetrics.tokensToday).toLocaleString() : 0} tokens
            </div>
          </div>

          {/* VM Memory / Disk */}
          <div className="p-4 border-2 rounded-xl glass-panel neo-shadow flex flex-col justify-between"
            style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ color: "var(--text-muted-color)" }}>
                RAM JVM / Disco VM
              </span>
              <span className="codicon codicon-server-process text-xl text-purple-400" />
            </div>
            <div className="my-2">
              <span className="text-3xl font-black" style={{ color: "var(--text-color)" }}>
                {systemMetrics?.jvmMemory?.usedMb ?? 0} MB
              </span>
              <span className="text-xs ml-2 opacity-75 font-semibold">
                / {systemMetrics?.jvmMemory?.maxMb ?? 0} MB
              </span>
            </div>
            <div className="text-[11px] opacity-75" style={{ color: "var(--text-muted-color)" }}>
              Disco VM: {systemMetrics?.disk?.usedGb ?? 0} GB usados ({systemMetrics?.disk?.freeGb ?? 0} GB livres)
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b-2 gap-2 overflow-x-auto" style={{ borderColor: "var(--panel-border-color)" }}>
          <button
            onClick={() => setActiveTab("OVERVIEW")}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === "OVERVIEW" ? "border-[var(--primary-color)] text-[var(--primary-color)]" : "border-transparent opacity-60 hover:opacity-100"}`}
          >
            <span className="codicon codicon-dashboard" /> Visão Geral & Infraestrutura
          </button>
          <button
            onClick={() => setActiveTab("USERS")}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === "USERS" ? "border-[var(--primary-color)] text-[var(--primary-color)]" : "border-transparent opacity-60 hover:opacity-100"}`}
          >
            <span className="codicon codicon-organization" /> Usuários ({usersList.length}) {activeRoomsData?.uniqueOnlineUsersCount ? <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-black">{activeRoomsData.uniqueOnlineUsersCount} online</span> : null}
          </button>
          <button
            onClick={() => setActiveTab("AI")}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === "AI" ? "border-[var(--primary-color)] text-[var(--primary-color)]" : "border-transparent opacity-60 hover:opacity-100"}`}
          >
            <span className="codicon codicon-sparkle" /> FinOps & IA Gemini
          </button>
          <button
            onClick={() => setActiveTab("SESSIONS")}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${activeTab === "SESSIONS" ? "border-[var(--primary-color)] text-[var(--primary-color)]" : "border-transparent opacity-60 hover:opacity-100"}`}
          >
            <span className="codicon codicon-live-share" /> Monitor de Salas ({sessionsList.length}) {activeRoomsData?.activeRoomsCount ? <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-400 font-black">{activeRoomsData.activeRoomsCount} ativas</span> : null}
          </button>
        </div>

        {/* TAB 1: OVERVIEW & INFRASTRUCTURE */}
        {activeTab === "OVERVIEW" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* JVM Memory Card */}
            <div className="p-5 border-2 rounded-xl glass-panel neo-shadow space-y-4"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--primary-color)" }}>
                  <span className="codicon codicon-chip" /> Uso de Memória JVM
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black/10">
                  {systemMetrics?.jvmMemory?.usedPercent ?? 0}% utilizado
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, systemMetrics?.jvmMemory?.usedPercent ?? 0)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-center font-mono">
                <div className="p-2 border rounded" style={{ borderColor: "var(--panel-border-color)" }}>
                  <p className="opacity-60">Usada</p>
                  <p className="font-bold text-sm">{systemMetrics?.jvmMemory?.usedMb ?? 0} MB</p>
                </div>
                <div className="p-2 border rounded" style={{ borderColor: "var(--panel-border-color)" }}>
                  <p className="opacity-60">Livre</p>
                  <p className="font-bold text-sm">{systemMetrics?.jvmMemory?.freeMb ?? 0} MB</p>
                </div>
                <div className="p-2 border rounded" style={{ borderColor: "var(--panel-border-color)" }}>
                  <p className="opacity-60">Máxima</p>
                  <p className="font-bold text-sm">{systemMetrics?.jvmMemory?.maxMb ?? 0} MB</p>
                </div>
              </div>
            </div>

            {/* Disk Usage Card */}
            <div className="p-5 border-2 rounded-xl glass-panel neo-shadow space-y-4"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--primary-color)" }}>
                  <span className="codicon codicon-database" /> Armazenamento em Disco (VM)
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black/10">
                  {systemMetrics?.disk?.usedPercent ?? 0}% ocupado
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, systemMetrics?.disk?.usedPercent ?? 0)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-center font-mono">
                <div className="p-2 border rounded" style={{ borderColor: "var(--panel-border-color)" }}>
                  <p className="opacity-60">Usado</p>
                  <p className="font-bold text-sm">{systemMetrics?.disk?.usedGb ?? 0} GB</p>
                </div>
                <div className="p-2 border rounded" style={{ borderColor: "var(--panel-border-color)" }}>
                  <p className="opacity-60">Livre</p>
                  <p className="font-bold text-sm">{systemMetrics?.disk?.freeGb ?? 0} GB</p>
                </div>
                <div className="p-2 border rounded" style={{ borderColor: "var(--panel-border-color)" }}>
                  <p className="opacity-60">Total</p>
                  <p className="font-bold text-sm">{systemMetrics?.disk?.totalGb ?? 0} GB</p>
                </div>
              </div>
            </div>

            {/* System Info */}
            <div className="p-5 border-2 rounded-xl glass-panel neo-shadow md:col-span-2 space-y-3"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
              <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--primary-color)" }}>
                <span className="codicon codicon-server-environment" /> Informações do Host & Runtime
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="opacity-60 block">Processadores (vCPU):</span>
                  <span className="font-bold text-sm">{systemMetrics?.system?.processors ?? "1"} cores</span>
                </div>
                <div>
                  <span className="opacity-60 block">Threads Ativas:</span>
                  <span className="font-bold text-sm">{systemMetrics?.system?.activeThreads ?? "0"}</span>
                </div>
                <div>
                  <span className="opacity-60 block">Uptime do Serviço:</span>
                  <span className="font-bold text-sm">{systemMetrics?.system?.uptimeHours ?? "0"} horas</span>
                </div>
                <div>
                  <span className="opacity-60 block">Versão do Java:</span>
                  <span className="font-bold text-sm">{systemMetrics?.system?.javaVersion ?? "17"} (OpenJDK)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USERS MANAGEMENT */}
        {activeTab === "USERS" && (
          <div className="p-5 border-2 rounded-xl glass-panel neo-shadow space-y-4"
            style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--primary-color)" }}>
                <span className="codicon codicon-organization" /> Usuários Registrados
              </h3>
              <input
                type="text"
                placeholder="Buscar usuário, email ou provedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-72 p-2 border-2 rounded-lg text-xs outline-none focus:ring-2"
                style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)", color: "var(--text-color)" }}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 opacity-70 uppercase tracking-wider" style={{ borderColor: "var(--panel-border-color)" }}>
                    <th className="p-3">ID</th>
                    <th className="p-3">Usuário</th>
                    <th className="p-3">E-mail</th>
                    <th className="p-3">Provedor</th>
                    <th className="p-3">Presença</th>
                    <th className="p-3">Papel (Role)</th>
                    <th className="p-3">Status da Conta</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--panel-border-color)] font-mono">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center opacity-60">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isUserOnline = onlineUsersSet.has(u.username);
                      return (
                        <tr key={u.id} className="hover:bg-[var(--input-bg-color)] transition-colors">
                          <td className="p-3 font-bold opacity-60">#{u.id}</td>
                          <td className="p-3 font-sans font-bold flex items-center gap-2">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full border" />
                            ) : (
                              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-black">
                                {u.username.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span>{u.username}</span>
                          </td>
                          <td className="p-3">{u.email || "-"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.provider === "GOOGLE" ? "bg-red-500/20 text-red-400" : u.provider === "GITHUB" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"}`}>
                              {u.provider}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 ${isUserOnline ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-gray-500/20 opacity-60"}`}>
                              <span className={`codicon ${isUserOnline ? "codicon-circle-filled text-[10px] text-emerald-400 animate-pulse" : "codicon-circle-outline text-[10px]"}`} />
                              <span>{isUserOnline ? "Online" : "Offline"}</span>
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === "ROLE_SUPER_ADMIN" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "bg-gray-500/20 opacity-80"}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${u.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                              <span className={`codicon ${u.isActive ? "codicon-check text-[10px]" : "codicon-chrome-close text-[10px]"}`} />
                              <span>{u.isActive ? "Habilitada" : "Bloqueada"}</span>
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-1 font-sans">
                            <button
                              onClick={() => handleToggleUserRole(u.id, u.role)}
                              className="px-2 py-1 border rounded text-[10px] font-bold hover:opacity-80 transition-opacity"
                              style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}
                              title={u.role === "ROLE_SUPER_ADMIN" ? "Rebaixar para Usuário" : "Promover a Super Admin"}
                            >
                              {u.role === "ROLE_SUPER_ADMIN" ? "Demover" : "Tornar Admin"}
                            </button>
                            <button
                              onClick={() => handleToggleUserActive(u.id)}
                              className={`px-2 py-1 border rounded text-[10px] font-bold hover:opacity-80 transition-opacity ${u.isActive ? "text-amber-400" : "text-emerald-400"}`}
                              style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}
                            >
                              {u.isActive ? "Bloquear" : "Desbloquear"}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="px-2 py-1 border rounded text-[10px] font-bold text-red-500 hover:bg-red-500/10 transition-colors"
                              style={{ borderColor: "var(--panel-border-color)" }}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: FINOPS & AI GEMINI */}
        {activeTab === "AI" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 border-2 rounded-xl glass-panel neo-shadow"
                style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
                <p className="text-xs uppercase tracking-wider opacity-70" style={{ color: "var(--text-muted-color)" }}>Prompt Tokens (Entrada)</p>
                <p className="text-2xl font-black my-1">{aiMetrics?.promptTokens ? Number(aiMetrics.promptTokens).toLocaleString() : 0}</p>
                <p className="text-[11px] opacity-60">Taxa base: $0.075 por 1M tokens</p>
              </div>
              <div className="p-5 border-2 rounded-xl glass-panel neo-shadow"
                style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
                <p className="text-xs uppercase tracking-wider opacity-70" style={{ color: "var(--text-muted-color)" }}>Response Tokens (Saída)</p>
                <p className="text-2xl font-black my-1">{aiMetrics?.responseTokens ? Number(aiMetrics.responseTokens).toLocaleString() : 0}</p>
                <p className="text-[11px] opacity-60">Taxa base: $0.30 por 1M tokens</p>
              </div>
              <div className="p-5 border-2 rounded-xl glass-panel neo-shadow"
                style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
                <p className="text-xs uppercase tracking-wider opacity-70" style={{ color: "var(--text-muted-color)" }}>Custo Estimado Acumulado</p>
                <p className="text-2xl font-black my-1 text-emerald-400">${aiMetrics?.estimatedCostUsd ?? "0.00"} USD</p>
                <p className="text-[11px] opacity-60">Modelo ativo: Google Gemini Flash Lite</p>
              </div>
            </div>

            {/* Recent AI Logs Table */}
            <div className="p-5 border-2 rounded-xl glass-panel neo-shadow space-y-4"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
              <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--primary-color)" }}>
                <span className="codicon codicon-history" /> Últimas Chamadas da IA (Audit Log)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b-2 opacity-70 uppercase" style={{ borderColor: "var(--panel-border-color)" }}>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5">Usuário</th>
                      <th className="p-2.5">Sessão</th>
                      <th className="p-2.5">Modo</th>
                      <th className="p-2.5">Modelo</th>
                      <th className="p-2.5 text-right">Prompt</th>
                      <th className="p-2.5 text-right">Resposta</th>
                      <th className="p-2.5 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--panel-border-color)]">
                    {!aiMetrics?.recentLogs || aiMetrics.recentLogs.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center opacity-60">
                          Nenhuma chamada de IA registrada ainda.
                        </td>
                      </tr>
                    ) : (
                      aiMetrics.recentLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-[var(--input-bg-color)] transition-colors">
                          <td className="p-2.5 opacity-75">{new Date(log.timestamp).toLocaleTimeString()}</td>
                          <td className="p-2.5 font-sans font-semibold">{log.username}</td>
                          <td className="p-2.5 opacity-60 truncate max-w-[120px]">{log.sessionId || "Global"}</td>
                          <td className="p-2.5">
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                              {log.mode}
                            </span>
                          </td>
                          <td className="p-2.5 opacity-75">{log.model}</td>
                          <td className="p-2.5 text-right">{log.promptTokens}</td>
                          <td className="p-2.5 text-right">{log.responseTokens}</td>
                          <td className="p-2.5 text-right font-bold text-amber-400">{log.totalTokens}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ACTIVE SESSIONS & ROOMS MONITOR */}
        {activeTab === "SESSIONS" && (
          <div className="p-5 border-2 rounded-xl glass-panel neo-shadow space-y-4"
            style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--primary-color)" }}>
                  <span className="codicon codicon-live-share" /> Monitor de Salas & Workspaces
                </h3>
                <p className="text-xs opacity-70 mt-0.5" style={{ color: "var(--text-muted-color)" }}>
                  Salas com usuários ativos conectam via WebSocket em tempo real.
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 border rounded-lg" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}>
                <button
                  onClick={() => setSessionFilter("ALL")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${sessionFilter === "ALL" ? "bg-[var(--primary-color)] text-white shadow-sm" : "opacity-70 hover:opacity-100"}`}
                >
                  Todas ({sessionsList.length})
                </button>
                <button
                  onClick={() => setSessionFilter("ACTIVE")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${sessionFilter === "ACTIVE" ? "bg-emerald-500 text-white shadow-sm" : "text-emerald-400 opacity-70 hover:opacity-100"}`}
                >
                  <span className="codicon codicon-circle-filled text-[10px]" />
                  <span>Ativas Online ({activeRoomsList.length})</span>
                </button>
                <button
                  onClick={() => setSessionFilter("INACTIVE")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${sessionFilter === "INACTIVE" ? "bg-gray-500 text-white shadow-sm" : "opacity-70 hover:opacity-100"}`}
                >
                  <span className="codicon codicon-circle-outline text-[10px]" />
                  <span>Inativas ({Math.max(0, sessionsList.length - activeRoomsList.length)})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b-2 opacity-70 uppercase" style={{ borderColor: "var(--panel-border-color)" }}>
                    <th className="p-3">ID da Sala (Session ID)</th>
                    <th className="p-3">Status em Tempo Real</th>
                    <th className="p-3">Proprietário</th>
                    <th className="p-3">Arquivos no Workspace</th>
                    <th className="p-3">Criado em</th>
                    <th className="p-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--panel-border-color)]">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center opacity-60">
                        Nenhuma sala encontrada com o filtro selecionado.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((s) => {
                      const activeRoomInfo = activeRoomsList.find(r => r.sessionId === s.publicId);
                      const isOnline = !!activeRoomInfo;
                      const participants = activeRoomInfo?.participants || [];
                      const usersInRoom = activeRoomInfo?.users || [];

                      return (
                        <tr key={s.id} className="hover:bg-[var(--input-bg-color)] transition-colors">
                          <td className="p-3 font-bold text-indigo-400">
                            <span>{s.publicId}</span>
                          </td>
                          <td className="p-3 font-sans">
                            {isOnline ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 w-fit">
                                  <span className="codicon codicon-circle-filled text-[10px] animate-pulse" />
                                  <span>Online ({participants.length} {participants.length === 1 ? 'participante' : 'participantes'})</span>
                                </span>
                                <div className="text-[11px] opacity-80 flex flex-wrap gap-1 items-center">
                                  {usersInRoom.map((u, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 bg-black/10 px-1.5 py-0.5 rounded text-[10px]">
                                      <span className="codicon codicon-account text-[10px] opacity-70" />
                                      <b>{u.username}</b>
                                      <button
                                        onClick={() => handleKickUser(s.publicId, u.userId, u.username)}
                                        className="text-red-400 hover:text-red-300 ml-0.5 cursor-pointer flex items-center"
                                        title="Desconectar este usuário"
                                      >
                                        <span className="codicon codicon-close text-[10px]" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/20 text-gray-400">
                                <span className="codicon codicon-circle-outline text-[10px]" />
                                <span>Inativa (0 online)</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-sans font-semibold">{s.ownerUsername}</td>
                          <td className="p-3">{s.filesCount} arquivos</td>
                          <td className="p-3 opacity-75">{s.createdAt ? new Date(s.createdAt).toLocaleString() : "-"}</td>
                          <td className="p-3 text-right font-sans">
                            <a
                              href={`/?sessionId=${s.publicId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 border rounded text-[10px] font-bold mr-1 hover:opacity-80 transition-opacity"
                              style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}
                            >
                              Entrar
                            </a>
                            <button
                              onClick={() => handleDeleteSession(s.publicId)}
                              className="px-2.5 py-1 border rounded text-[10px] font-bold text-red-500 hover:bg-red-500/10 transition-colors"
                              style={{ borderColor: "var(--panel-border-color)" }}
                            >
                              Encerrar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

