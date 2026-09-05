# CrewCode — Resumo Técnico e Arquitetural do Projeto

> **Documento Oficial de Referência do Projeto.**
> Guarde este arquivo ou utilize seu conteúdo para contextualizar novas sessões de desenvolvimento, agentes de IA ou auditorias técnicas.

---

## 1. Visão Geral

O **CrewCode** é uma plataforma web moderna e distribuída de desenvolvimento colaborativo em tempo real (**Cloud/Live Coding IDE**), inspirada em soluções como *VS Code Live Share* e *Replit*, operando 100% no navegador.

* **Objetivo Principal:** Permitir que desenvolvedores e equipes trabalhem no mesmo código simultaneamente, com edição síncrona, terminal Linux interativo (PTY) com múltiplos interpretadores, controle de versão Git visual com Diff, assistência de inteligência artificial multimodal (Google Gemini), lousa virtual (Excalidraw), ferramentas de produtividade e um console Super Admin para observabilidade e FinOps.
* **Infraestrutura & Nuvem:** Oracle Cloud Infrastructure (OCI Compute VM — Ubuntu 24.04 LTS x86_64).
* **Esteira CI/CD:** GitHub Actions integrada ao GitHub Container Registry (GHCR), permitindo compilação automatizada e deploys em produção em menos de 10 segundos via `docker compose pull && docker compose up -d`.

---

## 2. Arquitetura de Microsserviços & Fluxo de Rede

```
                                  [ INTERNET ]
                                       │ (Portas 80 / 443)
                             ┌─────────▼─────────┐
                             │  Nginx (Frontend) │
                             └────┬───┬───┬───┬──┘
                                  │   │   │   │
        ┌─────────────────────────┘   │   │   └─────────────────────────────────┐
        │ /api/users                  │   │ /api/sessions, /api/ai              │ /ws-connect, /api/git,
┌───────▼─────────────┐               │ ┌─▼───────────────────┐                 │ /api/sync, /port/*
│ crewcode-user-      │               │ │ crewcode-session-   │         ┌───────▼─────────────┐
│ service (Port 8080) │               │ │ service (Port 8080) │         │ crewcode-sync-      │
└───────┬─────────────┘               │ └─┬───────────────────┘         │ service (Port 8082) │
        │                             │   │                             └───────┬─────────────┘
        └──────────────┬──────────────┘   │                                     │
                       │                  │                                     │
               ┌───────▼─────────┐        │                             ┌───────▼─────────┐
               │ PostgreSQL 14   │◄───────┘                             │ Redis 7 Relay   │
               │ (crewcode_db)   │                                      │ (Pub/Sub & Cache│
               └─────────────────┘                                      └─────────────────┘
```

---

## 3. Detalhamento dos Componentes

### 1. `crewcode-frontend` (Portas 80 e 443 — SPA + Nginx)
* **Stack:** React 18, Vite, Monaco Editor, Xterm.js, `@excalidraw/excalidraw`, Lucide Icons, Codicons, TailwindCSS / Vanilla CSS.
* **Páginas & Roteamento SPA:**
  * **Landing Page (`/` para visitantes):** Apresentação visual da plataforma com recursos, demonstração interativa, depoimentos, seletor de temas e CTAs para login/cadastro.
  * **Página de Autenticação (`/login` ou modal):** Login local com sanitização, criação de conta e botões de **OAuth Social** (Google One Tap / ID Token e GitHub OAuth Flow).
  * **Dashboard do Usuário (`/` para autenticados):** Gerenciador de workspaces/salas, listagem de projetos ativos, busca e criação rápida de novas sessões.
  * **IDE / Editor Principal (`/?sessionId=...`):** Workspace colaborativo completo (Monaco, Árvore de arquivos recursiva, Terminal multi-abas, Painel Git, IA, Whiteboard, Pomodoro, etc.).
  * **Console Super Admin (`/admin`):** Dashboard exclusivo de observabilidade, telemetria de hardware/JVM, FinOps Gemini e governança de usuários.
* **Nginx Reverse Proxy & Segurança:**
  * Ponto único de entrada (Single Entrypoint) para REST APIs e WebSockets.
  * **Dynamic Port Forwarding (`/port/:port/`):** Roteia dinamicamente tráfego para servidores web executados pelo usuário no terminal (ex: Express, Flask, Vite, Go).
  * **Live Preview estático (`/preview/`):** Pré-visualização instantânea de arquivos HTML/CSS/JS da sessão.
  * **Rate Limiting por Zonas:** Geral (10 req/s), Autenticação/Brute-force (3 req/s) e IA (5 req/s).
  * **SSL/TLS:** Suporte a certificados Let's Encrypt com renovação automática para DuckDNS.

---

