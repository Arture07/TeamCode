# CrewCode — Análise e Ideias de Melhoria

## Visão Geral

O **CrewCode** é uma plataforma de colaboração de código em tempo real bem estruturada, com uma arquitetura sólida de microsserviços. A análise abaixo cobre toda a base de código — frontend React/Vite, microsserviços Spring Boot e infraestrutura Docker.

---

## Organização de Código (Refatoração)

### `App.jsx` tem ~4000 linhas — urgente dividir

> [!CAUTION]
> O arquivo `App.jsx` contém **3959 linhas**, concentrando toda a lógica da aplicação: autenticação, editor, WebSocket, terminal, AI, temas, resize de painel, validação de sintaxe, etc. Isso é um risco de manutenibilidade alto.

**Proposta de divisão:**

| Arquivo Novo | Responsabilidade |
|---|---|
| `hooks/useWebSocket.js` | Conexão STOMP, subscriptions, publish |
| `hooks/useFileTree.js` | `loadTree`, create/delete/rename/move/duplicate |
| `hooks/usePanelResize.js` | Toda lógica de drag resize (horizontal/vertical) |
| `hooks/useSyntaxValidator.js` | `validateSyntax` com as regras por linguagem |
| `hooks/useCodeExecution.js` | `handleRunFile` e mapeamento de comandos |
| `pages/AuthPage.jsx` | Página de login/registro |
| `pages/HomePage.jsx` | Dashboard de criação de sessões |
| `pages/EditorPage.jsx` | Página principal do editor |
| `components/FileTabs.jsx` | Barra de abas de arquivos |
| `components/TerminalPanel.jsx` | Terminal xterm.js encapsulado |

**Benefícios:** facilita testes, reutilização, colaboração entre devs e leitura do código.

---

## Melhorias de Funcionalidades

### 1. Dashboard de Sessões (tela inicial pós-login)

Atualmente, a `HomePage` é apenas um formulário simples para criar uma sessão. Sugestão:

- **Listar sessões existentes** do usuário (GET `/api/sessions`)
- Cards com: nome da sessão, data de criação, número de participantes online
- Botão **"Entrar"** para sessões já criadas
- Botão **"Arquivar/Deletar"** sessão
- Indicador visual de sessões **ativas** (alguém conectado)
- Busca/filtro de sessões por nome

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│  meu-projeto        │  │  api-backend        │  │  frontend-v2        │
│  3 participantes    │  │  Criada há 2 dias   │  │  1 participante     │
│  [Entrar] [Deletar] │  │  [Entrar] [Deletar] │  │  [Entrar] [Deletar] │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

### 2. Assistente de IA — Melhorias

O `AIAssistantModal.jsx` é funcional, mas limitado. Melhorias propostas:

- **Histórico persistente** da conversa por sessão (não zera ao fechar o modal)
- **Markdown rendering** nas respostas (atualmente é `whitespace-pre-wrap` simples) — usar `react-markdown` com syntax highlighting
- **Ações rápidas** no chat: botões pré-definidos como "Explique este código", "Corrija os erros", "Escreva testes", "Documente com JSDoc"
- **Aplicar resposta ao editor**: botão "Inserir no editor" quando a IA retorna código
- **Streaming de resposta** — mostrar o texto sendo gerado em tempo real (SSE ou polling)
- **Seleção de trecho**: enviar para IA somente o texto selecionado no editor, não o arquivo inteiro

### 3. Terminal — Melhorias

- **Múltiplos terminais** em abas (o backend já tem suporte parcial, mas a UI só mostra um)
- **Copiar/colar melhorado** — Ctrl+V para colar (atualmente só Ctrl+C para copiar)
- **Histórico de comandos** com ↑/↓ (sem PTY real, implementável no frontend)
- **Limpar terminal** com botão ou `Ctrl+L`
- **Tamanho de fonte do terminal** separado da fonte do editor

### 4. Colaboração em Tempo Real — Melhorias

- **Operational Transformation (OT) ou CRDT**: atualmente a sync é por substituição de conteúdo inteiro (`setValue`). Para edições simultâneas no mesmo arquivo, isso causa conflitos. Usar Yjs com `y-monaco` é o ideal
- **Cursores remotos coloridos por usuário**: cada usuário com cor única e persistente
- **Lista de participantes online** com avatar/cor e arquivo que estão editando
- **Notificação quando alguém entra/sai** da sessão (toast de notificação)
- **Locks de arquivo**: indicar quando outro usuário está editando um arquivo

### 5. Segurança e Autenticação

> [!WARNING]
> O token JWT é guardado em `localStorage`, o que é vulnerável a ataques XSS. Melhor prática seria usar **httpOnly cookies**.

- **Refresh token**: o JWT atual provavelmente expira; implementar refresh automático
- **Perfil de usuário**: trocar senha, foto de perfil (avatar)
- **Roles/permissões nas sessões**: distinguir "dono da sessão" (pode deletar arquivos, encerrar sessão) de "participante" (só edita)
- **Sessões privadas/públicas**: sessão privada requer convite ou senha

### 6. Persistência e Gerenciamento de Arquivos

- **Auto-save visual**: indicador (ponto) na aba do arquivo quando há mudanças não salvas (semelhante ao VS Code)
- **Histórico de versões por arquivo** (git-like diff simples): "O que mudou nas últimas X edições"
- **Upload de múltiplos arquivos** e **upload de .zip**: expandir o upload atual
- **Preview ao vivo** para mais tipos: atualmente só `.html`; expandir para `.md` (Markdown preview) e imagens
- **Drag & drop de arquivos** direto na área do editor para fazer upload

### 7. Busca Global — Melhorias

