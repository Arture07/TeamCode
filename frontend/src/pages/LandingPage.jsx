import React, { useState } from "react";

export default function LandingPage({ onOpenAuth, ThemeSwitcher }) {
  const [demoSessionName, setDemoSessionName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const handleLaunchDemo = async (e) => {
    if (e) e.preventDefault();
    const name = demoSessionName.trim() || `Demo_${Math.random().toString(36).substring(2, 7)}`;
    setIsCreating(true);
    setCreateError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionName: name,
          ownerUsername: "Guest",
          rawPassword: "",
        }),
      });

      if (!res.ok) {
        throw new Error(`Erro ao criar sessão (${res.status})`);
      }

      const data = await res.json();
      if (data.publicId) {
        window.location.href = `/?sessionId=${data.publicId}`;
      } else {
        throw new Error("ID da sessão não retornado");
      }
    } catch (err) {
      console.error("Falha ao criar sessão demo:", err);
      setCreateError("Não foi possível conectar ao serviço de sessões. Tente novamente.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-500 overflow-x-hidden">
      {/* ---------------- NAVIGATION HEADER ---------------- */}
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md transition-colors duration-300"
        style={{
          backgroundColor: "var(--header-bg-color, var(--panel-bg-color))",
          borderColor: "var(--panel-border-color)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span
              className="w-9 h-9 border-2 flex items-center justify-center font-black text-lg neo-shadow"
              style={{
                backgroundColor: "var(--primary-color)",
                borderColor: "var(--panel-border-color)",
                color: "#000000",
              }}
            >
              <span className="codicon codicon-code" style={{ fontSize: "20px" }} />
            </span>
            <span className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: "var(--primary-color)" }}>
              CodeSync
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-bold">
            <a href="#recursos" className="hover:opacity-75 transition-opacity" style={{ color: "var(--text-color)" }}>
              Recursos
            </a>
            <a href="#terminal" className="hover:opacity-75 transition-opacity" style={{ color: "var(--text-color)" }}>
              Terminal PTY
            </a>
            <a href="#ia" className="hover:opacity-75 transition-opacity" style={{ color: "var(--text-color)" }}>
              IA Gemini
            </a>
            <a href="#arquitetura" className="hover:opacity-75 transition-opacity" style={{ color: "var(--text-color)" }}>
              Arquitetura
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {ThemeSwitcher && <ThemeSwitcher />}

            <a
              href="https://github.com/Arture07/CodeSync"
              target="_blank"
              rel="noreferrer"
              title="Repositório no GitHub"
              className="p-2 border-2 rounded-none neo-shadow-button transition-all flex items-center justify-center"
              style={{
                backgroundColor: "var(--panel-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--text-color)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </a>

            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 border-2 font-bold neo-shadow-button text-xs sm:text-sm flex items-center gap-1.5"
              style={{
                backgroundColor: "var(--button-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--button-text-color)",
              }}
            >
              <span className="codicon codicon-account" />
              <span>Entrar</span>
            </button>
          </div>
        </div>
      </header>

      {/* ---------------- HERO SECTION ---------------- */}
      <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 border-2 font-bold text-xs tracking-wide uppercase neo-shadow"
            style={{
              backgroundColor: "var(--primary-bg-color, var(--panel-bg-color))",
              borderColor: "var(--panel-border-color)",
              color: "var(--primary-color)",
            }}
          >
            <span className="codicon codicon-radio-tower" />
            <span>Cloud-Native Collaborative IDE</span>
          </div>

          <h1
            className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight"
            style={{ color: "var(--text-color)" }}
          >
            Desenvolvimento Colaborativo em{" "}
            <span style={{ color: "var(--primary-color)" }}>Tempo Real</span>
          </h1>

          <p
            className="text-base sm:text-lg md:text-xl font-normal max-w-3xl mx-auto leading-relaxed"
            style={{ color: "var(--text-muted-color)" }}
          >
            Uma plataforma completa de desenvolvimento em nuvem. Edite código simultaneamente com
            Monaco Editor, execute programas em um terminal Linux interativo PTY, converse com IA Google Gemini
            e gerencie repositórios Git com arquitetura distribuída de microsserviços.
          </p>

          {/* Action CTAs */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={handleLaunchDemo}
              disabled={isCreating}
              className="px-6 py-3.5 border-2 font-bold text-sm sm:text-base neo-shadow-button flex items-center gap-2 disabled:opacity-50"
              style={{
                backgroundColor: "var(--primary-color)",
                borderColor: "var(--panel-border-color)",
                color: "#000000",
              }}
            >
              <span className={`codicon ${isCreating ? "codicon-loading codicon-modifier-spin" : "codicon-play"}`} />
              <span>{isCreating ? "Criando Workspace..." : "Iniciar Workspace Demo"}</span>
            </button>

            <button
              onClick={onOpenAuth}
              className="px-6 py-3.5 border-2 font-bold text-sm sm:text-base neo-shadow-button flex items-center gap-2"
              style={{
                backgroundColor: "var(--panel-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--text-color)",
              }}
            >
              <span className="codicon codicon-sign-in" />
              <span>Entrar com Conta</span>
            </button>

            <a
              href="https://github.com/Arture07/CodeSync"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3.5 border-2 font-bold text-sm sm:text-base neo-shadow-button flex items-center gap-2"
              style={{
                backgroundColor: "var(--input-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--text-color)",
              }}
            >
              <span className="codicon codicon-github" />
              <span>GitHub</span>
            </a>
          </div>

          {createError && (
            <div
              className="p-3 border-2 max-w-md mx-auto text-xs"
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                borderColor: "rgba(239, 68, 68, 0.5)",
                color: "rgb(252, 165, 165)",
              }}
            >
              {createError}
            </div>
          )}
        </div>

        {/* ---------------- REALISTIC IDE PREVIEW FRAME ---------------- */}
        <div className="mt-12 sm:mt-16 max-w-5xl mx-auto">
          <div
            className="border-2 glass-panel neo-shadow overflow-hidden"
            style={{
              backgroundColor: "var(--panel-bg-color)",
              borderColor: "var(--panel-border-color)",
            }}
          >
            {/* Window Topbar */}
            <div
              className="h-10 px-4 border-b flex items-center justify-between"
              style={{
                backgroundColor: "var(--header-bg-color, var(--panel-bg-color))",
                borderColor: "var(--panel-border-color)",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block border border-black/30" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block border border-black/30" />
                <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block border border-black/30" />
              </div>

              {/* Mock Tabs */}
              <div className="flex items-center gap-1 text-xs font-mono">
                <div
                  className="px-3 py-1 border-t-2 border-r border-l flex items-center gap-1.5"
                  style={{
                    backgroundColor: "var(--input-bg-color)",
                    borderColor: "var(--primary-color)",
                    color: "var(--text-color)",
                  }}
                >
                  <span className="codicon codicon-file-code text-blue-400" />
                  <span>App.jsx</span>
                </div>
                <div
                  className="px-3 py-1 flex items-center gap-1.5 opacity-60 hover:opacity-100 cursor-pointer"
                  style={{ color: "var(--text-muted-color)" }}
                >
                  <span className="codicon codicon-file-code text-yellow-400" />
                  <span>server.py</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs opacity-75">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span>2 Online</span>
                </span>
              </div>
            </div>

            {/* Editor Workspace Mock Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 font-mono text-xs sm:text-sm">
              {/* Left Code Area */}
              <div className="md:col-span-7 p-4 space-y-1 overflow-x-auto border-b md:border-b-0 md:border-r" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}>
                <div className="text-gray-500">// CodeSync Real-time Collaborative Session</div>
                <div><span className="text-purple-400">import</span> React, &#123; useState, useEffect &#125; <span className="text-purple-400">from</span> <span className="text-green-400">"react"</span>;</div>
                <div className="py-1"></div>
                <div><span className="text-blue-400">export default function</span> <span className="text-yellow-400">LiveWorkspace</span>() &#123;</div>
                <div className="pl-4"><span className="text-blue-400">const</span> [peers, setPeers] = <span className="text-yellow-300">useState</span>([<span className="text-green-400">"Artur"</span>, <span className="text-green-400">"Alex"</span>]);</div>
                <div className="pl-4 relative">
                  <span className="text-blue-400">const</span> [status, setStatus] = <span className="text-yellow-300">useState</span>(<span className="text-green-400">"connected"</span>);
                  {/* Collaborative cursor mock */}
                  <span
                    className="inline-block px-1.5 py-0.5 ml-2 text-[10px] font-sans font-bold border"
                    style={{ backgroundColor: "var(--primary-color)", color: "#000000", borderColor: "var(--panel-border-color)" }}
                  >
                    Artur (editando)
                  </span>
                </div>
                <div className="py-1"></div>
                <div className="pl-4"><span className="text-purple-400">return</span> (</div>
                <div className="pl-8 text-cyan-300">&lt;<span className="text-blue-400">div</span> className=<span className="text-green-400">"realtime-editor"</span>&gt;</div>
                <div className="pl-12 text-gray-300">&lt;<span className="text-blue-400">h1</span>&gt;CodeSync Cloud IDE&lt;/<span className="text-blue-400">h1</span>&gt;</div>
                <div className="pl-8 text-cyan-300">&lt;/<span className="text-blue-400">div</span>&gt;</div>
                <div className="pl-4">);</div>
                <div>&#125;</div>
              </div>

              {/* Right Terminal & AI Preview */}
              <div className="md:col-span-5 flex flex-col justify-between" style={{ backgroundColor: "var(--terminal-bg-color, #000000)", color: "var(--terminal-text-color, #FF8C00)" }}>
                {/* Terminal Header */}
                <div className="p-3 border-b flex items-center justify-between text-xs" style={{ borderColor: "var(--panel-border-color)" }}>
                  <div className="flex items-center gap-1.5">
                    <span className="codicon codicon-terminal" />
                    <span className="font-bold">Linux PTY Terminal</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 border border-green-500/50 text-green-400">PORT :3000 READY</span>
                </div>

                {/* Terminal Lines */}
                <div className="p-4 space-y-2 text-xs font-mono overflow-y-auto">
                  <p className="text-gray-400">$ node --version && npm run dev</p>
                  <p className="text-green-400">v20.18.0</p>
                  <p className="text-cyan-400">&gt; codesync-app@1.0.0 dev</p>
                  <p className="text-yellow-400">&gt; vite --host 0.0.0.0 --port 3000</p>
                  <p className="text-gray-300">➜ Local: http://localhost:3000/</p>
                  <p className="text-green-400">➜ Live Preview: /port/3000/ (Active)</p>
                  <p className="text-gray-400 flex items-center gap-1">
                    <span>$</span>
                    <span className="w-2 h-4 bg-yellow-400 inline-block animate-pulse"></span>
                  </p>
                </div>

                {/* AI Gemini Status Mini Banner */}
                <div
                  className="p-3 border-t flex items-center justify-between text-xs"
                  style={{
                    backgroundColor: "var(--panel-bg-color)",
                    borderColor: "var(--panel-border-color)",
                    color: "var(--text-color)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="codicon codicon-sparkle text-purple-400" />
                    <span className="font-bold">Google Gemini 3.7</span>
                  </div>
                  <span className="text-[11px] opacity-75">Agent Mode Ativo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- INSTANT LAUNCHER CARD ---------------- */}
        <div className="mt-8 max-w-2xl mx-auto">
          <form
            onSubmit={handleLaunchDemo}
            className="p-4 sm:p-6 border-2 glass-panel neo-shadow flex flex-col sm:flex-row gap-3 items-center"
            style={{
              backgroundColor: "var(--panel-bg-color)",
              borderColor: "var(--panel-border-color)",
            }}
          >
            <div className="w-full sm:flex-1">
              <label className="block text-xs font-bold mb-1 opacity-75" style={{ color: "var(--text-color)" }}>
                Nome do Projeto / Sessão:
              </label>
              <input
                type="text"
                value={demoSessionName}
                onChange={(e) => setDemoSessionName(e.target.value)}
                placeholder="Ex: meu-projeto-react"
                className="w-full px-3.5 py-2.5 border-2 focus:outline-none focus:ring-2 text-sm"
                style={{
                  backgroundColor: "var(--input-bg-color)",
                  borderColor: "var(--panel-border-color)",
                  color: "var(--text-color)",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full sm:w-auto px-6 py-2.5 sm:mt-5 border-2 font-bold text-sm neo-shadow-button flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
              style={{
                backgroundColor: "var(--button-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--button-text-color)",
              }}
            >
              <span className={`codicon ${isCreating ? "codicon-loading codicon-modifier-spin" : "codicon-arrow-right"}`} />
              <span>{isCreating ? "Criando..." : "Abrir Sala Agora"}</span>
            </button>
          </form>
        </div>
      </section>

      {/* ---------------- CORE FEATURES SECTION ---------------- */}
      <section id="recursos" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-t transition-colors" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--header-bg-color, var(--panel-bg-color))" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 border-2 font-bold text-xs uppercase neo-shadow"
              style={{
                backgroundColor: "var(--panel-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--primary-color)",
              }}
            >
              <span className="codicon codicon-tools" />
              <span>Capacidades da Plataforma</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black" style={{ color: "var(--text-color)" }}>
              Projetado para Engenharia de Software Colaborativa
            </h2>
            <p className="text-base font-normal" style={{ color: "var(--text-muted-color)" }}>
              Recursos de nível industrial para times, pares de desenvolvimento e projetos educacionais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div
              className="p-6 border-2 glass-panel neo-shadow flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}
            >
              <div className="space-y-3">
                <div
                  className="w-10 h-10 border-2 flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: "var(--primary-color)", borderColor: "var(--panel-border-color)", color: "#000000" }}
                >
                  <span className="codicon codicon-sync" />
                </div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>Sincronização em Tempo Real</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted-color)" }}>
                  Edição simultânea com Monaco Editor, cursores coloridos identificados por usuário, seleção de código e presença via STOMP sobre WebSockets e Redis Pub/Sub.
                </p>
              </div>
              <div className="pt-2 text-[11px] font-mono opacity-60">WebSockets • STOMP • Redis Relay</div>
            </div>

            {/* Feature 2 */}
            <div
              id="terminal"
              className="p-6 border-2 glass-panel neo-shadow flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}
            >
              <div className="space-y-3">
                <div
                  className="w-10 h-10 border-2 flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: "var(--primary-color)", borderColor: "var(--panel-border-color)", color: "#000000" }}
                >
                  <span className="codicon codicon-terminal" />
                </div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>Terminal Linux PTY</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted-color)" }}>
                  Sessão interativa de terminal com suporte a Node.js, Python, Go, Rust, C++, Ruby, PHP e Lua, com tratamento avançado de sinais (Ctrl+C, Ctrl+V).
                </p>
              </div>
              <div className="pt-2 text-[11px] font-mono opacity-60">PTY Nativo • Multi-Runtime</div>
            </div>

            {/* Feature 3 */}
            <div
              id="ia"
              className="p-6 border-2 glass-panel neo-shadow flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}
            >
              <div className="space-y-3">
                <div
                  className="w-10 h-10 border-2 flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: "var(--primary-color)", borderColor: "var(--panel-border-color)", color: "#000000" }}
                >
                  <span className="codicon codicon-sparkle" />
                </div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>IA Google Gemini 3.7</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted-color)" }}>
                  Assistente contextual com streaming, autocompletar inteligente, function calling (Agent Mode para criação/edição de arquivos) e fallback resiliente.
                </p>
              </div>
              <div className="pt-2 text-[11px] font-mono opacity-60">Gemini 3.7 • Agent Mode • FinOps</div>
            </div>

            {/* Feature 4 */}
            <div
              className="p-6 border-2 glass-panel neo-shadow flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}
            >
              <div className="space-y-3">
                <div
                  className="w-10 h-10 border-2 flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: "var(--primary-color)", borderColor: "var(--panel-border-color)", color: "#000000" }}
                >
                  <span className="codicon codicon-source-control" />
                </div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>Painel Git Visual</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted-color)" }}>
                  Interface visual de versionamento para conferir status de arquivos, staging individual, criação de commits, push, pull e alternância de branches.
                </p>
              </div>
              <div className="pt-2 text-[11px] font-mono opacity-60">Git CLI • JGit • Diff Viewer</div>
            </div>

            {/* Feature 5 */}
            <div
              className="p-6 border-2 glass-panel neo-shadow flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}
            >
              <div className="space-y-3">
                <div
                  className="w-10 h-10 border-2 flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: "var(--primary-color)", borderColor: "var(--panel-border-color)", color: "#000000" }}
                >
                  <span className="codicon codicon-edit" />
                </div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>Lousa Virtual (Whiteboard)</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted-color)" }}>
                  Excalidraw integrado na mesma sala para desenhar arquiteturas de software, fluxogramas e diagramas conceituais com sincronização em tempo real.
                </p>
              </div>
              <div className="pt-2 text-[11px] font-mono opacity-60">Excalidraw • Diagramas Colaborativos</div>
            </div>

            {/* Feature 6 */}
            <div
              className="p-6 border-2 glass-panel neo-shadow flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}
            >
              <div className="space-y-3">
                <div
                  className="w-10 h-10 border-2 flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: "var(--primary-color)", borderColor: "var(--panel-border-color)", color: "#000000" }}
                >
                  <span className="codicon codicon-server-process" />
                </div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>Dynamic Port Forwarding</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted-color)" }}>
                  Preview web instantâneo de servidores iniciados dentro do terminal (portas 3000-3005, 5000-5005, 8000-8005) roteados através da porta 443 do Nginx.
                </p>
              </div>
              <div className="pt-2 text-[11px] font-mono opacity-60">Roteamento Dinâmico • Port Preview</div>
            </div>

            {/* Feature 7 */}
            <div
              className="p-6 border-2 glass-panel neo-shadow flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}
            >
              <div className="space-y-3">
                <div
                  className="w-10 h-10 border-2 flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: "var(--primary-color)", borderColor: "var(--panel-border-color)", color: "#000000" }}
                >
                  <span className="codicon codicon-shield" />
                </div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>Console Super Admin</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted-color)" }}>
                  Observabilidade em tempo real com telemetria da JVM (RAM, threads), disco da VM, FinOps detalhado de consumo de tokens Gemini e gestão RBAC de usuários.
                </p>
              </div>
              <div className="pt-2 text-[11px] font-mono opacity-60">Telemetria JVM • FinOps • RBAC</div>
            </div>

            {/* Feature 8 */}
            <div
              className="p-6 border-2 glass-panel neo-shadow flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform"
              style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)" }}
            >
              <div className="space-y-3">
                <div
                  className="w-10 h-10 border-2 flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: "var(--primary-color)", borderColor: "var(--panel-border-color)", color: "#000000" }}
                >
                  <span className="codicon codicon-layers" />
                </div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>Microsserviços Cloud</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted-color)" }}>
                  Arquitetura distribuída em contêineres Docker (User, Session e Sync services) com PostgreSQL 14 versionado via Flyway e Redis 7 Alpine na Oracle Cloud.
                </p>
              </div>
              <div className="pt-2 text-[11px] font-mono opacity-60">Spring Boot 3 • PostgreSQL • Docker</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- ARCHITECTURE SECTION ---------------- */}
      <section id="arquitetura" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 border-2 font-bold text-xs uppercase neo-shadow"
            style={{
              backgroundColor: "var(--panel-bg-color)",
              borderColor: "var(--panel-border-color)",
              color: "var(--primary-color)",
            }}
          >
            <span className="codicon codicon-graph" />
            <span>Topologia de Infraestrutura</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black" style={{ color: "var(--text-color)" }}>
            Arquitetura de Microsserviços
          </h2>
          <p className="text-base font-normal" style={{ color: "var(--text-muted-color)" }}>
            Projetada para isolamento de responsabilidades, escalabilidade horizontal e baixa latência.
          </p>
        </div>

        <div
          className="p-6 sm:p-8 border-2 glass-panel neo-shadow max-w-4xl mx-auto"
          style={{
            backgroundColor: "var(--panel-bg-color)",
            borderColor: "var(--panel-border-color)",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            {/* Box 1 */}
            <div className="p-4 border-2 flex flex-col items-center justify-center space-y-2" style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)" }}>
              <span className="codicon codicon-browser text-2xl" style={{ color: "var(--primary-color)" }} />
              <h4 className="font-bold text-sm" style={{ color: "var(--text-color)" }}>Frontend & Reverse Proxy</h4>
              <p className="text-xs" style={{ color: "var(--text-muted-color)" }}>React 18 + Vite + Nginx (Portas 80/443, SSL Let's Encrypt)</p>
            </div>

            {/* Box 2 */}
            <div className="p-4 border-2 flex flex-col items-center justify-center space-y-2" style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)" }}>
              <span className="codicon codicon-server text-2xl" style={{ color: "var(--primary-color)" }} />
              <h4 className="font-bold text-sm" style={{ color: "var(--text-color)" }}>Spring Boot Core Services</h4>
              <p className="text-xs" style={{ color: "var(--text-muted-color)" }}>User-Service (Auth & JWT) + Session-Service (Árvore & Gemini IA)</p>
            </div>

            {/* Box 3 */}
            <div className="p-4 border-2 flex flex-col items-center justify-center space-y-2" style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)" }}>
              <span className="codicon codicon-database text-2xl" style={{ color: "var(--primary-color)" }} />
              <h4 className="font-bold text-sm" style={{ color: "var(--text-color)" }}>Sync Engine & Persistence</h4>
              <p className="text-xs" style={{ color: "var(--text-muted-color)" }}>Sync-Service (PTY & WebSockets), Redis 7 e PostgreSQL 14</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t flex flex-wrap items-center justify-around gap-4 text-xs font-mono" style={{ borderColor: "var(--panel-border-color)" }}>
            <span className="flex items-center gap-1.5">
              <span className="codicon codicon-pass text-green-400" />
              <span>Ubuntu 24.04 LTS (OCI Compute)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="codicon codicon-pass text-green-400" />
              <span>CI/CD via GitHub Actions & GHCR</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="codicon codicon-pass text-green-400" />
              <span>Deploy em ~10s com Docker Compose</span>
            </span>
          </div>
        </div>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer
        className="mt-auto border-t py-8 px-4 sm:px-6 lg:px-8 transition-colors"
        style={{
          backgroundColor: "var(--header-bg-color, var(--panel-bg-color))",
          borderColor: "var(--panel-border-color)",
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm" style={{ color: "var(--primary-color)" }}>
              CodeSync
            </span>
            <span style={{ color: "var(--text-muted-color)" }}>
              — Open Source Collaborative Cloud IDE
            </span>
          </div>

          <div className="flex items-center gap-6 font-bold">
            <a
              href="https://github.com/Arture07/CodeSync"
              target="_blank"
              rel="noreferrer"
              className="hover:underline flex items-center gap-1"
              style={{ color: "var(--text-color)" }}
            >
              <span className="codicon codicon-github" />
              <span>GitHub</span>
            </a>
            <button
              onClick={onOpenAuth}
              className="hover:underline flex items-center gap-1"
              style={{ color: "var(--text-color)" }}
            >
              <span className="codicon codicon-account" />
              <span>Área de Usuário</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