### 2. `crewcode-user-service` (Porta interna 8080)
* **Stack:** Java 17, Spring Boot 3, Spring Security 6, JWT (HMAC-SHA256), BCrypt, Flyway, PostgreSQL 14.
* **Responsabilidades:**
  * **Cadastro & Autenticação Local:** Criptografia BCrypt com sanitização e validação de senhas.
  * **OAuth Social Integrado:** Validação de Google ID Token (Google Identity Services) e GitHub OAuth Code Exchange.
  * **Controle de Acesso Baseado em Papéis (RBAC):** Papéis `ROLE_USER` e `ROLE_SUPER_ADMIN`.
  * **Auto-Provisioning de Inicialização:** Inicializador automático (`SuperAdminInitializer.java`) que cria a conta `admin` no primeiro boot caso inexista.
  * **Gestão Administrativa (`/api/users/admin/**`):** Listagem de usuários, estatísticas por provedor (Local/Google/GitHub), bloqueio/desbloqueio temporário, promoção de permissões e exclusão segura.
  * **CORS Flexível:** Configuração dinâmica via `CORS_ALLOWED_ORIGIN_PATTERNS`.

---

### 3. `crewcode-session-service` (Porta interna 8080)
* **Stack:** Java 17, Spring Boot 3, Spring Data JPA, PostgreSQL 14, RestTemplate / Gemini API.
* **Responsabilidades:**
  * **Gestão de Sessões & Workspace:** Ciclo de vida das salas e persistência da árvore de arquivos (`session_file`) em banco com conversão hierárquica recursiva.
  * **IA Google Gemini Multimodal (`gemini-3.7-flash`):**
    * Chat contextual com envio de texto e **análise de imagens/screenshots** (visão computacional).
    * Autocompletar inteligente de código no Monaco Editor.
    * Modo Agente (*Function Calling*) com execução sequencial e prevenção de loops.
    * **Cadeia de Fallback Automática:** `gemini-3.7-flash` -> `gemini-3.6-flash` -> `gemini-flash-lite-latest` -> `gemini-2.5-flash` -> `gemini-2.0-flash`.
  * **FinOps & Auditoria de IA:** Gravação de cada chamada na tabela `ai_usage_log` (`prompt_tokens`, `response_tokens`, `total_tokens`, `model`, tempo de resposta e custo USD estimado).
  * **Telemetria de Sistema & Infraestrutura (`/api/sessions/admin/**`):**
    * Métricas reais de JVM (RAM livre/usada/máxima, GC).
    * Ocupação do disco da VM (espaço total, livre e percentual de uso).
    * Threads ativas, processadores e uptime da máquina.

---

### 4. `crewcode-sync-service` (Porta interna 8082 + Portas de Preview 3000-3005, 5000-5005, 8000-8005)
* **Stack:** Java 17, Spring Boot 3, STOMP sobre WebSockets, SockJS, Redis 7 Alpine Pub/Sub Relay, Linux PTY (pty4j / ProcessBuilder), JGit.
* **Responsabilidades:**
  * **Colaboração em Tempo Real:**
    * Broadcast de digitação síncrona e integração com Yjs/CRDT.
    * Cursores remotos com cores exclusivas por usuário e seleção de texto ao vivo.
    * Chat da sala com mensagens e reações sincronizadas por linha de código.
    * Widget Pomodoro sincronizado para pair programming.
  * **Terminal Linux Multi-Abas (PTY):**
    * Múltiplas instâncias de terminal independentes por sala (`main`, `term-1`, `term-2`).
    * Emulação ANSI / Xterm.js com suporte completo a atalhos, `Ctrl+C`, `Ctrl+V` e redimensionamento dinâmico de colunas/linhas (`terminal.resize`).
    * Ambientes prontos para Node.js, Python, Java (JDK 17), Go, Rust, C, C++, Ruby, PHP, Lua e Bash.
  * **Integração Git Nativa (JGit + CLI Fallback):**
    * Inicialização de repositório (`git init`) e clonagem remota com Token PAT (`git clone`).
    * Painel visual de Source Control com status de arquivos (*Staged*, *Unstaged*, *Untracked*).
    * **Monaco Diff Editor:** Comparação visual lado a lado com `HEAD` antes do commit.
    * Ações de Stage (`git add`), Unstage (`git reset`) e Descarte de alterações (`git discard`).
    * Criação de commits com autor e mensagem.
    * Sincronização remota: Push (`git push`) e Pull (`git pull`) com autenticação.
    * Gerenciamento de branches (listagem local/remota, alternância e criação).
    * Histórico de commits com detalhes de arquivos alterados e diffs individuais.
    * Sincronização automática bidirecional entre disco (`/tmp/<sessionId>`) e o banco de dados.
  * **Resiliência, Presença & Inatividade:**
    * Heartbeat periódico via WebSocket (`/app/heartbeat/{sessionId}`).
    * Desconexão imediata e graciosa com `SessionDisconnectEvent`.
    * **Reaper de Inatividade:** Processo agendado que desconecta automaticamente usuários inativos após 15 minutos e encerra terminais de salas sem participantes ativos.
    * Endpoint administrativo (`/api/sync/admin/active-rooms`) fornecendo dados de ocupação em tempo real.