A `SearchModal` existe mas pode ser melhorada:

- **Busca com regex** — toggle "usar expressão regular"
- **Filtro por tipo de arquivo** — só buscar em `.js`, `.py`, etc.
- **Substituição global** (Find & Replace)
- **Highlight do match** no resultado — mostrar contexto ao redor da linha

### 8. Git Integration (Avançado)

- Painel lateral com status do git (arquivos modificados, staged, etc.)
- Botões: `git add`, `git commit`, `git push`
- Diff visual de arquivos modificados (usando Monaco diff editor)
- Histórico de commits

---

## Melhorias de Interface (UI/UX)

### 1. Página de Login/Registro

- **Tela de boas-vindas** mais elaborada, com logo animado, tagline e screenshots do produto
- **OAuth** (Login com Google, GitHub)
- **Validação de senha** em tempo real (força da senha, regras)

### 2. Tela do Editor

- **Barra de status inferior** estilo VS Code: linha/coluna do cursor, linguagem do arquivo, tamanho do arquivo, espaçamento (tabs/spaces)
- **Minimap** do código (o Monaco já suporta, só precisa habilitar)
- **Breadcrumb de navegação** no topo do editor (mostrando `src / components / App.jsx`)
- **Painel de extensões** (simplificado): habilitar/desabilitar funcionalidades do editor
- **Modo Zen/Focus**: esconder tudo exceto o editor

### 3. Temas

> [!NOTE]
> O CSS tem os temas duplicados (linhas 1–400 e 440–777 do `index.css` são cópias idênticas). Isso precisa ser corrigido.

- Adicionar mais temas: Dracula, Tokyo Night, Solarized, Catppuccin
- **Editor de tema personalizado**: o usuário pode criar seu próprio esquema de cores
- Sincronizar tema do Monaco com o tema geral da aplicação (atualmente o Monaco tem temas fixos)

### 4. Notificações/Toasts

- Substituir todos os `alert()` nativos do browser por um sistema de toast elegante (ex: `react-hot-toast` ou implementação própria)
- Notificações de: arquivo salvo, erro de conexão, novo participante, etc.

### 5. Atalhos de Teclado

- **Paleta de comandos** estilo VS Code (Ctrl+Shift+P): buscar e executar qualquer ação
- Documentar todos os atalhos existentes em um modal de ajuda (F1 ou `?`)
- Atalho para abrir o assistente de IA (ex: Ctrl+Shift+A)

---

## Melhorias de Arquitetura

### Backend

| Problema | Solução |
|---|---|
| `sync-service` sem autenticação/autorização nas rotas WebSocket | Validar JWT no handshake STOMP |
| Sem API Gateway centralizado | Adicionar Nginx como gateway ou Spring Cloud Gateway |
| `session-service` exposto em 8081 no docker-compose | Remover port mapping em produção |
| Sem logging estruturado | Adicionar Logback + ELK Stack ou Loki + Grafana |
| Sem testes automatizados visíveis | Adicionar testes unitários (JUnit 5) e de integração |

### Frontend

| Problema | Solução |
|---|---|
| `userId` gerado aleatoriamente no frontend | Usar o `username` do JWT como identificador |
| Sem tratamento de erro global | Criar boundary de erros React e interceptor de fetch |
| Sem estado global (tudo em `App.jsx`) | Usar Context API ou Zustand para estado compartilhado |
| CSS duplicado em `index.css` | Remover duplicatas (economiza ~14KB) |
| `useDebounce` reimplementado no `App.jsx` já existe em `useDebounce.js` | Usar o hook existente |

---

## Melhorias de Performance

- **Lazy loading** dos componentes de modal e terminal (evitar carregar Monaco e xterm.js desnecessariamente)
- **Virtual scrolling** no chat e na lista de resultados de busca para sessões com muitas mensagens
- **Debounce da sincronização WebSocket** de código: atualmente envia a cada 800ms, mas o código completo é trafegado. Para arquivos grandes, isso pode ser custoso — enviar **diffs** em vez do conteúdo completo
- **Compressão WebSocket**: habilitar `permessage-deflate` no Spring WebSocket
- **Cache HTTP** para assets estáticos via Nginx (já tem nginx.conf, verificar cache headers)

---

## Qualidade de Código

- **Testes E2E**: Playwright ou Cypress para testar fluxos críticos (login -> criar sessão -> editar arquivo -> ver sincronização)
- **ESLint rules**: o projeto usa ESLint mas pode ampliar as regras (no-console, react-hooks/exhaustive-deps, etc.)
- **Storybook**: documentar componentes de UI isoladamente
- **CI/CD**: GitHub Actions para build e testes automáticos em PRs

---

## Priorização Sugerida

| Prioridade | Melhoria | Impacto | Esforço |
|---|---|---|---|
| Alta | Dividir `App.jsx` em múltiplos arquivos | Alto | Médio |
| Alta | Corrigir CSS duplicado no `index.css` | Médio | Baixo |
| Alta | Dashboard de sessões (listar sessões existentes) | Alto | Médio |
| Alta | Substituir `alert()` por toasts | Médio | Baixo |
| Média | Markdown rendering no chat da IA | Médio | Baixo |
| Média | Histórico de conversas da IA | Médio | Baixo |
| Média | Cursores remotos com cores únicas por usuário | Alto | Baixo |
| Média | Barra de status inferior no editor | Médio | Baixo |
| Média | Minimap do Monaco habilitado | Baixo | Baixo |
| Baixa | Yjs/CRDT para sincronização real de texto | Muito Alto | Alto |
| Baixa | Git integration | Alto | Muito Alto |
| Baixa | OAuth (Login com GitHub/Google) | Alto | Alto |
