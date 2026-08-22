# 🚀 TeamCode — Resumo Técnico do Projeto

> **Guarde este documento ou copie o conteúdo abaixo para iniciar novas sessões no Antigravity ou em qualquer assistente de IA.**

---

## 📌 1. Visão Geral
O **TeamCode** é uma plataforma web completa de desenvolvimento colaborativo em tempo real (**Cloud/Live Coding IDE**) baseada em uma arquitetura distribuída de microsserviços em contêineres Docker.

* **Objetivo:** Permitir que múltiplos desenvolvedores editem código simultaneamente, executem comandos em terminal Linux interativo (PTY), façam diagramas em lousa virtual (Whiteboard), gerenciem versionamento Git, utilizem inteligência artificial e monitorem a infraestrutura através de um console Super Admin.
* **Ambiente de Produção:** Oracle Cloud Infrastructure (OCI Compute VM — Ubuntu 24.04 LTS x86_64).
* **CI/CD:** GitHub Actions + GitHub Container Registry (GHCR) para deploys automáticos em ~10 segundos.

---

## 🏗️ 2. Arquitetura de Microsserviços & Stack

```
                                  [ INTERNET ]
                                       │ (Portas 80 / 443)
                             ┌─────────▼─────────┐
                             │  Nginx (Frontend) │
                             └────┬───┬───┬───┬──┘
                                  │   │   │   │
        ┌─────────────────────────┘   │   │   └─────────────────────────┐
        │ /api/users                  │   │ /api/sessions, /api/ai      │ /ws-connect, /api/git
┌───────▼─────────────┐               │ ┌─▼───────────────────┐ ┌───────▼─────────────┐
│ teamcode-user-      │               │ │ teamcode-session-   │ │ teamcode-sync-      │
│ service (Port 8080) │               │ │ service (Port 8080) │ │ service (Port 8082) │
└───────┬─────────────┘               │ └─┬───────────────────┘ └───────┬─────────────┘
        │                             │   │                             │
        └──────────────┬──────────────┘   │                             │
                       │                  │                             │
               ┌───────▼─────────┐        │                     ┌───────▼─────────┐
               │ PostgreSQL 14   │◄───────┘                     │ Redis 7 Relay   │
               │ (teamcode_db)   │                              │ (Pub/Sub & Cache│
               └─────────────────┘                              └─────────────────┘
```

### 1. `teamcode-frontend` (Portas 80 e 443)
* **Stack:** React 18, Vite, Monaco Editor, Lucide Icons, Codicons, Nginx.
* **Nginx Reverse Proxy:** Atua como ponto de entrada unificado, roteando requisições REST para os microsserviços, gerenciando WebSockets (`/ws-connect`), rate limiting, dynamic port forwarding (`/port/:id/`) e certificados SSL Let's Encrypt para DuckDNS.
* **Roteamento SPA:** Suporta rotas `/`, `/?sessionId=...` e `/admin` (Dashboard do Super Admin).

### 2. `teamcode-user-service` (Porta interna 8080)
* **Stack:** Java 17, Spring Boot 3, Spring Security, JWT (HMAC-SHA256), BCrypt, PostgreSQL 14, Flyway.
* **Responsabilidades:** 
  * Cadastro e autenticação local (com sanitização e BCrypt).
  * Autenticação OAuth (Google ID Token e GitHub OAuth).
  * **RBAC:** Suporte a papéis `ROLE_USER` e `ROLE_SUPER_ADMIN`.
  * **CORS Dinâmico:** Leitura de `CORS_ALLOWED_ORIGIN_PATTERNS` sem hardcode.
  * **Endpoints Admin (`/api/users/admin/**`):** Listagem, estatísticas, alteração de permissões, bloqueio/desbloqueio e exclusão de contas.
  * **Auto-Provisioning:** Inicializador que cria automaticamente a conta Super Admin (`admin`) no boot.

### 3. `teamcode-session-service` (Porta interna 8080)
* **Stack:** Java 17, Spring Boot 3, Spring Data JPA, PostgreSQL 14, RestTemplate.
* **Responsabilidades:**
  * Ciclo de vida das salas/projetos de código e persistência da árvore de arquivos (`session_file`).
  * **IA Google Gemini (`gemini-3.7-flash`):** Chat contextual, autocompletar inteligente e function calling (modo agente com prevenção de loop e criação sequencial).
  * **Cadeia de Fallback Automática:** `gemini-3.7-flash` $\rightarrow$ `gemini-3.6-flash` $\rightarrow$ `gemini-flash-lite-latest` $\rightarrow$ `gemini-2.5-flash` $\rightarrow$ `gemini-2.0-flash`.
  * **FinOps & Auditoria:** Gravação de cada chamada na tabela `ai_usage_log` (`prompt_tokens`, `response_tokens`, `total_tokens`, `usedModel`, timestamps).
  * **Endpoints de Telemetria (`/api/sessions/admin/**`):** Leituras reais da JVM (RAM usada/livre/máxima), disco da VM (espaço usado/livre/total), vCPUs, threads e monitor de sessões ativas.

### 4. `teamcode-sync-service` (Portas 8082 + 3000-3005, 5000-5005, 8000-8005)
* **Stack:** Java 17, Spring Boot 3, STOMP sobre WebSockets, SockJS, Redis Relay, PTY (Pseudo-Terminal) Linux, JGit/CLI Git.
* **Responsabilidades:**
  * Broadcast de cursores coloridos, digitação em tempo real, seleção de código e presença de usuários.
  * Terminal PTY integrado com suporte a múltiplos interpretadores (Node, Python, Go, Rust, C++, Ruby, PHP, Lua) e tratamento inteligente de `Ctrl+C` e `Ctrl+V`.
  * Painel Git visual (status, stage, commit, push, pull, branch switch).
  * Port Forwarding para preview de aplicações web rodando dentro do terminal (portas 3000-3005, 5000-5005, 8000-8005).

### 5. `teamcode-postgres` & `teamcode-redis`
* **PostgreSQL 14:** Banco relacional (`teamcode_db`) com migrations versionadas via Flyway (`V1`, `V2`, `V3`).
* **Redis 7 Alpine:** Mensageria distribuída e Pub/Sub para sincronização de sessões entre múltiplos nós.

---

## 🛡️ 3. Console Super Admin & Observability (`/admin`)

* **Acesso:** Exclusivo para usuários com a role `ROLE_SUPER_ADMIN` (ex: `admin` / `admin123`).
* **Funcionalidades do Painel:**
  1. **🖥️ Infraestrutura & VM:** Gráficos de uso real de RAM da JVM, ocupação de disco da VM, vCPUs, threads e uptime.
  2. **🧠 FinOps & Tokens Gemini:** Contadores em tempo real de tokens consumidos, custo acumulado estimado em USD e tabela com histórico das últimas 50 chamadas de IA.
  3. **👥 Gestão de Usuários:** Listagem de todas as contas, badges de provedor (Local, Google, GitHub), botões para promover a admin, bloquear/desbloquear e excluir.
  4. **💻 Monitor de Salas:** Lista de projetos ativos com contagem de arquivos e opção de encerramento forçado.

---

## 🚀 4. Comandos Essenciais

* **Na VM / Servidor de Produção (Download e atualização em ~10s via GHCR):**
  ```bash
  git pull origin main
  docker compose pull
  docker compose up -d
  ```
* **No Ambiente de Desenvolvimento Local (Compilação local):**
  ```bash
  docker compose up -d --build
  ```
* **Verificar status e saúde dos contêineres:**
  ```bash
  docker compose ps
  ```
* **Ver logs em tempo real:**
  ```bash
  docker compose logs -f
  ```