---

### 5. `crewcode-postgres` & `crewcode-redis`
* **PostgreSQL 14 Alpine:** Banco de dados relacional primário (`crewcode_db`), estruturado com migrations versionadas via Flyway (`V1`, `V2`, `V3`).
* **Redis 7 Alpine:** Mensageria distribuída e Pub/Sub Relay, garantindo suporte a múltiplas réplicas do `sync-service`.

---

## 4. Painéis e Recursos Avançados da IDE

| Recurso | Descrição | Componente Principal |
|---|---|---|
| **Monaco Code Editor** | Editor profissional com syntax highlighting, múltiplos cursores, minimap, busca global e autocompletar IA. | `EditorPage.jsx` |
| **Painel de Debug & Syntax** | Painel inferior com abas **Terminal**, **Output**, **Debug Console** e **Problems** (validação sintática em tempo real para JS, TS, Python, JSON, etc.). | `DebugPanel.jsx`, `DebugConsole.jsx`, `useSyntaxValidator.js` |
| **Painel Git & Diff Visual** | Controle de versão integrado estilo VS Code, com diff lado a lado no Monaco Diff Editor, commit, branch, push e pull. | `GitPanel.jsx`, `GitService.java` |
| **Assistente IA Multimodal** | Chat com Gemini 3.7 Flash, suporte a envio de capturas de tela/imagens, botões rápidos e aplicação direta no código. | `AIAssistantModal.jsx`, `AIService.java` |
| **Lousa Virtual (Whiteboard)** | Canvas de diagramação e brainstorming em tempo real baseado em Excalidraw. | `Whiteboard.jsx` |
| **Time Machine** | Linha do tempo de alterações com restauração de versões anteriores de arquivos. | `TimeMachineModal.jsx` |
| **Navegador Interno** | Pré-visualização de portas e sites internos direto dentro da interface do editor. | `SimpleBrowser.jsx` |
| **Timer Pomodoro** | Temporizador de foco e intervalos compartilhado entre os participantes da sessão. | `PomodoroWidget.jsx` |

---

## 5. Console Super Admin & Observabilidade (`/admin`)

* **Acesso Restrito:** Exclusivo para usuários autenticados com papel `ROLE_SUPER_ADMIN`.
* **Módulos do Painel:**
  1. **Infraestrutura & Hardware:** Leituras em tempo real de consumo de RAM da JVM, ocupação do disco da VM, núcleos vCPU, contagem de threads e uptime.
  2. **FinOps & Tokens Gemini:** Contador acumulado de tokens (*prompt* e *response*), tokens consumidos hoje, custo estimado em USD e tabela detalhada com histórico das últimas 50 requisições de IA.
  3. **Gestão de Usuários:** Tabela de contas cadastradas com badges de provedores (Local, Google, GitHub), alternância de status ativo/bloqueado, promoção para Super Admin e exclusão de contas.
  4. **Monitor de Salas em Tempo Real:** Listagem de todas as sessões ativas com contagem de participantes conectados ao vivo e opção de encerramento forçado.

---

## 6. Variáveis de Ambiente (`.env`)

```env
# Banco de Dados PostgreSQL
POSTGRES_DB=crewcode_db
POSTGRES_USER=crewcode_user
POSTGRES_PASSWORD=sua_senha_segura

# Autenticação JWT & Admin Inicial
JWT_SECRET=chave_jwt_super_longa_e_segura_com_no_minimo_256_bits
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# OAuth Social (Opcional se usar apenas local)
GOOGLE_CLIENT_ID=seu_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu_google_client_secret
GITHUB_CLIENT_ID=seu_github_client_id
GITHUB_CLIENT_SECRET=seu_github_client_secret

# Redis
REDIS_PASSWORD=crewcode_redis_pass

# Inteligência Artificial Google Gemini
GEMINI_API_KEY=sua_gemini_api_key
GEMINI_MODEL=gemini-3.7-flash
GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-flash-lite-latest,gemini-2.5-flash,gemini-2.0-flash

# CORS & Sistema
CORS_ALLOWED_ORIGIN_PATTERNS=*
```

---

## 7. Guia Rápido de Operação e Comandos

### No Servidor de Produção (Atualização via GHCR em ~10s):
```bash
git pull origin main
docker compose pull
docker compose up -d
```

### No Ambiente de Desenvolvimento Local (Build do código-fonte):
```bash
docker compose up -d --build
```

### Comandos de Verificação e Manutenção:
```bash
# Status e saúde dos contêineres
docker compose ps

# Logs unificados em tempo real
docker compose logs -f

# Logs de um serviço específico
docker compose logs -f sync-service
docker compose logs -f session-service
docker compose logs -f user-service
docker compose logs -f frontend

# Reiniciar um serviço sem parar os outros
docker compose restart sync-service
```
