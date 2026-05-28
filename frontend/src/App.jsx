// frontend/src/App.jsx
import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  useMemo,
  useCallback,
} from "react";
import Editor from "@monaco-editor/react";
import RecursiveTree from "./components/RecursiveTree";
import ConfirmDialog from "./components/ConfirmDialog";
import RenameModal from "./components/RenameModal";
import AIAssistantModal from "./components/AIAssistantModal";
import { ToastProvider, useToast } from "./components/Toast";
import { getCursorColor } from "./utils/cursorColors";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import "./index.css";
import prettier from "prettier/standalone";
import parserBabel from "prettier/plugins/babel";
import parserHtml from "prettier/plugins/html";
import parserCss from "prettier/plugins/postcss";
import parserEstree from "prettier/plugins/estree";
import ReactMarkdown from "react-markdown";
import { usePanelResize } from "./hooks/usePanelResize";
import { useSyntaxValidator } from "./hooks/useSyntaxValidator";
import { useYjsCollaboration } from "./hooks/useYjsCollaboration";
import GitPanel from "./components/GitPanel";
import AuthPageExtracted from "./pages/AuthPage";
import HomePageExtracted from "./pages/HomePage";
import { ThemeProvider, useTheme, themes } from "./contexts/ThemeContext";
import { LANGUAGES, getLanguageFromExtension } from "./utils/languages";
import { getAuthHeaders } from "./utils/auth";

// Theme re-exported from contexts/ThemeContext.jsx
// (ThemeProvider, useTheme, themes imported above)


// --- UTILS ---
// LANGUAGES and getLanguageFromExtension imported from utils/languages.js


function FileIcon({ fileName }) {
  const { theme } = useTheme();
  if (!fileName) return null;

  const extension = fileName.split(".").pop().toLowerCase();
  const iconMap = {
    js: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg",
    py: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg",
    java: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg",
    html: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg",
    css: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg",
    md: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/markdown/markdown-original.svg",
    json: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/json/json-original.svg",
    ts: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg",
    sh: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/bash/bash-original.svg",
  };
  const iconUrl = iconMap[extension];

  const needsInvert = theme.includes("dark");
  const style = needsInvert
    ? { filter: "invert(1) grayscale(1) brightness(2)" }
    : {};

  return iconUrl ? (
    <img src={iconUrl} alt={extension} className="w-5 h-5" style={style} />
  ) : (
    <div className="w-5 h-5 bg-gray-300" />
  );
}

// --- HELPERS ---
// getAuthHeaders imported from utils/auth.js


const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

// --- COMPONENTS ---

function ThemeSwitcher({ showFont = false }) {
  const { theme, setTheme, fontSize, setFontSize } = useTheme();
  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <label
          className="text-sm font-semibold whitespace-nowrap"
          style={{ color: "var(--text-color)" }}
        >
          Tema:
        </label>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="p-1 rounded-md appearance-none text-sm"
          style={{
            backgroundColor: "var(--input-bg-color)",
            color: "var(--text-color)",
            border: "1px solid var(--panel-border-color)",
          }}
        >
          {Object.entries(themes).map(([key, name]) => (
            <option
              key={key}
              value={key}
              style={{
                backgroundColor: "var(--bg-color)",
                color: "var(--text-color)",
              }}
            >
              {name}
            </option>
          ))}
        </select>
      </div>
      {showFont && (
        <div className="flex items-center space-x-2">
          <label
            className="text-sm font-semibold whitespace-nowrap"
            style={{ color: "var(--text-color)" }}
          >
            Fonte (Editor):
          </label>
          <input
            type="number"
            min="8"
            max="32"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="p-1 rounded-md text-sm w-16"
            style={{
              backgroundColor: "var(--input-bg-color)",
              color: "var(--text-color)",
              border: "1px solid var(--panel-border-color)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function EnhancedCreateFileModal({
  isOpen,
  onClose,
  onCreate,
  folders = [],
  defaultParent = "",
  defaultType = "file",
}) {
  const [fileName, setFileName] = useState("");
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [type, setType] = useState(defaultType); // 'file' or 'folder'
  const [parentFolder, setParentFolder] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFileName("");
      setSelectedLang(LANGUAGES[0]);
      setType(defaultType || "file");
      setParentFolder(defaultParent.replace(/\/+$/, ""));
    }
  }, [isOpen, defaultParent, defaultType]);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!fileName.trim()) return;
    if (type === "folder") {
      const folderName = fileName.endsWith("/") ? fileName : `${fileName}/`;
      onCreate({ name: folderName, type: "folder" });
      return;
    }
    const baseName = fileName.endsWith(selectedLang.extension)
      ? fileName
      : `${fileName}${selectedLang.extension}`;
    const finalName = parentFolder
      ? `${parentFolder.replace(/\/+$/, "")}/${baseName}`
      : baseName;
    onCreate({
      name: finalName,
      language: selectedLang.name,
      type: "file",
      parent: parentFolder,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="p-8 w-full max-w-lg space-y-6 border-2 glass-panel neo-shadow"
        style={{
          backgroundColor: "var(--panel-bg-color)",
          borderColor: "var(--panel-border-color)",
          color: "var(--text-color)",
        }}
      >
        <h2
          className="text-2xl font-bold"
          style={{ color: "var(--primary-color)" }}
        >
          Criar Novo Arquivo
        </h2>
        <div className="space-y-4">
          <div>
            <label
              className="block text-sm mb-1"
              style={{ color: "var(--text-muted-color)" }}
            >
              Tipo
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2 border-2"
              style={{
                backgroundColor: "var(--input-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--text-color)",
              }}
            >
              <option value="file">Arquivo</option>
              <option value="folder">Pasta</option>
            </select>
          </div>

          <div>
            <label
              className="block text-sm mb-1"
              style={{ color: "var(--text-muted-color)" }}
            >
              Nome
            </label>
            <div className="flex items-center space-x-2">
              <input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder={
                  type === "file" ? "nome-do-arquivo" : "nome-da-pasta"
                }
                className="flex-grow px-4 py-3 border-2 focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: "var(--input-bg-color)",
                  borderColor: "var(--panel-border-color)",
                  "--tw-ring-color": "var(--primary-color)",
                  color: "var(--text-color)",
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              {type === "file" && (
                <select
                  value={selectedLang.extension}
                  onChange={(e) =>
                    setSelectedLang(
                      LANGUAGES.find((l) => l.extension === e.target.value),
                    )
                  }
                  className="border-2 px-3 py-3 focus:outline-none appearance-none"
                  style={{
                    backgroundColor: "var(--input-bg-color)",
                    borderColor: "var(--panel-border-color)",
                    color: "var(--text-color)",
                    minWidth: "80px",
                  }}
                >
                  {LANGUAGES.map((lang) => (
                    <option
                      key={lang.extension}
                      value={lang.extension}
                      style={{
                        backgroundColor: "var(--panel-bg-color)",
                        color: "var(--text-color)",
                      }}
                    >
                      {lang.extension}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
        {type === "file" && (
          <div className="mt-2">
            <label
              className="text-sm"
              style={{ color: "var(--text-muted-color)" }}
            >
              Pasta
            </label>
            <select
              value={parentFolder}
              onChange={(e) => setParentFolder(e.target.value)}
              className="w-full mt-1 p-2 border-2"
              id="parent-folder-select"
            >
              <option value="">(Raiz)</option>
              {folders.map((f) => (
                <option key={f} value={f.replace(/\/+$/, "")}>
                  {f.replace(/\/+$/, "")}/
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex justify-end space-x-4 pt-4">
          <button
            onClick={onClose}
            className="px-6 py-2 font-bold border-2 neo-shadow-button"
            style={{ borderColor: "var(--panel-border-color)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            className="px-8 py-2 font-bold border-2 neo-shadow-button"
            style={{
              backgroundColor: "var(--button-bg-color)",
              color: "var(--button-text-color)",
              borderColor: "var(--panel-border-color)",
            }}
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}

function TerminalComponent({ sessionId, stompClient, registerApi }) {
  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const fitAddonRef = useRef(null);
  const { theme, fontSize } = useTheme();

  useEffect(() => {
    const term = new Terminal({
      theme: {
        background: theme.includes("dark") ? "#1e1e1e" : "#ffffff",
        foreground: theme.includes("dark") ? "#cccccc" : "#333333",
        cursor: theme.includes("dark") ? "#ffffff" : "#000000",
        selectionBackground: theme.includes("dark") ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
      },
      cursorBlink: true,
      fontSize: fontSize || 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      // Raw mode: the PTY handles echo, so we must NOT echo locally
      convertEol: false,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    // Initial fit after DOM is ready
    setTimeout(() => {
      try { fitAddon.fit(); } catch (e) { /* ignore */ }
    }, 100);

    // Helper: send terminal dimensions to backend so PTY resizes (SIGWINCH)
    const sendResize = () => {
      try {
        fitAddon.fit();
      } catch (e) { /* ignore */ }
      const cols = term.cols;
      const rows = term.rows;
      if (stompClient?.connected && cols > 0 && rows > 0) {
        try {
          stompClient.publish({
            destination: `/app/terminal.resize/${sessionId}`,
            body: JSON.stringify({ cols, rows }),
          });
        } catch (_) { }
      }
    };

    // Auto-resize on container size change
    const resizeObserver = new ResizeObserver(() => sendResize());
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }
    window.addEventListener("resize", sendResize);

    // RAW passthrough: every keystroke goes directly to the PTY
    // No local buffering, no echo — the PTY handles everything
    const onDataDisposable = term.onData((data) => {
      if (stompClient?.connected) {
        try {
          stompClient.publish({
            destination: `/app/terminal.in/${sessionId}`,
            body: JSON.stringify({ input: data }),
          });
        } catch (_) { }
      }
    });

    termInstance.current = term;
    fitAddonRef.current = fitAddon;

    if (typeof registerApi === "function") {
      registerApi({
        write: (data) => {
          if (termInstance.current) termInstance.current.write(data);
        },
        clear: () => {
          try { termInstance.current?.clear(); } catch (_) { }
        },
        fit: () => {
          try { fitAddon.fit(); } catch (_) { }
        },
        sendResize,
      });
    }

    return () => {
      window.removeEventListener("resize", sendResize);
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      term.dispose();
    };
  }, [theme, fontSize, sessionId, stompClient]);

  // When connected, start the PTY with the correct initial size
  useEffect(() => {
    if (stompClient?.connected) {
      // Small delay so the terminal DOM is rendered and fitAddon can measure
      const timer = setTimeout(() => {
        let cols = 80;
        let rows = 24;
        try {
          if (fitAddonRef.current && termInstance.current) {
            fitAddonRef.current.fit();
            cols = termInstance.current.cols || 80;
            rows = termInstance.current.rows || 24;
          }
        } catch (_) { }
        try {
          stompClient.publish({
            destination: `/app/terminal.start/${sessionId}`,
            body: JSON.stringify({ cols, rows }),
          });
        } catch (_) { }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [stompClient, sessionId]);

  return <div ref={terminalRef} className="h-full w-full" />;
}

function AuthPage({ onLoginSuccess }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null);
  // Handle OAuth callback (GitHub sends ?code=... in the URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthProvider = localStorage.getItem("oauth_provider");
    if (code && oauthProvider === "github") {
      localStorage.removeItem("oauth_provider");
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      handleGitHubCallback(code);
    }
  }, []);

  const handleGitHubCallback = async (code) => {
    setOauthLoading("github");
    setError(null);
    try {
      const res = await fetch("/api/users/oauth/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      localStorage.setItem("jwtToken", data.token);
      // Decode username from JWT payload
      try {
        const payload = JSON.parse(atob(data.token.split(".")[1]));
        localStorage.setItem("username", payload.sub || "User");
      } catch (_) {
        localStorage.setItem("username", "User");
      }
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setOauthLoading(null);
    }
  };

  const handleGitHubLogin = () => {
    const clientId = "__GITHUB_CLIENT_ID__"; // Replaced at build time or handled dynamically
    // We fetch the client ID from the backend to avoid hardcoding
    setOauthLoading("github");
    localStorage.setItem("oauth_provider", "github");
    // Redirect to GitHub OAuth authorize page
    // The redirect_uri should be the app's URL
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  };

  const handleGoogleLogin = async (googleResponse) => {
    setOauthLoading("google");
    setError(null);
    try {
      const res = await fetch("/api/users/oauth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: googleResponse.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      localStorage.setItem("jwtToken", data.token);
      try {
        const payload = JSON.parse(atob(data.token.split(".")[1]));
        localStorage.setItem("username", payload.sub || "User");
      } catch (_) {
        localStorage.setItem("username", "User");
      }
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setOauthLoading(null);
    }
  };

  // Initialize Google Sign-In button
  useEffect(() => {
    // Load Google Identity Services script
    const existingScript = document.getElementById("google-gsi-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => initGoogleButton();
      document.head.appendChild(script);
    } else {
      initGoogleButton();
    }
  }, []);

  const initGoogleButton = () => {
    const googleBtnContainer = document.getElementById("google-signin-btn");
    if (window.google && googleBtnContainer) {
      try {
        window.google.accounts.id.initialize({
          client_id: "__GOOGLE_CLIENT_ID__", // TODO: inject from env/config endpoint
          callback: handleGoogleLogin,
        });
        window.google.accounts.id.renderButton(googleBtnContainer, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: "signin_with",
          shape: "rectangular",
        });
      } catch (_) {
        // Google SDK not ready or client_id not set
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const url = isLoginView ? "/api/users/login" : "/api/users/register";
    const body = isLoginView
      ? { username, password }
      : { username, email, password };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Erro ${res.status}`);
      if (isLoginView) {
        const { token } = JSON.parse(text);
        localStorage.setItem("jwtToken", token);
        localStorage.setItem("username", username);
        onLoginSuccess();
      } else {
        setIsLoginView(true);
        setError("Registro realizado! Faça o login.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500">
      <div className="absolute top-6 right-6">
        <ThemeSwitcher />
      </div>
      <div
        className="w-full max-w-md p-8 space-y-6 border-2 glass-panel neo-shadow"
        style={{
          backgroundColor: "var(--panel-bg-color)",
          borderColor: "var(--panel-border-color)",
        }}
      >
        <div className="text-center">
          <h1
            className="text-4xl font-bold"
            style={{ color: "var(--primary-color)" }}
          >
            TeamCode
          </h1>
          <p className="mt-2" style={{ color: "var(--text-muted-color)" }}>
            {isLoginView ? "Bem-vindo de volta!" : "Crie sua conta"}
          </p>
        </div>

        {/* OAuth Buttons */}
        {isLoginView && (
          <div className="space-y-3">
            <button
              onClick={handleGitHubLogin}
              disabled={oauthLoading === "github"}
              className="w-full font-bold py-3 border-2 flex items-center justify-center gap-3 neo-shadow-button hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{
                backgroundColor: "#24292e",
                color: "#ffffff",
                borderColor: "var(--panel-border-color)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              {oauthLoading === "github" ? "Conectando..." : "Entrar com GitHub"}
            </button>

            {/* Google Sign-In Button Container */}
            <div
              id="google-signin-btn"
              className="w-full flex justify-center"
              style={{ minHeight: "44px" }}
            />

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--panel-border-color)" }} />
              <span className="text-xs font-bold" style={{ color: "var(--text-muted-color)" }}>OU</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--panel-border-color)" }} />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nome de usuário"
            required
            className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--input-bg-color)",
              borderColor: "var(--panel-border-color)",
              "--tw-ring-color": "var(--primary-color)",
              color: "var(--text-color)",
            }}
          />
          {!isLoginView && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--input-bg-color)",
                borderColor: "var(--panel-border-color)",
                "--tw-ring-color": "var(--primary-color)",
                color: "var(--text-color)",
              }}
            />
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            required
            className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--input-bg-color)",
              borderColor: "var(--panel-border-color)",
              "--tw-ring-color": "var(--primary-color)",
              color: "var(--text-color)",
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full font-bold py-3 border-2 disabled:opacity-50 neo-shadow-button"
            style={{
              backgroundColor: "var(--button-bg-color)",
              color: "var(--button-text-color)",
              borderColor: "var(--panel-border-color)",
            }}
          >
            {isLoading
              ? "Processando..."
              : isLoginView
                ? "Entrar"
                : "Registrar"}
          </button>
        </form>
        {error && (
          <div
            className="p-3 border-2"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              borderColor: "rgba(239, 68, 68, 0.5)",
              color: "rgb(252, 165, 165)",
            }}
          >
            {error}
          </div>
        )}
        <p
          className="text-center text-sm"
          style={{ color: "var(--text-muted-color)" }}
        >
          {isLoginView ? "Não tem conta?" : "Já tem conta?"}
          <button
            type="button"
            onClick={() => {
              setIsLoginView(!isLoginView);
              setError(null);
            }}
            className="font-bold underline ml-2"
            style={{ color: "var(--primary-color)" }}
          >
            {isLoginView ? "Registre-se" : "Faça o login"}
          </button>
        </p>
      </div>
    </div>
  );
}


// Helper: formata data relativa (ex: "há 2 dias", "há 5 min")
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '';
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `há ${Math.floor(diff / 86400)} dias`;
  return `há ${Math.floor(diff / 2592000)} meses`;
}

function HomePage() {
  const [sessionName, setSessionName] = useState('');
  const [createdSession, setCreatedSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mySessions, setMySessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null); // { publicId, sessionName }

  const fetchSessions = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) return;
      const res = await fetch(`/api/sessions?ownerUsername=${encodeURIComponent(username)}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMySessions(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      setError('Por favor, insira um nome para a sessão.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setCreatedSession(null);
    try {
      const ownerUsername = localStorage.getItem('username') || 'User';
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sessionName, ownerUsername }),
      });
      if (!res.ok) throw new Error(`Erro na API (${res.status})`);
      const data = await res.json();
      setCreatedSession(data);
      setSessionName('');
      fetchSessions();
    } catch (err) {
      console.error(err);
      setError('Não foi possível conectar ao serviço de sessão.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/sessions/${deleteTarget.publicId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      setMySessions(prev => prev.filter(s => s.publicId !== deleteTarget.publicId));
    } catch (e) {
      console.error(e);
    } finally {
      setDeleteTarget(null);
    }
  };

  const getEditorLink = () => {
    if (!createdSession) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('sessionId', createdSession.publicId);
    return url.href;
  };

  const handleJoinSession = (publicId) => {
    const url = new URL(window.location.href);
    url.searchParams.set('sessionId', publicId);
    window.location.href = url.href;
  };

  const filteredSessions = mySessions.filter(s =>
    s.sessionName?.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Deletar sessão"
        message={`Tem certeza que deseja deletar a sessão "${deleteTarget?.sessionName}"? Todos os arquivos serão perdidos.`}
        confirmLabel="Deletar"
        cancelLabel="Cancelar"
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="min-h-screen flex flex-col p-8 transition-colors duration-500 overflow-y-auto">
        <div className="absolute top-6 right-6 flex items-center space-x-4 z-10">
          <ThemeSwitcher />
          <span className="font-bold">
            Olá, {localStorage.getItem('username') || 'User'}!
          </span>
          <button
            onClick={() => { localStorage.clear(); window.location.href = "/"; }}
            className="px-4 py-2 border-2 font-bold neo-shadow-button"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)', borderColor: 'var(--panel-border-color)' }}
          >
            Logout
          </button>
        </div>

        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {/* Painel da Esquerda: Criar Nova Sessão */}
          <div
            className="p-8 space-y-6 border-2 glass-panel neo-shadow md:col-span-1 h-fit"
            style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)' }}
          >
            <div className="text-center">
              <h1 className="text-4xl font-bold" style={{ color: 'var(--primary-color)' }}>TeamCode</h1>
              <p className="mt-2" style={{ color: 'var(--text-muted-color)' }}>Crie uma sala colaborativa</p>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
                placeholder="Nome do projeto..."
                className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--input-bg-color)',
                  borderColor: 'var(--panel-border-color)',
                  '--tw-ring-color': 'var(--primary-color)',
                  color: 'var(--text-color)',
                }}
              />
              <button
                onClick={handleCreateSession}
                disabled={isLoading}
                className="w-full font-bold py-3 border-2 disabled:opacity-50 neo-shadow-button"
                style={{
                  backgroundColor: 'var(--button-bg-color)',
                  color: 'var(--button-text-color)',
                  borderColor: 'var(--panel-border-color)',
                }}
              >
                {isLoading ? 'Criando...' : '+ Criar Sessão'}
              </button>
            </div>
            {error && (
              <div className="p-3 border-2" style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.5)',
                color: 'rgb(252, 165, 165)',
              }}>
                {error}
              </div>
            )}
            {createdSession && (
              <div className="p-4 border-2 space-y-2" style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderColor: 'rgba(34, 197, 94, 0.5)',
              }}>
                <h3 className="font-bold text-green-400">✓ Sessão criada!</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted-color)' }}>Compartilhe este link:</p>
                <input
                  type="text"
                  readOnly
                  value={getEditorLink()}
                  onClick={(e) => e.target.select()}
                  className="w-full p-2 border-2 text-xs font-mono cursor-pointer"
                  style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)' }}
                />
                <button
                  onClick={() => handleJoinSession(createdSession.publicId)}
                  className="w-full font-bold py-2 border-2 mt-2 bg-green-600 text-white hover:bg-green-500 transition-colors"
                  style={{ borderColor: 'var(--panel-border-color)' }}
                >
                  Entrar Agora →
                </button>
              </div>
            )}
          </div>

          {/* Painel da Direita: Sessões Existentes */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2
                className="text-2xl font-bold"
                style={{ color: 'var(--text-color)' }}
              >
                Meus Projetos
                {!loadingSessions && mySessions.length > 0 && (
                  <span className="ml-2 text-sm font-normal opacity-60">({filteredSessions.length}/{mySessions.length})</span>
                )}
              </h2>
              {mySessions.length > 0 && (
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="🔍 Filtrar por nome..."
                  className="px-3 py-2 border-2 focus:outline-none focus:ring-2 text-sm"
                  style={{
                    backgroundColor: 'var(--input-bg-color)',
                    borderColor: 'var(--panel-border-color)',
                    '--tw-ring-color': 'var(--primary-color)',
                    color: 'var(--text-color)',
                    maxWidth: '220px',
                  }}
                />
              )}
            </div>

            {loadingSessions ? (
              <p style={{ color: 'var(--text-muted-color)' }}>
                <span className="codicon codicon-loading codicon-modifier-spin mr-2" />
                Carregando sessões...
              </p>
            ) : filteredSessions.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed" style={{ borderColor: 'var(--panel-border-color)' }}>
                {mySessions.length === 0 ? (
                  <>
                    <p style={{ color: 'var(--text-muted-color)' }}>Você ainda não tem nenhuma sessão.</p>
                    <p className="text-sm mt-2 opacity-70">Crie um projeto ao lado para começar.</p>
                  </>
                ) : (
                  <p style={{ color: 'var(--text-muted-color)' }}>Nenhuma sessão encontrada para "{filterQuery}".</p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredSessions.map((sess) => (
                  <div
                    key={sess.publicId}
                    className="p-4 border-2 hover:-translate-y-1 transition-transform cursor-pointer neo-shadow flex flex-col justify-between group"
                    style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)' }}
                    onClick={() => handleJoinSession(sess.publicId)}
                  >
                    <div>
                      <div className="flex items-start justify-between mb-1 gap-2">
                        <h3 className="font-bold text-lg truncate leading-tight" style={{ color: 'var(--primary-color)' }}>
                          {sess.sessionName}
                        </h3>
                        <button
                          title="Deletar sessão"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget({ publicId: sess.publicId, sessionName: sess.sessionName }); }}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 text-red-400"
                        >
                          <span className="codicon codicon-trash" style={{ fontSize: 14 }} />
                        </button>
                      </div>
                      <p className="text-xs font-mono mb-1 truncate" style={{ color: 'var(--text-muted-color)' }}>
                        ID: {sess.publicId}
                      </p>
                      {sess.createdAt && (
                        <p className="text-xs opacity-60 mb-3" style={{ color: 'var(--text-muted-color)' }}>
                          🕒 {timeAgo(sess.createdAt)}
                        </p>
                      )}
                    </div>
                    <button
                      className="w-full py-2 border-2 font-bold neo-shadow-button text-sm mt-2"
                      style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', color: 'var(--text-color)' }}
                      onClick={(e) => { e.stopPropagation(); handleJoinSession(sess.publicId); }}
                    >
                      → Entrar na Sessão
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}



function FileTabs({
  openFiles,
  activeFile,
  onTabClick,
  onTabClose,
  onRunFile,
  isRunning,
  onFormat,
}) {
  return (
    <div
      className="flex-shrink-0 flex items-center overflow-x-auto border-b-2"
      style={{
        backgroundColor: "var(--header-bg-color)",
        borderColor: "var(--panel-border-color)",
      }}
    >
      <div className="flex items-end flex-1 overflow-x-auto">
        {(openFiles || []).map((file) => (
          <div
            key={file}
            onClick={() => onTabClick(file)}
            className={`flex items-center space-x-2 px-4 py-2 cursor-pointer border-r-2 ${activeFile === file ? "active-tab" : "inactive-tab"
              }`}
            style={{
              borderColor: "var(--panel-border-color)",
            }}
          >
            <div className="w-5 h-5 flex-shrink-0">
              <FileIcon fileName={file} />
            </div>
            <span className="truncate text-sm font-medium">{file}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(file);
              }}
              className="ml-2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-[var(--primary-bg-color)]"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center px-2 space-x-2">
        {activeFile && onFormat && (
          <button
            onClick={() => onFormat()}
            className="p-1 rounded hover:bg-[var(--primary-bg-color)]"
            title="Format Code (Prettier)"
          >
            <span className="codicon codicon-wand"></span>
          </button>
        )}
        {activeFile && onRunFile && (
          <button
            onClick={() => onRunFile(activeFile)}
            disabled={isRunning}
            className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{
              backgroundColor: "var(--primary-color)",
              color: "#fff",
            }}
            title="Run file (executes in terminal)"
          >
            {isRunning ? (
              <span className="codicon codicon-loading codicon-modifier-spin"></span>
            ) : (
              <span className="codicon codicon-play"></span>
            )}
            <span className="font-medium">
              {isRunning ? "Running..." : "Run"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function ResizeHandle({ onMouseDown }) {
  return (
    <div
      className="w-3 flex-shrink-0 cursor-col-resize hover:bg-[var(--primary-color)] transition-colors"
      style={{
        backgroundColor: "var(--panel-border-color)",
        marginLeft: "-1px",
        marginRight: "-1px",
      }}
      onMouseDown={onMouseDown}
    />
  );
}

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

function HighlightedLine({ content, query, useRegex }) {
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
      if (pattern.lastIndex === match.index) { pattern.lastIndex++; } // avoid infinite loop on zero-width match
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
    // Validate regex before searching
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

  // Client-side filter by file type and regex validity
  const filteredResults = results.filter((r) => {
    // File type filter
    if (fileTypeFilter) {
      const ext = r.path.split(".").pop().toLowerCase();
      const filterBase = fileTypeFilter.toLowerCase();
      // js matches js and jsx, ts matches ts and tsx
      if (filterBase === "js" && !["js", "jsx"].includes(ext)) return false;
      if (filterBase === "ts" && !["ts", "tsx"].includes(ext)) return false;
      if (!["js", "ts"].includes(filterBase) && ext !== filterBase) return false;
    }
    // Regex filter on content
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

        {/* Search input row */}
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

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {/* Regex toggle */}
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

          {/* File type filter */}
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

          {/* Results count */}
          {results.length > 0 && (
            <span className="text-xs ml-auto" style={{ color: "var(--text-muted-color)" }}>
              {filteredResults.length}/{results.length} resultado{results.length !== 1 ? "s" : ""}
              {fileTypeFilter || useRegex ? " (filtrado)" : ""}
            </span>
          )}
        </div>

        {/* Regex error */}
        {regexError && (
          <div className="mb-2 px-3 py-1.5 text-xs border-2 rounded"
            style={{ borderColor: "rgba(239,68,68,0.5)", backgroundColor: "rgba(239,68,68,0.1)", color: "rgb(252,165,165)" }}>
            Regex inválido: {regexError}
          </div>
        )}

        {/* Results */}
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

// --- Item 19: Command Palette ---
const COMMANDS = [
  { id: 'search', label: 'Busca Global', icon: 'codicon-search', shortcut: 'Ctrl+Shift+F', action: 'openSearch' },
  { id: 'newfile', label: 'Novo Arquivo', icon: 'codicon-new-file', shortcut: 'A', action: 'newFile' },
  { id: 'newfolder', label: 'Nova Pasta', icon: 'codicon-new-folder', shortcut: 'Shift+A', action: 'newFolder' },
  { id: 'ai', label: 'Assistente AI', icon: 'codicon-robot', shortcut: '', action: 'openAI' },
  { id: 'preview', label: 'Toggle Preview', icon: 'codicon-browser', shortcut: '', action: 'togglePreview' },
  { id: 'terminal', label: 'Toggle Terminal', icon: 'codicon-terminal', shortcut: '', action: 'toggleTerminal' },
  { id: 'chat', label: 'Toggle Chat', icon: 'codicon-comment-discussion', shortcut: '', action: 'toggleChat' },
  { id: 'sidebar', label: 'Toggle Sidebar', icon: 'codicon-files', shortcut: '', action: 'toggleSidebar' },
  { id: 'format', label: 'Formatar Código (Prettier)', icon: 'codicon-wand', shortcut: '', action: 'formatCode' },
  { id: 'reset', label: 'Restaurar Layout', icon: 'codicon-layout', shortcut: '', action: 'resetLayout' },
  { id: 'download', label: 'Baixar Projeto', icon: 'codicon-cloud-download', shortcut: '', action: 'download' },
  { id: 'share', label: 'Compartilhar Link', icon: 'codicon-share', shortcut: '', action: 'openShare' },
  { id: 'settings', label: 'Configurações / Tema', icon: 'codicon-settings-gear', shortcut: '', action: 'openSettings' },
  { id: 'account', label: 'Conta', icon: 'codicon-account', shortcut: '', action: 'openAccount' },
  { id: 'logout', label: 'Sair (Logout)', icon: 'codicon-sign-out', shortcut: '', action: 'logout' },
];

function CommandPalette({ isOpen, onClose, onExecute }) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = query.trim()
    ? COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : COMMANDS;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault();
      onExecute(filtered[selectedIdx].action);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[9000] pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl border-2 glass-panel neo-shadow overflow-hidden"
        style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b-2" style={{ borderColor: 'var(--panel-border-color)' }}>
          <span className="codicon codicon-chevron-right mr-2 opacity-60" style={{ color: 'var(--primary-color)' }} />
          <input
            ref={inputRef}
            id="command-palette-input"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Digite um comando..."
            className="flex-grow bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-color)' }}
          />
          <span className="text-xs opacity-40 ml-2">ESC para fechar</span>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
          {filtered.length === 0 ? (
            <div className="p-4 text-center opacity-50 text-sm" style={{ color: 'var(--text-muted-color)' }}>
              Nenhum comando encontrado
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                key={cmd.id}
                id={`cmd-${cmd.id}`}
                onClick={() => { onExecute(cmd.action); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors text-sm ${idx === selectedIdx ? 'bg-[var(--primary-bg-color)]' : 'hover:bg-[var(--input-bg-color)]'}`}
                style={{ color: 'var(--text-color)' }}
              >
                <span className={`codicon ${cmd.icon} flex-shrink-0`} style={{ color: 'var(--primary-color)', fontSize: 16 }} />
                <span className="flex-grow">{cmd.label}</span>
                {cmd.shortcut && (
                  <span className="text-xs opacity-50 font-mono flex-shrink-0" style={{ color: 'var(--text-muted-color)' }}>
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


function StatusBar({ activeFile, cursorPos, language, connectionStatus, problems }) {
  const errCount = problems.filter(p => p.severity === 'error').length;
  const warnCount = problems.filter(p => p.severity === 'warning').length;
  return (
    <div className="status-bar">
      <span className="status-bar-item" title="Status">
        <span className="codicon codicon-circle-filled" style={{ fontSize: 8, color: connectionStatus === 'Sincronizado!' ? '#4ade80' : '#f59e0b' }} />
        {connectionStatus}
      </span>
      {activeFile && (
        <span className="status-bar-item" title="Arquivo ativo">
          <span className="codicon codicon-file" style={{ fontSize: 12 }} />
          {activeFile.split('/').pop()}
        </span>
      )}
      <div className="status-bar-right">
        {(errCount > 0 || warnCount > 0) && (
          <span className="status-bar-item" title="Problemas">
            {errCount > 0 && <><span className="codicon codicon-error" style={{ fontSize: 12 }} /> {errCount}</>}
            {warnCount > 0 && <><span className="codicon codicon-warning" style={{ fontSize: 12, marginLeft: errCount > 0 ? 6 : 0 }} /> {warnCount}</>}
          </span>
        )}
        {language && (
          <span className="status-bar-item" title="Linguagem">{language}</span>
        )}
        {cursorPos && (
          <span className="status-bar-item" title="Linha e coluna">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
        )}
        <span className="status-bar-item">TeamCode</span>
      </div>
    </div>
  );
}

// --- Chat Helper Functions ---
const hashStringToColor = (str) => {
  if (!str || str === 'System') return "from-zinc-500 to-zinc-700";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "from-rose-500 to-amber-500",
    "from-violet-600 to-indigo-600",
    "from-emerald-500 to-teal-500",
    "from-blue-500 to-cyan-500",
    "from-pink-500 to-rose-500",
    "from-orange-500 to-amber-500",
    "from-fuchsia-500 to-pink-500",
    "from-purple-500 to-pink-500"
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getInitials = (username) => {
  if (!username || username === 'System') return "??";
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.trim().slice(0, 2).toUpperCase();
};

const renderMessageContent = (content) => {
  if (!content) return "";
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      const codeText = part.slice(1, -1);
      return (
        <code 
          key={index} 
          className="px-1.5 py-0.5 rounded font-mono text-xs border"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            borderColor: 'var(--panel-border-color)',
            color: 'var(--primary-color)',
            display: 'inline-block',
            wordBreak: 'break-all'
          }}
        >
          {codeText}
        </code>
      );
    }
    
    const subParts = part.split(urlRegex);
    return subParts.map((subPart, subIndex) => {
      if (urlRegex.test(subPart)) {
        return (
          <a
            key={`${index}-${subIndex}`}
            href={subPart}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-85 transition-opacity font-semibold break-all"
            style={{ color: 'var(--primary-color)' }}
          >
            {subPart}
          </a>
        );
      }
      return subPart;
    });
  });
};

function EditorPage({ sessionId }) {
  const toast = useToast();
  const [status, setStatus] = useState("Carregando...");
  const [participants, setParticipants] = useState([]);
  const prevParticipantsRef = useRef([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [files, setFiles] = useState([]);
  const [isCreateFileModalOpen, setCreateFileModalOpen] = useState(false);
  const [editorContent, setEditorContent] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [cursorPos, setCursorPos] = useState(null);
  const [copiedSessionId, setCopiedSessionId] = useState(false);
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const chatTextareaRef = useRef(null);

  const handleOpenTerminalAtFolder = (folderPath) => {
    const client = stompClientRef.current;
    if (!client?.connected) {
      toast.warning("Terminal desconectado");
      return;
    }
    // send cd to PTY terminal
    client.publish({
      destination: `/app/terminal.in/${sessionId}`,
      body: `cd "${folderPath}"\r`
    });
    if (terminalMinimized) setTerminalMinimized(false);
    toast.success(`Navegando terminal para: ${folderPath.split('/').pop() || '/'}`);
  };

  const handleCopySessionId = async () => {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopiedSessionId(true);
      setTimeout(() => setCopiedSessionId(false), 2000);
      toast.success("ID da Sala copiado!");
    } catch (_) {
      toast.error("Falha ao copiar ID");
    }
  };

  const handleInsertText = (textToInsert) => {
    setChatInput((prev) => prev + textToInsert);
    setTimeout(() => {
      chatTextareaRef.current?.focus();
    }, 10);
  };
  // --- Item 15: usePanelResize hook integration ---
  const {
    panelSizes,
    setPanelSizes,
    onMouseDown,
    onTouchStart,
    reset: resetPanelSizes,
  } = usePanelResize('teamcode-panel-sizes');

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const stompClientRef = useRef(null);
  const chatMessagesEndRef = useRef(null);
  const rightAsideRef = useRef(null);
  const messagesRef = useRef(null);
  const debouncedEditorContent = useDebounce(editorContent, 800);
  const terminalApiRef = useRef(null);
  const { theme, fontSize } = useTheme();
  const chatDragInfo = useRef(null);
  const terminalDragInfo = useRef(null);
  const [chatHeight, setChatHeight] = useState(() => {
    try {
      const v = localStorage.getItem("teamcode-chat-height");
      if (v) return Number(v);
    } catch (_) { }
    return 220;
  });
  const [terminalHeight, setTerminalHeight] = useState(() => {
    try {
      const v = localStorage.getItem("teamcode-terminal-height");
      if (v) return Number(v);
    } catch (_) { }
    return 240;
  });
  const [terminalMinimized, setTerminalMinimized] = useState(() => {
    try {
      return localStorage.getItem("teamcode-terminal-minimized") === "1";
    } catch (_) {
      return false;
    }
  });

  // --- New Features State ---
  const [isSearchModalOpen, setSearchModalOpen] = useState(false);
  const [isAIModalOpen, setAIModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const fileInputRef = useRef(null);
  const [previewFile, setPreviewFile] = useState("index.html");
  const [previewRefreshTrigger, setPreviewRefreshTrigger] = useState(0);
  const [showChat, setShowChat] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState('EXPLORER'); // EXPLORER | GIT
  const [selectedText, setSelectedText] = useState('');
  // Item 17: Drag & Drop
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // Item 19: Command Palette
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  // Item 20: Yjs/CRDT opt-in flag
  const [yjsEnabled, setYjsEnabled] = useState(() => {
    try { return localStorage.getItem('teamcode-yjs-enabled') === '1'; } catch (_) { return false; }
  });

  // Capturar seleção do editor ao abrir o modal de IA
  const handleOpenAIModal = () => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      const model = editorRef.current.getModel();
      if (selection && model && !selection.isEmpty()) {
        setSelectedText(model.getValueInRange(selection));
      } else {
        setSelectedText('');
      }
    }
    setAIModalOpen(true);
  };

  // Inserir código no editor na posição do cursor
  const handleInsertCode = (code) => {
    if (editorRef.current) {
      const selection = editorRef.current.getSelection();
      editorRef.current.executeEdits('ai-insert', [{
        range: selection,
        text: code,
        forceMoveMarkers: true,
      }]);
      editorRef.current.focus();
    }
  };
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [activeTerminalTab, setActiveTerminalTab] = useState("TERMINAL");
  const [problems, setProblems] = useState([]);
  const [terminalOutput, setTerminalOutput] = useState([]);

  // --- Cursor Collaboration State ---
  const myUserIdRef = useRef(`user-${Math.random().toString(36).substr(2, 9)}`);
  const [cursors, setCursors] = useState({});
  const decorationsRef = useRef([]); // Stores current decoration IDs for cleanup
  const isRemoteUpdate = useRef(false); // Flag to prevent infinite loops

  useEffect(() => {
    if (activeFile && activeFile.toLowerCase().endsWith(".html")) {
      setPreviewFile(activeFile);
    }
  }, [activeFile]);

  // --- Item 20: Yjs/CRDT Collaboration ---
  const { isYjsActive } = useYjsCollaboration({
    activeFile,
    sessionId,
    userId: myUserIdRef.current,
    editorRef,
    stompClientRef,
    enabled: yjsEnabled,
  });

  // --- New Features Logic ---
  const handleSearch = async (query) => {
    try {
      const res = await fetch(
        `/api/tree/${sessionId}/search?query=${encodeURIComponent(query)}`,
        {
          headers: getAuthHeaders(),
        },
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data);
    } catch (e) {
      console.error(e);
      toast.error("Erro na busca");
    }
  };

  const handleSearchResultSelect = (result) => {
    handleFileClick(result.path);
    setSearchModalOpen(false);
    // Optional: Scroll to line logic could be added here if Editor exposes it
    // For now just opening the file is good
  };

  const handleDownloadProject = () => {
    window.open(`/api/tree/${sessionId}/download`, "_blank");
  };

  const handleUploadFile = async (e) => {
    const file = e.target ? e.target.files[0] : e;
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", "");

    try {
      const res = await fetch(`/api/tree/${sessionId}/upload`, {
        method: "POST",
        headers: { Authorization: getAuthHeaders()["Authorization"] }, // No Content-Type, let browser set boundary
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      await loadTree();
      toast.success("Arquivo enviado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar arquivo");
    } finally {
      if (e.target) e.target.value = null;
    }
  };

  // Item 17: Drag & Drop upload handlers
  const handleSidebarDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  };

  const handleSidebarDragLeave = (e) => {
    // Only reset if leaving the sidebar element itself (not children)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDraggingOver(false);
    }
  };

  const handleSidebarDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    for (const file of files) {
      await handleUploadFile(file);
    }
  };

  const formatCode = async () => {
    if (!editorRef.current || !activeFile) return;
    const currentCode = editorRef.current.getValue();
    const ext = activeFile.split(".").pop();
    let parser = null;
    let plugins = [];

    switch (ext) {
      case "js":
      case "jsx":
      case "ts":
      case "tsx":
        parser = "babel";
        plugins = [parserBabel, parserEstree];
        break;
      case "html":
        parser = "html";
        plugins = [parserHtml];
        break;
      case "css":
        parser = "css";
        plugins = [parserCss];
        break;
      case "json":
        parser = "json";
        plugins = [parserBabel];
        break;
      default:
        toast.warning("Formatação não suportada para este arquivo.");
        return;
    }

    try {
      const formatted = await prettier.format(currentCode, {
        parser,
        plugins,
        singleQuote: true,
      });
      editorRef.current.setValue(formatted);
      setEditorContent(formatted);
    } catch (e) {
      console.error("Format failed", e);
      toast.error("Erro ao formatar: " + e.message);
    }
  };

  // Helper: find node in tree by path
  const findNodeInTree = (root, path) => {
    if (!root || !path) return null;
    const parts = path.split("/").filter(Boolean);
    let current = root;
    for (const part of parts) {
      if (current.type !== "folder" || !Array.isArray(current.children))
        return null;
      current = current.children.find((c) => c.name === part);
      if (!current) return null;
    }
    return current;
  };

  // Panel resize is handled by usePanelResize hook (see import at top)

  // --- Chat vertical resize handlers ---
  const onChatMouseDown = (e) => {
    chatDragInfo.current = {
      startY: e.clientY,
      startHeight: chatHeight,
      containerHeight:
        rightAsideRef.current?.getBoundingClientRect().height ?? 400,
    };
    e.preventDefault();
    try {
      document.body.style.cursor = "row-resize";
      document.body.classList.add("no-transition");
    } catch (_) { }
    window.addEventListener("mousemove", onChatMouseMove);
    window.addEventListener("mouseup", onChatMouseUp);
    window.addEventListener("mouseleave", onChatMouseUp);
    window.addEventListener("blur", onChatMouseUp);
    // touch fallback
    window.addEventListener("touchmove", onChatTouchMove);
    window.addEventListener("touchend", onChatMouseUp);
  };

  const onChatMouseMove = (e) => {
    if (!chatDragInfo.current) return;
    const deltaY = chatDragInfo.current.startY - e.clientY; // dragging up -> increase messages height
    if (Math.abs(deltaY) < 2) return;
    const maxH = chatDragInfo.current.containerHeight - 60; // leave space for textarea/header
    const newH = Math.max(
      80,
      Math.min(chatDragInfo.current.startHeight + deltaY, maxH),
    );
    setChatHeight(newH);
    try {
      localStorage.setItem("teamcode-chat-height", String(newH));
    } catch (_) { }
  };

  const onChatTouchMove = (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const fake = { clientY: t.clientY };
    onChatMouseMove(fake);
  };

  const onChatMouseUp = () => {
    chatDragInfo.current = null;
    try {
      document.body.style.cursor = "";
      document.body.classList.remove("no-transition");
    } catch (_) { }
    window.removeEventListener("mousemove", onChatMouseMove);
    window.removeEventListener("mouseup", onChatMouseUp);
    window.removeEventListener("mouseleave", onChatMouseUp);
    window.removeEventListener("blur", onChatMouseUp);
  };

  // --- Terminal vertical resize handlers ---
  const [showPreview, setShowPreview] = useState(false); // New state for Preview

  const onTerminalMouseDown = (e) => {
    terminalDragInfo.current = {
      startY: e.clientY,
      startHeight: terminalHeight,
    };
    e.preventDefault();
    try {
      document.body.style.cursor = "row-resize";
      document.body.classList.add("no-transition");
    } catch (_) { }
    window.addEventListener("mousemove", onTerminalMouseMove);
    window.addEventListener("mouseup", onTerminalMouseUp);
    window.addEventListener("mouseleave", onTerminalMouseUp);
    window.addEventListener("blur", onTerminalMouseUp);
  };

  const onTerminalMouseMove = (e) => {
    if (!terminalDragInfo.current) return;
    const deltaY = terminalDragInfo.current.startY - e.clientY; // dragging up -> increase height
    if (Math.abs(deltaY) < 2) return;

    // Limits
    const minH = 100;
    const maxH = window.innerHeight * 0.8;

    const newH = Math.max(
      minH,
      Math.min(terminalDragInfo.current.startHeight + deltaY, maxH),
    );
    setTerminalHeight(newH);
    try {
      localStorage.setItem("teamcode-terminal-height", String(newH));
    } catch (_) { }
  };

  const onTerminalMouseUp = () => {
    terminalDragInfo.current = null;
    try {
      document.body.style.cursor = "";
      document.body.classList.remove("no-transition");
    } catch (_) { }
    window.removeEventListener("mousemove", onTerminalMouseMove);
    window.removeEventListener("mouseup", onTerminalMouseUp);
    window.removeEventListener("mouseleave", onTerminalMouseUp);
    window.removeEventListener("blur", onTerminalMouseUp);
    // Trigger fit after resize ends
    try {
      terminalApiRef.current?.fit();
    } catch (_) { }
  };

  const handleFileClick = (fileName) => {
    if (!openFiles.includes(fileName)) {
      setOpenFiles((prev) => [...prev, fileName]);
    }
    setActiveFile(fileName);
  };

  const handleTabClose = (fileToClose) => {
    const index = openFiles.indexOf(fileToClose);
    const newOpenFiles = openFiles.filter((f) => f !== fileToClose);
    setOpenFiles(newOpenFiles);

    if (activeFile === fileToClose) {
      if (newOpenFiles.length === 0) {
        setActiveFile(null);
      } else {
        const newIndex = Math.max(0, index - 1);
        setActiveFile(newOpenFiles[newIndex]);
      }
    }
  };

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Persistir conversa localmente por sessão ---
  useEffect(() => {
    if (sessionId) {
      const saved = localStorage.getItem(`teamcode-chat-history-${sessionId}`);
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch (_) {}
      } else {
        setMessages([]);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId && messages.length > 0) {
      localStorage.setItem(`teamcode-chat-history-${sessionId}`, JSON.stringify(messages));
    }
  }, [messages, sessionId]);

  // Tree state from backend
  const [treeRoot, setTreeRoot] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [selectedParentForCreate, setSelectedParentForCreate] = useState("");
  const [globalCreateType, setGlobalCreateType] = useState(null); // 'file' | 'folder'

  const loadTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/tree/${sessionId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Árvore não encontrada (${res.status})`);
      const data = await res.json();
      setTreeRoot(data.tree || { name: "", type: "folder", children: [] });
    } catch (err) {
      console.error("Erro ao carregar árvore", err);
    }
  }, [sessionId]);
  // Use backend endpoint to duplicate a node (folder or file). Optional targetName for files
  const duplicateFolder = useCallback(
    async (sourcePath, targetName) => {
      try {
        const res = await fetch(`/api/tree/${sessionId}/duplicate`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ path: sourcePath, targetName }),
        });
        if (!res.ok)
          throw new Error(await res.text().catch(() => "Falha ao duplicar"));
        const data = await res.json().catch(() => ({}));
        await loadTree();
        publishTreeEvent("DUPLICATED", sourcePath, data.newPath);
      } catch (e) {
        console.error("duplicate folder failed", e);
        toast.error("Falha ao duplicar o item.");
      }
    },
    [sessionId, loadTree],
  );

  useEffect(() => {
    (async () => {
      try {
        await loadTree();
        setStatus("Conectando...");
        connectToWebSocket();
      } catch (err) {
        console.error("Erro inicial", err);
        setStatus("Erro ao carregar sessão.");
      }
    })();
    return () => {
      try {
        stompClientRef.current?.deactivate();
      } catch (_) { }
    };
  }, [sessionId]);

  // Global shortcuts for New File (A) and New Folder (Shift+A) when not typing
  useEffect(() => {
    const onKey = (e) => {
      if (
        document.activeElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
      )
        return;
      if (isCreateFileModalOpen) return;
      if ((e.key === "a" || e.key === "A") && !e.shiftKey) {
        e.preventDefault();
        setSelectedParentForCreate("");
        setGlobalCreateType("file");
        setCreateFileModalOpen(true);
      } else if (
        (e.key === "A" && e.shiftKey) ||
        (e.key === "a" && e.shiftKey)
      ) {
        e.preventDefault();
        setSelectedParentForCreate("");
        setGlobalCreateType("folder");
        setCreateFileModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const folderNames = useMemo(() => {
    const names = [];
    const walk = (node, prefix) => {
      if (!node) return;
      const path = prefix ? `${prefix}/${node.name}` : node.name;
      if (node.type === "folder") {
        if (node.name) names.push(path);
        (node.children || []).forEach((c) => walk(c, path));
      }
    };
    if (treeRoot) (treeRoot.children || []).forEach((c) => walk(c, ""));
    return names;
  }, [treeRoot]);

  const [confirmState, setConfirmState] = useState({
    open: false,
    path: null,
    isFolder: false,
  });
  // expose a lightweight selection stash for batch ops coming from the tree component
  // this avoids tight coupling; the tree triggers individual onDelete calls we collect here if needed
  const selectionStashRef = useRef(new Set());
  const [renameState, setRenameState] = useState({ open: false, path: null });

  const requestDelete = (nameOrArray) => {
    if (!nameOrArray) return;
    // support batch delete: if we receive an array, stash them for confirm
    const names = Array.isArray(nameOrArray) ? nameOrArray : [nameOrArray];
    selectionStashRef.current = new Set(names);
    const first = names[0];
    const isFolder = !first.split("/").pop().includes(".");
    setConfirmState({ open: true, path: first, isFolder });
  };

  const confirmDelete = async () => {
    const items =
      selectionStashRef.current && selectionStashRef.current.size
        ? Array.from(selectionStashRef.current)
        : confirmState.path
          ? [confirmState.path]
          : [];
    setConfirmState({ open: false, path: null, isFolder: false });
    if (!items.length) return;
    try {
      for (const name of items) {
        const encoded = encodeURIComponent(name);
        await fetch(`/api/tree/${sessionId}?path=${encoded}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        if (activeFile === name) {
          setActiveFile(null);
          setOpenFiles((prev) => prev.filter((p) => p !== name));
        }
      }
    } catch (err) {
      console.error("Erro ao apagar (lote)", err);
    } finally {
      selectionStashRef.current = new Set();
      await loadTree();
      closeContextMenu();
      publishTreeEvent(
        items.length > 1 ? "REFRESH" : "DELETED",
        items.length === 1 ? items[0] : undefined,
      );
    }
  };

  const openRename = (path) => setRenameState({ open: true, path });
  const submitRename = async (newName) => {
    const path = renameState.path;
    setRenameState({ open: false, path: null });
    const base = path.split("/").pop();
    if (!newName || newName === base) return;
    try {
      const res = await fetch(`/api/tree/${sessionId}/rename`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ path, newName }),
      });
      if (!res.ok) {
        toast.error("Falha ao renomear");
      } else {
        await loadTree();
        const parent = path.includes("/")
          ? path.substring(0, path.lastIndexOf("/"))
          : "";
        const newPath = parent ? `${parent}/${newName}` : newName;
        setOpenFiles((prev) => prev.map((f) => (f === path ? newPath : f)));
        if (activeFile === path) setActiveFile(newPath);
        publishTreeEvent("RENAMED", path, newPath);
        toast.success(`Renomeado para "${newName}"`);
      }
    } catch (e) {
      toast.error("Erro de rede ao renomear");
    }
  };

  const handleMoveFile = async (name, destFolder) => {
    if (!name || !destFolder) return;
    try {
      const body = { from: name, to: destFolder };
      const res = await fetch(`/api/tree/${sessionId}/move`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Move failed");
      await loadTree();
      const newPath = destFolder
        ? `${destFolder}/${name.split("/").pop()}`
        : name.split("/").pop();
      publishTreeEvent("MOVED", name, newPath);
    } catch (err) {
      console.error("Move failed", err);
      await loadTree();
    } finally {
      closeContextMenu();
    }
  };

  const onDragStartFile = (e, fileName) => {
    try {
      e.dataTransfer.setData("text/plain", fileName);
    } catch (_) { }
  };

  const onDropToFolder = (e, folderName) => {
    e.preventDefault();
    const dragged = e.dataTransfer.getData("text/plain");
    if (dragged && folderName) handleMoveFile(dragged, folderName);
  };

  useEffect(() => {
    if (!activeFile) {
      if (editorRef.current) editorRef.current.setValue("");
      return;
    }
    // Find file content in tree instead of old files array
    const fileNode = findNodeInTree(treeRoot, activeFile);

    // Fallback: if tree not ready, try to find in flat files list (initial load)
    const content = fileNode
      ? (fileNode.content ?? "")
      : (files.find((f) => f.name === activeFile)?.content ?? "");

    if (editorRef.current) {
      if (editorRef.current.getValue() !== content) {
        editorRef.current.setValue(content);
        // Sync state to prevent race condition where state remains null/empty
        // but editor has content, leading to overwrite on next debounce.
        setEditorContent(content);
      }
    }
  }, [activeFile, treeRoot, files]);

  useEffect(() => {
    if (!activeFile || debouncedEditorContent === null) return;
    (async () => {
      try {
        const res = await fetch(`/api/tree/${sessionId}/content`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            path: activeFile,
            content: debouncedEditorContent,
          }),
        });
        if (!res.ok) console.error(`Falha ao salvar arquivo: ${res.status}`);

        // Also save to sync-service for Live Preview
        if (stompClientRef.current?.connected) {
          stompClientRef.current.publish({
            destination: `/app/save/${sessionId}`,
            body: JSON.stringify({
              fileName: activeFile,
              content: debouncedEditorContent,
            }),
          });

          // If we are previewing this file, trigger a refresh
          if (activeFile === previewFile) {
            // Add a small delay to allow the backend to write the file
            setTimeout(() => {
              setPreviewRefreshTrigger((prev) => prev + 1);
              // Force DOM reload as fallback
              const frame = document.getElementById("preview-frame");
              if (frame) {
                const src = frame.src.split("?")[0];
                frame.src = `${src}?t=${Date.now()}`;
              }
            }, 800);
          }
        }
      } catch (err) {
        console.error("Erro de rede ao salvar", err);
      }
    })();
  }, [debouncedEditorContent, activeFile, previewFile, sessionId]);

  // --- Item 15: Syntax validation via useSyntaxValidator hook ---
  const { validateSyntax } = useSyntaxValidator();

  // Combine Monaco markers with manual validation
  useEffect(() => {
    if (!activeFile || !editorContent) {
      setProblems([]);
      return;
    }

    let allProblems = [];

    // Get Monaco markers (for languages with native support like JS, TS, JSON)
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const monacoMarkers = monacoRef.current.editor.getModelMarkers({
          resource: model.uri,
        });
        const monacoProblems = monacoMarkers.map((marker) => ({
          message: marker.message,
          severity:
            marker.severity === monacoRef.current.MarkerSeverity.Error
              ? "error"
              : marker.severity === monacoRef.current.MarkerSeverity.Warning
                ? "warning"
                : "info",
          line: marker.startLineNumber,
          column: marker.startColumn,
          filePath: activeFile,
        }));
        allProblems = [...allProblems, ...monacoProblems];
      }
    }

    // Get manual validation problems (always run)
    const manualProblems = validateSyntax(editorContent, activeFile);
    allProblems = [...allProblems, ...manualProblems];

    // Remove duplicates based on line and message
    const uniqueProblems = allProblems.filter(
      (problem, index, self) =>
        index ===
        self.findIndex(
          (p) => p.line === problem.line && p.message === problem.message,
        ),
    );

    setProblems(uniqueProblems);
  }, [editorContent, activeFile, validateSyntax]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Force initial content load if activeFile is set
    if (activeFile) {
      const fileNode = findNodeInTree(treeRoot, activeFile);
      const content = fileNode
        ? (fileNode.content ?? "")
        : (files.find((f) => f.name === activeFile)?.content ?? "");
      if (content) {
        editor.setValue(content);
        setEditorContent(content);
      }
    }

    // Monaco markers are combined via the useEffect above.

    // Broadcast cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
      if (stompClientRef.current?.connected && activeFile) {
        stompClientRef.current.publish({
          destination: `/app/cursor/${sessionId}`,
          body: JSON.stringify({
            userId: myUserIdRef.current,
            username: localStorage.getItem("username") || "User",
            filePath: activeFile,
            lineNumber: e.position.lineNumber,
            column: e.position.column,
          }),
        });
      }
    });
  };

  const updateLocalTreeContent = (path, newContent) => {
    setTreeRoot((prev) => {
      if (!prev) return prev;
      try {
        const clone = JSON.parse(JSON.stringify(prev));
        const node = findNodeInTree(clone, path);
        if (node) {
          node.content = newContent;
        }
        return clone;
      } catch (e) {
        console.error("Error updating local tree", e);
        return prev;
      }
    });
  };

  const handleEditorChange = (value) => {
    const newContent = value ?? "";
    setEditorContent(newContent);

    // Update local tree immediately so switching tabs preserves data
    if (activeFile) {
      updateLocalTreeContent(activeFile, newContent);
    }

    // Broadcast code change if it's not a remote update
    if (
      !isRemoteUpdate.current &&
      stompClientRef.current?.connected &&
      activeFile
    ) {
      stompClientRef.current.publish({
        destination: `/app/code/${sessionId}`,
        body: JSON.stringify({
          content: newContent,
          filePath: activeFile,
          userId: myUserIdRef.current,
        }),
      });
    }
  };

  // Render remote cursors with unique per-user colors
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    // Inject dynamic per-user color CSS classes
    const styleId = 'teamcode-cursor-styles';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    const cssRules = Object.values(cursors)
      .filter(c => c.filePath === activeFile)
      .map(c => {
        const color = getCursorColor(c.userId);
        const cls = `cursor-user-${c.userId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        return `
          .${cls} { border-left-color: ${color} !important; }
          .${cls}::before { background-color: ${color}; }
          .${cls}::after  { background-color: ${color}; }
          .${cls}-label   { background-color: ${color} !important; }
        `;
      });
    styleEl.textContent = cssRules.join('\n');

    const newDecorations = [];
    Object.values(cursors).forEach((cursor) => {
      if (cursor.filePath !== activeFile) return;
      const safeId = cursor.userId.replace(/[^a-zA-Z0-9]/g, '_');
      const cursorClass = `remote-cursor cursor-user-${safeId}`;
      const labelClass = `remote-cursor-label cursor-user-${safeId}-label`;
      newDecorations.push({
        range: new monacoRef.current.Range(
          cursor.lineNumber,
          cursor.column,
          cursor.lineNumber,
          cursor.column,
        ),
        options: {
          className: cursorClass,
          hoverMessage: { value: `**${cursor.username}**` },
          stickiness:
            monacoRef.current.editor.TrackedRangeStickiness
              .NeverGrowsWhenTypingAtEdges,
          after: {
            content: cursor.username,
            inlineClassName: labelClass,
          },
        },
      });
    });
    decorationsRef.current = editorRef.current.deltaDecorations(
      decorationsRef.current,
      newDecorations,
    );
  }, [cursors, activeFile]);


  // --- CORREÇÃO: Atualiza a UI quando um arquivo é criado ---
  const handleFileEvent = (message) => {
    try {
      const event = JSON.parse(message.body);
      if (event?.type === "CREATED") {
        // Adiciona à lista geral de arquivos
        setFiles((prev) => [
          ...prev,
          { name: event.name, content: event.content },
        ]);
        // Abre o arquivo em uma nova aba
        handleFileClick(event.name);
      }
    } catch (e) {
      console.warn("fileEvent parse failed", e);
    }
  };

  const handleChatMessage = (message) => {
    try {
      setMessages((prev) => [...prev, JSON.parse(message.body)]);
    } catch (e) { }
  };

  const handleSendChatMessage = () => {
    if (chatInput.trim() && stompClientRef.current?.connected) {
      stompClientRef.current.publish({
        destination: `/app/chat/${sessionId}`,
        body: JSON.stringify({
          username: localStorage.getItem("username") || "User",
          content: chatInput.trim(),
        }),
      });
      setChatInput("");
    }
  };

  const handleUserEvent = (message) => {
    try {
      const newParticipants = JSON.parse(message.body).participants || [];
      const prev = prevParticipantsRef.current;
      const myUsername = localStorage.getItem('username');
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Detectar quem entrou
      newParticipants.forEach(p => {
        const uName = typeof p === 'string' ? p : (p?.username || p?.userId || "User");
        const pId = typeof p === 'string' ? p : (p?.userId || p?.username);
        
        if (!prev.find(pp => (typeof pp === 'string' ? pp : pp.userId) === pId) && uName !== myUsername) {
          toast.info(`🟢 ${uName} entrou na sessão`);
          setMessages(prevMsgs => [...prevMsgs, {
            username: 'System',
            content: `${uName} entrou na sessão`,
            isSystem: true,
            timestamp: timeStr
          }]);
        }
      });
      // Detectar quem saiu
      prev.forEach(p => {
        const uName = typeof p === 'string' ? p : (p?.username || p?.userId || "User");
        const pId = typeof p === 'string' ? p : (p?.userId || p?.username);
        
        if (!newParticipants.find(np => (typeof np === 'string' ? np : np.userId) === pId) && uName !== myUsername) {
          toast.info(`⚪ ${uName} saiu da sessão`);
          setMessages(prevMsgs => [...prevMsgs, {
            username: 'System',
            content: `${uName} saiu da sessão`,
            isSystem: true,
            timestamp: timeStr
          }]);
        }
      });

      prevParticipantsRef.current = newParticipants;
      setParticipants(newParticipants);
    } catch (e) { }
  };

  const handleCursorEvent = (message) => {
    try {
      const cursorData = JSON.parse(message.body);
      // Ignore our own cursor
      if (cursorData.userId === myUserIdRef.current) return;
      setCursors((prev) => ({
        ...prev,
        [cursorData.userId]: cursorData,
      }));
    } catch (e) {
      console.error("Error parsing cursor message", e);
    }
  };

  const handleCodeEvent = (message) => {
    try {
      const codeData = JSON.parse(message.body);
      // Ignore our own updates or updates for other files
      if (
        codeData.userId === myUserIdRef.current ||
        codeData.filePath !== activeFile
      )
        return;

      // Apply update
      if (
        editorRef.current &&
        codeData.content !== editorRef.current.getValue()
      ) {
        isRemoteUpdate.current = true;

        // Save cursor position
        const position = editorRef.current.getPosition();

        editorRef.current.setValue(codeData.content);
        setEditorContent(codeData.content);

        // Update local tree for remote changes too
        updateLocalTreeContent(activeFile, codeData.content);

        // Restore cursor position (best effort)
        if (position) {
          editorRef.current.setPosition(position);
        }

        isRemoteUpdate.current = false;
      }
    } catch (e) {
      console.error("Error parsing code message", e);
    }
  };

  const connectToWebSocket = () => {
    const token = localStorage.getItem("jwtToken");
    const client = new Client({
      webSocketFactory: () =>
        new SockJS(`http://${window.location.host}/ws-connect`),
      reconnectDelay: 5000,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      onConnect: () => {
        setStatus("Sincronizado!");
        client.subscribe(`/topic/user/${sessionId}`, handleUserEvent);
        client.subscribe(`/topic/chat/${sessionId}`, handleChatMessage);
        client.subscribe(`/topic/file/${sessionId}`, handleFileEvent);
        client.subscribe(`/topic/cursor/${sessionId}`, handleCursorEvent);
        client.subscribe(`/topic/code/${sessionId}`, handleCodeEvent);
        client.subscribe(`/topic/tree/${sessionId}`, (message) => {
          try {
            const evt = JSON.parse(message.body || "{}");
            // Refresh tree on any event
            loadTree();
            if (
              (evt.type === "RENAMED" || evt.type === "MOVED") &&
              evt.path &&
              evt.newPath
            ) {
              setOpenFiles((prev) =>
                prev.map((f) => (f === evt.path ? evt.newPath : f)),
              );
              setActiveFile((prev) => (prev === evt.path ? evt.newPath : prev));
            }
          } catch (_) {
            loadTree();
          }
        });
        // Ao conectar, solicite novamente a lista de arquivos para garantir sincronização
        (async () => {
          try {
            const res = await fetch(`/api/sessions/${sessionId}`, {
              headers: getAuthHeaders(),
            });
            if (!res.ok) return;
            const data = await res.json();
            const filesList = Array.isArray(data.files) ? data.files : [];
            setFiles(filesList);
            // se editor está vazio, abra o primeiro arquivo automaticamente
            if (!activeFile && filesList[0]?.name) {
              handleFileClick(filesList[0].name);
              setEditorContent(filesList[0].content ?? "");
            }
          } catch (_) { }
        })();
        client.subscribe(`/topic/terminal/${sessionId}`, (message) => {
          let content = message.body;
          try {
            const json = JSON.parse(message.body);
            // Verifica se é um objeto JSON do nosso protocolo (com campo 'output')
            // Isso evita que números soltos (ex: "10") sejam parseados como números e ignorados
            if (json && typeof json === "object" && "output" in json) {
              content = json.output;
            }
          } catch (_) {
            // Se falhar o parse (ex: texto puro), usa o corpo original
          }
          terminalApiRef.current?.write(content ?? "");
        });
        client.publish({
          destination: `/app/user.join/${sessionId}`,
          body: JSON.stringify({
            userId: myUserIdRef.current,
            username: localStorage.getItem("username") || "User",
            type: "JOIN",
          }),
        });
        try {
          client.publish({ destination: `/app/terminal.start/${sessionId}` });
        } catch (_) { }
      },
      onStompError: () => setStatus("Erro de conexão."),
      onWebSocketClose: () => setStatus("Desconectado. Reconectando..."),
    });
    client.activate();
    stompClientRef.current = client;
  };

  const publishTreeEvent = (type, path, newPath) => {
    try {
      const client = stompClientRef.current;
      if (!client?.connected) return;
      client.publish({
        destination: `/app/tree/${sessionId}`,
        body: JSON.stringify({ type, path, newPath }),
      });
    } catch (_) { }
  };

  const handleRunFile = (filePath) => {
    if (!filePath || isRunning) return;

    setIsRunning(true);

    // Add output notification
    const timestamp = new Date().toLocaleTimeString();
    setTerminalOutput((prev) => [
      ...prev,
      {
        timestamp,
        message: `Executando: ${filePath}`,
        type: "info",
      },
    ]);

    // Reset running state after a timeout (since we don't get a "finished" event from terminal easily yet)
    setTimeout(() => setIsRunning(false), 3000);

    // Use current editor content (most up-to-date) instead of tree
    // This ensures we run the latest code, even if debounce hasn't saved yet
    const content = editorContent || "";

    // Determine command based on file extension
    const ext = filePath.split(".").pop().toLowerCase();
    const fileName = filePath.split("/").pop(); // Get just the filename
    let command = "";

    switch (ext) {
      case "js":
        command = `node ${fileName}`;
        break;
      case "py":
        // Usa o módulo pty do Python para criar um terminal real.
        // Isso garante que input() funcione e que o texto digitado apareça (echo).
        command = `python3 -c "import pty; pty.spawn(['python3', '-u', '${fileName}'])"`;
        break;
      case "java":
        // Extract class name from filename
        const className = fileName.replace(/\.java$/, "");
        command = `javac ${fileName} && java ${className}`;
        break;
      case "c":
        const cOut = fileName.replace(/\.c$/, "") + ".out";
        command = `gcc ${fileName} -o ${cOut} && ./${cOut}`;
        break;
      case "cpp":
      case "cc":
        const cppOut = fileName.replace(/\.(cpp|cc)$/, "") + ".out";
        command = `g++ ${fileName} -o ${cppOut} && ./${cppOut}`;
        break;
      case "rb":
        command = `ruby ${fileName}`;
        break;
      case "go":
        command = `go run ${fileName}`;
        break;
      case "rs":
        command = `rustc ${fileName} && ./${fileName.replace(/\.rs$/, "")}`;
        break;
      case "sh":
        command = `bash ${fileName}`;
        break;
      case "ts":
        command = `ts-node ${fileName}`;
        break;
      default:
        toast.warning(`Tipo de arquivo não suportado: .${ext}`);
        setIsRunning(false);
        return;
    }

    // Send file content and command via WebSocket to sync-service
    try {
      const client = stompClientRef.current;
      if (!client?.connected) {
        toast.error("WebSocket desconectado. Recarregue a página.");
        return;
      }
      client.publish({
        destination: `/app/execute/${sessionId}`,
        body: JSON.stringify({
          command,
          fileName,
          content,
        }),
      });
      // Optional: minimize terminal or focus it
      if (terminalMinimized) setTerminalMinimized(false);
    } catch (e) {
      console.error("Failed to send run command", e);
      toast.error("Falha ao executar o arquivo.");
    }
  };

  const handleCreateFile = async (fileInfo) => {
    if (!fileInfo?.name) return;
    try {
      if (fileInfo.type === "folder") {
        const payload = {
          path: fileInfo.name.replace(/\/+$/, ""),
          type: "folder",
        };
        const response = await fetch(`/api/tree/${sessionId}`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          toast.error(`Erro ao criar pasta: ${await response.text().catch(() => "")}`);
        }
        await loadTree();
        publishTreeEvent("CREATED", payload.path);
      } else {
        const payload = {
          path: fileInfo.name,
          type: "file",
          content: `// Arquivo: ${fileInfo.name}\n`,
        };
        const response = await fetch(`/api/tree/${sessionId}`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          toast.error(`Erro ao criar arquivo: ${await response.text().catch(() => "")}`);
        }
        await loadTree();
        handleFileClick(fileInfo.name);
        publishTreeEvent("CREATED", payload.path);
      }
    } catch (err) {
      toast.error("Não foi possível criar o arquivo/pasta.");
    }
    setCreateFileModalOpen(false);
  };

  useEffect(() => {
    if (!terminalMinimized) {
      try {
        terminalApiRef.current?.fit();
      } catch (_) { }
    }
  }, [terminalMinimized]);
  // Item 19: Command Palette executor
  const handleCommandExecute = (action) => {
    switch (action) {
      case 'openSearch': setSearchModalOpen(true); break;
      case 'newFile':
        setSelectedParentForCreate('');
        setGlobalCreateType('file');
        setCreateFileModalOpen(true);
        break;
      case 'newFolder':
        setSelectedParentForCreate('');
        setGlobalCreateType('folder');
        setCreateFileModalOpen(true);
        break;
      case 'openAI': handleOpenAIModal(); break;
      case 'togglePreview': setShowPreview(p => !p); break;
      case 'toggleTerminal': setTerminalMinimized(p => !p); break;
      case 'toggleChat': setShowChat(p => !p); break;
      case 'toggleSidebar': setShowSidebar(p => !p); break;
      case 'formatCode': formatCode(); break;
      case 'resetLayout': resetPanelSizes(); setTerminalHeight(240); setChatHeight(220); setTerminalMinimized(false); setShowChat(true); setShowSidebar(true); break;
      case 'download': handleDownloadProject(); break;
      case 'openShare': setShareModalOpen(true); break;
      case 'openSettings': setThemeModalOpen(true); break;
      case 'openAccount': setAccountModalOpen(true); break;
      case 'logout': localStorage.removeItem('jwtToken'); window.location.href = "/"; break;
      default: break;
    }
  };

  return (
    <>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onExecute={handleCommandExecute}
      />
      <EnhancedCreateFileModal
        isOpen={isCreateFileModalOpen}
        onClose={() => setCreateFileModalOpen(false)}
        onCreate={handleCreateFile}
        folders={folderNames}
        defaultParent={selectedParentForCreate}
        defaultType={globalCreateType || "file"}
      />
      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSearch={handleSearch}
        results={searchResults}
        onSelect={handleSearchResultSelect}
      />
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setAIModalOpen(false)}
        activeFile={activeFile}
        editorContent={editorContent}
        selectedText={selectedText}
        sessionId={sessionId}
        onInsertCode={handleInsertCode}
      />
      <div className="h-screen flex flex-col font-sans overflow-hidden transition-colors duration-500 editor-page-layout pb-[22px]">

        <header
          className="p-3 flex justify-between items-center shrink-0 z-10 border-b-2 editor-page-header"
          style={{
            backgroundColor: "var(--header-bg-color)",
            borderColor: "var(--panel-border-color)",
          }}
        >
          <div>
            <h1
              className="text-xl font-bold"
              style={{ color: "var(--primary-color)" }}
            >
              TeamCode
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted-color)" }}>
              Sessão: <span className="font-bold">{sessionId}</span>
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeSwitcher showFont={true} />
            <button
              onClick={() => {
                localStorage.removeItem("jwtToken");
                window.location.href = "/";
              }}
              className="px-3 py-1 text-sm border-2 font-bold neo-shadow-button hover:bg-red-500 hover:text-white"
              style={{
                borderColor: "var(--panel-border-color)",
                color: "var(--text-color)",
              }}
            >
              Logout
            </button>
            <div className="text-right relative group/participants">
              <h3 className="font-bold flex items-center gap-1.5 justify-end">
                <span className="codicon codicon-person" style={{ fontSize: 14 }} />
                Participantes ({participants.length})
              </h3>
              <div className="text-xs space-y-0.5 mt-0.5">
                {participants.map((p, idx) => {
                  // Support both string and object formats {userId, username}
                  const username = typeof p === 'string' ? p : (p?.username || p?.userId || String(p));
                  // Find this participant's cursor data to get their active file
                  const cursorEntry = Object.values(cursors).find(c => c.username === username);
                  const editingFile = cursorEntry?.filePath;
                  const fileBasename = editingFile ? editingFile.split('/').pop() : null;
                  // Generate a color for this participant
                  const hue = (idx * 137 + 30) % 360;
                  return (
                    <div key={username} className="flex items-center justify-end gap-1.5" title={editingFile ? `Editando: ${editingFile}` : username}>
                      <span className="truncate max-w-[100px]" style={{ color: "var(--text-muted-color)" }}>
                        {fileBasename ? (
                          <span className="italic opacity-70">{fileBasename}</span>
                        ) : null}
                      </span>
                      <span className="font-semibold" style={{ color: "var(--text-color)" }}>{username}</span>
                      <span
                        style={{
                          width: 8, height: 8, borderRadius: '50%',
                          backgroundColor: `hsl(${hue}, 70%, 55%)`,
                          flexShrink: 0,
                          display: 'inline-block',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div
              className="text-sm font-bold px-3 py-1 border-2"
              style={{
                backgroundColor: "var(--input-bg-color)",
                borderColor: "var(--panel-border-color)",
                color: "var(--text-color)",
              }}
            >
              Status: {status}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`p-2 rounded hover:bg-[var(--input-bg-color)] transition-colors ${showPreview ? "text-[var(--primary-color)]" : ""}`}
                title="Toggle Preview"
                style={{
                  color: showPreview
                    ? "var(--primary-color)"
                    : "var(--text-color)",
                }}
              >
                <span className="codicon codicon-browser text-lg"></span>
              </button>

              <button
                onClick={() => {
                  resetPanelSizes();
                  setTerminalHeight(240);
                  setChatHeight(220);
                  setTerminalMinimized(false);
                  setShowChat(true);
                  setShowSidebar(true);
                  try {
                    localStorage.setItem("teamcode-terminal-height", "240");
                    localStorage.setItem("teamcode-chat-height", "220");
                  } catch (_) { }

                }}
                className="p-2 rounded hover:bg-[var(--input-bg-color)] transition-colors"
                title="Restaurar Layout"
                style={{ color: "var(--text-color)" }}
              >
                <span className="codicon codicon-layout text-lg"></span>
              </button>

              <button
                onClick={() => {
                  const newState = !terminalMinimized;
                  setTerminalMinimized(newState);
                  try {
                    localStorage.setItem(
                      "teamcode-terminal-minimized",
                      newState ? "1" : "0",
                    );
                  } catch (_) { }
                }}
                className={`p-2 rounded hover:bg-[var(--input-bg-color)] transition-colors ${!terminalMinimized ? "text-[var(--primary-color)]" : ""}`}
                title="Toggle Terminal"
                style={{
                  color: !terminalMinimized
                    ? "var(--primary-color)"
                    : "var(--text-color)",
                }}
              >
                <span className="codicon codicon-terminal text-lg"></span>
              </button>

              <button
                onClick={() => setShowChat(!showChat)}
                className={`p-2 rounded hover:bg-[var(--input-bg-color)] transition-colors ${showChat ? "text-[var(--primary-color)]" : ""}`}
                title="Toggle Chat"
                style={{
                  color: showChat
                    ? "var(--primary-color)"
                    : "var(--text-color)",
                }}
              >
                <span className="codicon codicon-comment-discussion text-lg"></span>
              </button>
            </div>
          </div>
        </header>

        <StatusBar
          activeFile={activeFile}
          cursorPos={cursorPos}
          language={activeFile ? getLanguageFromExtension(activeFile) : null}
          connectionStatus={status}
          problems={problems}
        />

        <div className="flex flex-grow overflow-hidden">
          {/* Activity Bar */}
          <div
            className="w-16 flex-shrink-0 flex flex-col items-center py-3 border-r-2 z-20"
            style={{
              backgroundColor: "var(--header-bg-color)",
              borderColor: "var(--panel-border-color)",
            }}
          >
            {/* Top buttons */}
            <button
              onClick={() => {
                if (activeSidebarTab === 'EXPLORER' && showSidebar) {
                  setShowSidebar(false);
                } else {
                  setActiveSidebarTab('EXPLORER');
                  setShowSidebar(true);
                }
              }}
              className={`p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors ${showSidebar && activeSidebarTab === 'EXPLORER' ? "border-l-2 border-[var(--primary-color)]" : ""}`}
              title="Explorer"
              style={{
                color: showSidebar && activeSidebarTab === 'EXPLORER'
                  ? "var(--primary-color)"
                  : "var(--text-muted-color)",
              }}
            >
              <span
                className="codicon codicon-files"
                style={{ fontSize: "28px" }}
              ></span>
            </button>
            <button
              onClick={() => {
                if (activeSidebarTab === 'GIT' && showSidebar) {
                  setShowSidebar(false);
                } else {
                  setActiveSidebarTab('GIT');
                  setShowSidebar(true);
                }
              }}
              className={`p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors ${showSidebar && activeSidebarTab === 'GIT' ? "border-l-2 border-[var(--primary-color)]" : ""}`}
              title="Source Control"
              style={{
                color: showSidebar && activeSidebarTab === 'GIT'
                  ? "var(--primary-color)"
                  : "var(--text-muted-color)",
              }}
            >
              <span
                className="codicon codicon-source-control"
                style={{ fontSize: "28px" }}
              ></span>
            </button>
            <button
              onClick={() => setSearchModalOpen(true)}
              className="p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors"
              title="Search"
              style={{ color: "var(--text-muted-color)" }}
            >
              <span
                className="codicon codicon-search"
                style={{ fontSize: "28px" }}
              ></span>
            </button>
            <button
              onClick={() => handleOpenAIModal()}
              className="p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors"
              title="AI Assistant"
              style={{ color: "var(--text-muted-color)" }}
            >
              <span
                className="codicon codicon-robot"
                style={{ fontSize: "28px" }}
              ></span>
            </button>

            {/* Spacer */}
            <div className="flex-grow"></div>

            {/* Bottom buttons */}
            <button
              onClick={() => setShareModalOpen(true)}
              className="p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors"
              title="Share Room Link"
              style={{ color: "var(--text-muted-color)" }}
            >
              <span
                className="codicon codicon-share"
                style={{ fontSize: "28px" }}
              ></span>
            </button>
            <button
              onClick={() => setAccountModalOpen(true)}
              className="p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors"
              title="Account"
              style={{ color: "var(--text-muted-color)" }}
            >
              <span
                className="codicon codicon-account"
                style={{ fontSize: "28px" }}
              ></span>
            </button>
            <button
              onClick={() => setThemeModalOpen(true)}
              className="p-1 rounded hover:bg-[var(--input-bg-color)] transition-colors"
              title="Settings"
              style={{ color: "var(--text-muted-color)" }}
            >
              <span
                className="codicon codicon-settings-gear"
                style={{ fontSize: "28px" }}
              ></span>
            </button>
          </div>

          <aside
            className="h-full flex flex-col editor-page-panel flex-shrink-0 transition-all duration-300 ease-in-out relative"
            style={{
              flexBasis: showSidebar ? `${panelSizes.left}%` : "0%",
              width: showSidebar ? "auto" : "0px",
              minWidth: showSidebar ? "220px" : "0px",
              maxWidth: "50%",
              opacity: showSidebar ? 1 : 0,
              visibility: showSidebar ? "visible" : "hidden",
              overflow: "hidden",
              backgroundColor: "var(--panel-bg-color)",
              borderColor: "var(--panel-border-color)",
              borderRightWidth: showSidebar ? "2px" : "0px",
            }}
            onDragOver={handleSidebarDragOver}
            onDragLeave={handleSidebarDragLeave}
            onDrop={handleSidebarDrop}
          >
            {/* Item 17: Drag & Drop overlay */}
            {isDraggingOver && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
                style={{ background: 'rgba(var(--primary-color-rgb, 99, 102, 241), 0.15)', border: '2px dashed var(--primary-color)' }}>
                <span className="codicon codicon-cloud-upload" style={{ fontSize: 40, color: 'var(--primary-color)' }} />
                <p className="mt-2 text-sm font-bold" style={{ color: 'var(--primary-color)' }}>Solte para fazer upload</p>
              </div>
            )}
            {activeSidebarTab === 'EXPLORER' ? (
              <>
                <div
                  className="p-3 border-b-2 flex flex-col gap-2"
                  style={{ borderColor: "var(--panel-border-color)" }}
                >
                  <div className="flex justify-between items-center">
                    <h2
                      className="font-bold text-xs uppercase tracking-wider"
                      style={{ color: "var(--text-muted-color)" }}
                    >
                      Explorer
                    </h2>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => setCreateFileModalOpen(true)}
                        title="Novo Arquivo"
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--input-bg-color)]"
                        style={{ color: "var(--text-color)" }}
                      >
                        <span className="codicon codicon-new-file"></span>
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        title="Upload de Arquivo (ou arraste aqui)"
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--input-bg-color)]"
                        style={{ color: "var(--text-color)" }}
                      >
                        <span className="codicon codicon-cloud-upload"></span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex-grow p-2 overflow-y-auto">
                  <RecursiveTree
                    root={treeRoot || { name: "", type: "folder", children: [] }}
                    selectedPath={activeFile}
                    onSelectFile={(p) => {
                      setSelectedPath(p);
                      handleFileClick(p);
                    }}
                    onMove={(from, to) => handleMoveFile(from, to)}
                    onCreate={({ parentPath, type, name }) => {
                      const parent = (parentPath || "").replace(/\/+$/, "");
                      if (name) {
                        handleCreateFile({ name, type: "file" });
                        return;
                      }
                      setSelectedParentForCreate(parent);
                      setGlobalCreateType(type || "file");
                      setCreateFileModalOpen(true);
                    }}
                    onDelete={(p) => requestDelete(p)}
                    onRename={(p) => openRename(p)}
                    onDuplicate={duplicateFolder}
                    onRunFile={handleRunFile}
                    onOpenTerminal={handleOpenTerminalAtFolder}
                    onOpenToSide={(p) => toast.info(`Abrindo "${p.split('/').pop()}" em visualização secundária`)}
                  />
                </div>
              </>
            ) : (
              <GitPanel
                sessionId={sessionId}
                getAuthHeaders={getAuthHeaders}
                publishTreeEvent={publishTreeEvent}
                loadTree={loadTree}
              />
            )}
            <ConfirmDialog
              open={confirmState.open}
              title={
                confirmState.isFolder ? "Excluir pasta" : "Excluir arquivo"
              }
              message={`Tem certeza que deseja excluir ${confirmState.isFolder ? "a pasta" : "o arquivo"
                } "${confirmState.path}"? Essa ação não pode ser desfeita.`}
              confirmLabel="Excluir"
              onConfirm={confirmDelete}
              onCancel={() =>
                setConfirmState({ open: false, path: null, isFolder: false })
              }
            />
            <RenameModal
              open={renameState.open}
              initialPath={renameState.path}
              onClose={() => setRenameState({ open: false, path: null })}
              onSubmit={submitRename}
            />
          </aside>

          {showSidebar && <ResizeHandle onMouseDown={onMouseDown("left")} />}

          <div
            className="h-full flex-grow flex flex-col min-w-0 transition-all duration-300 ease-in-out"
            style={{ flexBasis: `${panelSizes.center}%` }}
          >
            <FileTabs
              openFiles={openFiles}
              activeFile={activeFile}
              onTabClick={setActiveFile}
              onTabClose={handleTabClose}
              onRunFile={handleRunFile}
              isRunning={isRunning}
              onFormat={formatCode}
            />
            <main className="flex-grow relative min-h-0 overflow-hidden flex">
              {openFiles.length > 0 ? (
                <>
                  <div
                    className={`h-full ${showPreview ? "w-1/2" : "w-full"} transition-all duration-300`}
                  >
                    <Editor
                      key={`${theme}-${fontSize}`} // Re-render when theme or font size changes
                      height="100%"
                      theme={theme.endsWith("light") ? "light" : "vs-dark"}
                      path={activeFile}
                      language={getLanguageFromExtension(activeFile)}
                      onMount={handleEditorDidMount}
                      onChange={handleEditorChange}
                      options={{
                        automaticLayout: true,
                        minimap: { enabled: true },
                        fontSize: fontSize,
                      }}
                    />
                  </div>
                  {showPreview && (() => {
                    const isMarkdown = activeFile && activeFile.toLowerCase().endsWith('.md');
                    return (
                      <div
                        className="w-1/2 h-full border-l-2 flex flex-col"
                        style={{ borderColor: "var(--panel-border-color)" }}
                      >
                        <div
                          className="p-2 border-b-2 flex justify-between items-center"
                          style={{
                            borderColor: "var(--panel-border-color)",
                            backgroundColor: "var(--panel-bg-color)",
                          }}
                        >
                          <span className="font-bold text-sm flex items-center gap-1.5">
                            {isMarkdown ? (
                              <><span className="codicon codicon-preview" style={{ fontSize: 14 }} /> Markdown Preview</>
                            ) : (
                              <><span className="codicon codicon-browser" style={{ fontSize: 14 }} /> Live Preview</>
                            )}
                          </span>
                          {!isMarkdown && (
                            <button
                              onClick={() => {
                                if (stompClientRef.current?.connected && activeFile) {
                                  stompClientRef.current.publish({
                                    destination: `/app/save/${sessionId}`,
                                    body: JSON.stringify({
                                      fileName: activeFile,
                                      content: editorContent || "",
                                    }),
                                  });
                                }
                                setTimeout(() => {
                                  const frame = document.getElementById("preview-frame");
                                  if (frame) frame.src = frame.src;
                                }, 500);
                              }}
                              className="p-1 hover:bg-gray-700 rounded"
                              title="Salvar e Recarregar"
                            >
                              <span className="codicon codicon-refresh"></span>
                            </button>
                          )}
                        </div>
                        {isMarkdown ? (
                          <div
                            className="flex-grow overflow-y-auto p-4 markdown-preview"
                            style={{
                              backgroundColor: theme.endsWith('light') ? '#ffffff' : '#1e1e1e',
                              color: "var(--text-color)",
                            }}
                          >
                            <ReactMarkdown>{editorContent || ''}</ReactMarkdown>
                          </div>
                        ) : (
                          <iframe
                            id="preview-frame"
                            src={`/preview/${sessionId}/${previewFile}`}
                            className="w-full flex-grow bg-white"
                            title="Live Preview"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                          />
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    backgroundColor: theme.endsWith("light")
                      ? "#FFFFFF"
                      : "#1E1E1E",
                    color: "var(--text-muted-color)",
                  }}
                >
                  <p>Abra um arquivo para começar a editar</p>
                </div>
              )}
            </main>
            {!terminalMinimized && (
              <div
                className="chat-resize-handle z-10"
                onMouseDown={onTerminalMouseDown}
                title="Ajustar altura do terminal"
                style={{ cursor: "row-resize" }}
              />
            )}
            <footer
              className={`flex-shrink-0 border-t-2 terminal-footer flex flex-col ${terminalMinimized ? "hidden" : ""
                }`}
              style={{
                backgroundColor: "var(--terminal-bg-color)",
                borderColor: "var(--panel-border-color)",
                height: `${terminalHeight}px`,
                maxHeight: "none",
              }}
            >
              <div className="flex justify-between items-center px-4 py-1 border-b border-[var(--panel-border-color)] bg-[var(--panel-bg-color)] select-none">
                <div className="flex space-x-6">
                  <span
                    onClick={() => setActiveTerminalTab("TERMINAL")}
                    className={`text-xs font-bold cursor-pointer pb-1 transition-all ${activeTerminalTab === "TERMINAL"
                        ? "border-b-2 border-[var(--primary-color)]"
                        : "opacity-50 hover:opacity-100"
                      }`}
                    style={{ color: "var(--text-color)" }}
                  >
                    TERMINAL
                  </span>
                  <span
                    onClick={() => setActiveTerminalTab("OUTPUT")}
                    className={`text-xs font-bold cursor-pointer pb-1 transition-all ${activeTerminalTab === "OUTPUT"
                        ? "border-b-2 border-[var(--primary-color)]"
                        : "opacity-50 hover:opacity-100"
                      }`}
                    style={{ color: "var(--text-color)" }}
                  >
                    OUTPUT
                  </span>
                  <span
                    onClick={() => setActiveTerminalTab("PROBLEMS")}
                    className={`text-xs font-bold cursor-pointer pb-1 transition-all ${activeTerminalTab === "PROBLEMS"
                        ? "border-b-2 border-[var(--primary-color)]"
                        : "opacity-50 hover:opacity-100"
                      }`}
                    style={{ color: "var(--text-color)" }}
                  >
                    PROBLEMS
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      if (activeTerminalTab === "TERMINAL") {
                        terminalApiRef.current?.clear();
                      } else if (activeTerminalTab === "OUTPUT") {
                        setTerminalOutput([]);
                      } else if (activeTerminalTab === "PROBLEMS") {
                        setProblems([]);
                      }
                    }}
                    title="Clear"
                    className="hover:text-[var(--primary-color)] transition-colors"
                    style={{ color: "var(--text-color)" }}
                  >
                    <span className="codicon codicon-clear-all"></span>
                  </button>
                  <button
                    onClick={() => {
                      const newHeight = terminalHeight === 240 ? 400 : 240;
                      setTerminalHeight(newHeight);
                      try {
                        localStorage.setItem(
                          "teamcode-terminal-height",
                          String(newHeight),
                        );
                      } catch (_) { }
                      setTimeout(() => terminalApiRef.current?.fit(), 100);
                    }}
                    title="Toggle Maximize Panel"
                    className="hover:text-[var(--primary-color)] transition-colors"
                    style={{ color: "var(--text-color)" }}
                  >
                    <span
                      className={`codicon ${terminalHeight === 240 ? "codicon-chevron-up" : "codicon-chevron-down"}`}
                    ></span>
                  </button>
                  <button
                    onClick={() => {
                      setTerminalMinimized(true);
                      try {
                        localStorage.setItem(
                          "teamcode-terminal-minimized",
                          "1",
                        );
                      } catch (_) { }
                    }}
                    title="Close Panel"
                    className="hover:text-[var(--primary-color)] transition-colors"
                    style={{ color: "var(--text-color)" }}
                  >
                    <span className="codicon codicon-close"></span>
                  </button>
                </div>
              </div>
              <div className="flex-grow relative">
                <div
                  className={`h-full w-full ${activeTerminalTab === "TERMINAL" ? "" : "hidden"}`}
                >
                  <TerminalComponent
                    sessionId={sessionId}
                    stompClient={stompClientRef.current}
                    registerApi={(api) => {
                      terminalApiRef.current = api;
                    }}
                  />
                </div>
                <div
                  className={`h-full w-full overflow-y-auto ${activeTerminalTab === "OUTPUT" ? "" : "hidden"}`}
                  style={{
                    backgroundColor: "var(--terminal-bg-color)",
                    color: "var(--text-color)",
                  }}
                >
                  {terminalOutput.length === 0 ? (
                    <div className="p-4">
                      <p className="text-sm opacity-70">
                        Nenhuma saída de console ainda.
                      </p>
                      <p className="text-xs opacity-50 mt-2">
                        Execute comandos no terminal para ver a saída aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 font-mono text-sm space-y-2">
                      {terminalOutput.map((output, idx) => (
                        <div
                          key={idx}
                          className="whitespace-pre-wrap"
                          style={{
                            color:
                              output.type === "error"
                                ? "#ef4444"
                                : "var(--text-color)",
                          }}
                        >
                          <span className="opacity-50">
                            [{output.timestamp}]
                          </span>{" "}
                          {output.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  className={`h-full w-full overflow-y-auto ${activeTerminalTab === "PROBLEMS" ? "" : "hidden"}`}
                  style={{
                    backgroundColor: "var(--terminal-bg-color)",
                    color: "var(--text-color)",
                  }}
                >
                  {problems.length === 0 ? (
                    <div className="p-4">
                      <p className="text-sm opacity-70">
                        Nenhum problema detectado.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--panel-border-color)]">
                      {problems.map((problem, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            if (editorRef.current) {
                              editorRef.current.setPosition({
                                lineNumber: problem.line,
                                column: problem.column,
                              });
                              editorRef.current.revealLineInCenter(
                                problem.line,
                              );
                              editorRef.current.focus();
                              setActiveTerminalTab("TERMINAL");
                            }
                          }}
                          className="p-3 hover:bg-[var(--input-bg-color)] cursor-pointer transition-colors flex items-start space-x-3"
                        >
                          <span
                            className={`codicon mt-0.5 ${problem.severity === "error"
                                ? "codicon-error text-red-500"
                                : problem.severity === "warning"
                                  ? "codicon-warning text-yellow-500"
                                  : "codicon-info text-blue-500"
                              }`}
                          ></span>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: "var(--text-color)" }}
                            >
                              {problem.message}
                            </p>
                            <p className="text-xs opacity-60 mt-1">
                              {problem.filePath} [{problem.line},{" "}
                              {problem.column}]
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </footer>
          </div>

          {showChat && <ResizeHandle onMouseDown={onMouseDown("right")} />}

          <aside
            ref={rightAsideRef}
            className="h-full flex flex-col editor-page-panel chat-panel flex-shrink-0 transition-all duration-300 ease-in-out"
            style={{
              flexBasis: showChat ? `${panelSizes.right}%` : "0%",
              width: showChat ? "auto" : "0px",
              minWidth: showChat ? "220px" : "0px",
              maxWidth: "50%",
              opacity: showChat ? 1 : 0,
              visibility: showChat ? "visible" : "hidden",
              overflow: "hidden",
              backgroundColor: "var(--panel-bg-color)",
              borderColor: "var(--panel-border-color)",
              borderLeftWidth: showChat ? "2px" : "0px",
            }}
          >
            <div
              className="p-3 border-b-2 flex flex-col"
              style={{ borderColor: "var(--panel-border-color)" }}
            >
              <div className="flex items-center justify-between">
                <h2
                  className="font-bold text-base flex items-center gap-2"
                  style={{ color: "var(--primary-color)" }}
                >
                  <span className="codicon codicon-comment-discussion" />
                  Chat da Sessão
                </h2>
                <button
                  onClick={() => setShowParticipantsList(!showParticipantsList)}
                  className="px-2 py-0.5 text-xs rounded border font-semibold flex items-center gap-1 hover:opacity-85 transition-opacity"
                  style={{
                    borderColor: "var(--panel-border-color)",
                    backgroundColor: "var(--input-bg-color)",
                    color: "var(--text-color)",
                    boxShadow: "1px 1px 0px var(--panel-border-color)"
                  }}
                >
                  <span className="codicon codicon-organization small" />
                  <span>{participants.length}</span>
                  <span className={`codicon ${showParticipantsList ? 'codicon-chevron-up' : 'codicon-chevron-down'} small`} style={{ fontSize: 11 }} />
                </button>
              </div>

              {showParticipantsList && (
                <div 
                  className="mt-2.5 p-2 rounded border border-dashed flex flex-col gap-1.5 max-h-36 overflow-y-auto"
                  style={{
                    borderColor: "var(--panel-border-color)",
                    backgroundColor: "rgba(0,0,0,0.05)"
                  }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted-color)" }}>
                    Conectados ({participants.length})
                  </div>
                  {participants.length === 0 ? (
                    <div className="text-xs italic" style={{ color: "var(--text-muted-color)" }}>Apenas você na sessão</div>
                  ) : (
                    participants.map((p, pIdx) => {
                      const pName = typeof p === 'string' ? p : (p?.username || p?.userId || "User");
                      const pInitials = getInitials(pName);
                      const pGradient = hashStringToColor(pName);
                      const isMe = pName === localStorage.getItem("username");
                      return (
                        <div key={pIdx} className="flex items-center justify-between text-sm py-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div 
                              className={`w-5.5 h-5.5 rounded-full bg-gradient-to-tr ${pGradient} flex items-center justify-center text-[10px] font-bold text-white border border-black/10 flex-shrink-0`}
                              style={{ width: '22px', height: '22px' }}
                            >
                              {pInitials}
                            </div>
                            <span className="font-semibold truncate max-w-[110px]" style={{ color: "var(--text-color)" }}>
                              {pName} {isMe && "(Você)"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px]" style={{ color: "var(--text-muted-color)" }}>online</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div
              ref={messagesRef}
              className="p-3 overflow-y-auto space-y-3 chat-container flex-1"
              style={{ height: `${chatHeight}px` }}
            >
              {(messages || []).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <span className="codicon codicon-comment text-3xl opacity-30 mb-2" />
                  <p className="text-sm" style={{ color: "var(--text-muted-color)" }}>
                    Nenhuma mensagem ainda.<br />Envie um oi para iniciar a conversa!
                  </p>
                </div>
              ) : (
                (messages || []).map((msg, idx) => {
                  const isSystem = msg.isSystem;
                  const currentUser = localStorage.getItem("username") || "User";
                  const isMe = msg.username === currentUser;
                  const displayTime = msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  if (isSystem) {
                    return (
                      <div key={idx} className="flex justify-center my-2 animate-fade-in">
                        <div 
                          className="px-2.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5"
                          style={{ 
                            backgroundColor: "var(--input-bg-color)",
                            borderColor: "var(--panel-border-color)",
                            opacity: 0.85
                          }}
                        >
                          <span className="codicon codicon-info text-blue-400" />
                          <span className="italic" style={{ color: "var(--text-muted-color)" }}>
                            {msg.content}
                          </span>
                          <span className="text-[10px] opacity-75" style={{ color: "var(--text-muted-color)" }}>
                            ({displayTime})
                          </span>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={idx} className={`flex items-start gap-2 my-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar for other users */}
                      {!isMe && (
                        <div 
                          className={`w-7.5 h-7.5 rounded-full bg-gradient-to-tr ${hashStringToColor(msg.username)} flex items-center justify-center text-xs font-bold text-white shadow-sm border border-black/10 flex-shrink-0`}
                          style={{ width: '30px', height: '30px' }}
                          title={msg.username}
                        >
                          {getInitials(msg.username)}
                        </div>
                      )}
                      
                      <div className={`flex flex-col max-w-[82%] ${isMe ? 'items-end' : 'items-start'}`}>
                        {/* Sender info */}
                        <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
                          {!isMe && (
                            <span className="text-xs font-bold" style={{ color: "var(--primary-color)" }}>
                              {msg.username}
                            </span>
                          )}
                          <span className="text-[10px]" style={{ color: "var(--text-muted-color)" }}>
                            {displayTime}
                          </span>
                        </div>
                        
                        {/* Bubble */}
                        <div 
                          className="border-2 p-3 rounded-xl text-[15px] leading-relaxed shadow-sm animate-fade-in"
                          style={{
                            backgroundColor: isMe ? "var(--primary-bg-color)" : "var(--input-bg-color)",
                            borderColor: "var(--panel-border-color)",
                            borderTopRightRadius: isMe ? '2px' : '10px',
                            borderTopLeftRadius: isMe ? '10px' : '2px',
                            color: "var(--text-color)",
                            boxShadow: "1.5px 1.5px 0px var(--panel-border-color)",
                            wordBreak: "break-word"
                          }}
                        >
                          {renderMessageContent(msg.content)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            <div
              className="chat-resize-handle"
              onMouseDown={onChatMouseDown}
              title="Ajustar altura do chat"
            />

            <div
              className="p-3 border-t-2 chat-input flex flex-col"
              style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--panel-bg-color)" }}
            >
              {/* Shortcuts Toolbar */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleInsertText("`")}
                    title="Inserir Código Inline"
                    className="px-1.5 py-0.5 rounded border text-xs font-mono hover:opacity-85 active:scale-95 transition-all flex items-center justify-center gap-0.5"
                    style={{
                      borderColor: "var(--panel-border-color)",
                      backgroundColor: "var(--input-bg-color)",
                      color: "var(--text-color)",
                      boxShadow: "0.5px 0.5px 0px var(--panel-border-color)"
                    }}
                  >
                    <span>`</span>
                    <span className="text-[10px] opacity-75 font-sans">código</span>
                  </button>
                </div>
                
                <div className="flex items-center gap-1.5">
                  {['💻', '🚀', '🔥', '👍', '🎉'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleInsertText(emoji)}
                      className="hover:scale-125 hover:rotate-3 active:scale-90 transition-all duration-100 text-sm select-none"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea + Button side-by-side */}
              <div className="flex gap-2">
                <textarea
                  ref={chatTextareaRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    (e.preventDefault(), handleSendChatMessage())
                  }
                  placeholder="Mensagem..."
                  className="flex-1 p-2 border-2 resize-none focus:outline-none rounded-lg text-[14.5px]"
                  style={{
                    backgroundColor: "var(--input-bg-color)",
                    borderColor: "var(--panel-border-color)",
                    color: "var(--text-color)",
                    fontSize: "14.5px",
                    lineHeight: "1.4"
                  }}
                  rows="2"
                />
                
                <button
                  onClick={handleSendChatMessage}
                  disabled={!chatInput.trim()}
                  className="px-2.5 py-1.5 border-2 rounded-lg font-bold transition-all duration-150 flex flex-col items-center justify-center gap-0.5 self-stretch"
                  style={{
                    backgroundColor: chatInput.trim() ? "var(--primary-color)" : "rgba(0,0,0,0.03)",
                    borderColor: "var(--panel-border-color)",
                    color: chatInput.trim() ? "#fff" : "var(--text-muted-color)",
                    opacity: chatInput.trim() ? 1 : 0.6,
                    cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                    boxShadow: chatInput.trim() ? "1.5px 1.5px 0px var(--panel-border-color)" : "none",
                    transform: chatInput.trim() ? "translate(0, 0)" : "none",
                  }}
                >
                  <span className="codicon codicon-send text-sm" />
                  <span className="text-[10px] uppercase tracking-wider font-bold">Enviar</span>
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Theme Modal */}
        {themeModalOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setThemeModalOpen(false)}
          >
            <div
              className="border-4 p-6 max-w-md w-full neo-shadow-card flex flex-col items-center"
              style={{
                backgroundColor: "var(--panel-bg-color)",
                borderColor: "var(--panel-border-color)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                className="text-2xl font-bold mb-4 text-center w-full"
                style={{ color: "var(--primary-color)" }}
              >
                Configurações
              </h2>

              <div className="w-full mb-6">
                <ThemeSwitcher showFont={true} />
              </div>

              {/* Item 20: Yjs/CRDT toggle */}
              <div className="w-full mb-4 p-3 border-2 rounded" style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--input-bg-color)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-color)' }}>
                      <span className="codicon codicon-sync mr-1" /> Yjs/CRDT (Experimental)
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted-color)' }}>
                      {isYjsActive ? '🟢 Ativo' : yjsEnabled ? '🟡 Aguardando conexão...' : '⚪ Inativo'}
                    </p>
                    <p className="text-xs mt-1 opacity-60" style={{ color: 'var(--text-muted-color)' }}>
                      Colaboração CRDT. Requer suporte no backend.
                    </p>
                  </div>
                  <button
                    id="yjs-toggle-btn"
                    onClick={() => {
                      const next = !yjsEnabled;
                      setYjsEnabled(next);
                      try { localStorage.setItem('teamcode-yjs-enabled', next ? '1' : '0'); } catch (_) {}
                      toast.info(next ? 'Yjs/CRDT ativado (experimental)' : 'Yjs/CRDT desativado');
                    }}
                    className="px-3 py-1 text-xs font-bold border-2 neo-shadow-button transition-colors"
                    style={{
                      backgroundColor: yjsEnabled ? 'var(--primary-color)' : 'var(--input-bg-color)',
                      borderColor: 'var(--primary-color)',
                      color: yjsEnabled ? '#fff' : 'var(--text-color)',
                    }}
                  >
                    {yjsEnabled ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setThemeModalOpen(false)}
                className="mt-4 w-full py-2 border-2 font-bold neo-shadow-button"
                style={{
                  backgroundColor: "var(--input-bg-color)",
                  borderColor: "var(--panel-border-color)",
                  color: "var(--text-color)",
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* Share Room Modal */}
        {shareModalOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShareModalOpen(false)}
          >
            <div
              className="border-4 p-6 max-w-md w-full neo-shadow-card"
              style={{
                backgroundColor: "var(--panel-bg-color)",
                borderColor: "var(--panel-border-color)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                className="text-2xl font-bold mb-4"
                style={{ color: "var(--primary-color)" }}
              >
                Compartilhar Sala
              </h2>
              <p className="mb-4" style={{ color: "var(--text-color)" }}>
                Compartilhe este link para convidar outros desenvolvedores para
                esta sessão:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={window.location.href}
                  className="flex-1 p-2 border-2 font-mono text-sm"
                  style={{
                    backgroundColor: "var(--input-bg-color)",
                    borderColor: "var(--panel-border-color)",
                    color: "var(--text-color)",
                  }}
                  onClick={(e) => e.target.select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copiado!");
                  }}
                  className="px-4 py-2 border-2 font-bold neo-shadow-button"
                  style={{
                    backgroundColor: "var(--button-bg-color)",
                    borderColor: "var(--primary-color)",
                    color: "var(--button-text-color)",
                  }}
                >
                  Copiar
                </button>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="mt-4 w-full py-2 border-2 font-bold neo-shadow-button"
                style={{
                  backgroundColor: "var(--input-bg-color)",
                  borderColor: "var(--panel-border-color)",
                  color: "var(--text-color)",
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}

        {/* Account Modal */}
        {accountModalOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-65 flex items-center justify-center z-[100] backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setAccountModalOpen(false)}
          >
            <div
              className="border-4 p-8 max-w-md w-full neo-shadow-card rounded-2xl transform scale-100 transition-transform duration-300 relative overflow-hidden"
              style={{
                backgroundColor: "var(--panel-bg-color)",
                borderColor: "var(--panel-border-color)",
                boxShadow: "8px 8px 0px 0px var(--panel-border-color)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Pulsing online badge in corner */}
              <div className="absolute top-4 right-4 flex items-center space-x-1.5 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/30">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Online</span>
              </div>

              {/* Avatar section with gradient border */}
              <div className="flex flex-col items-center text-center pb-6 border-b-2 border-dashed" style={{ borderColor: 'var(--panel-border-color)' }}>
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-black mb-3 select-none transform hover:scale-105 transition-transform duration-200 shadow-md bg-gradient-to-tr from-amber-500 to-rose-500 border-2 border-black">
                  {(localStorage.getItem("username") || "User").charAt(0).toUpperCase()}
                </div>
                <h2 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-color)" }}>
                  {localStorage.getItem("username") || "User"}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold border-2 mt-1 bg-[var(--input-bg-color)] text-[var(--primary-color)]" style={{ borderColor: 'var(--panel-border-color)' }}>
                  Desenvolvedor
                </span>
              </div>

              {/* Information Rows */}
              <div className="space-y-4 my-6">
                <div className="p-3 border-2 rounded-xl" style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)" }}>
                  <div className="flex items-center space-x-2 text-xs mb-1 font-bold" style={{ color: "var(--text-muted-color)" }}>
                    <span className="codicon codicon-account" />
                    <span>NOME DE USUÁRIO</span>
                  </div>
                  <p className="font-bold text-sm" style={{ color: "var(--text-color)" }}>
                    {localStorage.getItem("username") || "User"}
                  </p>
                </div>

                <div className="p-3 border-2 rounded-xl" style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)" }}>
                  <div className="flex items-center space-x-2 text-xs mb-1 font-bold" style={{ color: "var(--text-muted-color)" }}>
                    <span className="codicon codicon-organization" />
                    <span>SALA ATIVA (ID)</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="font-mono text-[10px] select-all truncate max-w-[200px] font-bold p-1 rounded bg-black/10 text-[var(--text-color)]">
                      {sessionId}
                    </span>
                    <button
                      onClick={handleCopySessionId}
                      className="p-2 border-2 rounded-lg font-bold hover:scale-105 transition-all text-xs flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: copiedSessionId ? "rgba(34, 197, 94, 0.2)" : "var(--button-bg-color)",
                        color: copiedSessionId ? "rgb(74, 222, 128)" : "var(--button-text-color)",
                        borderColor: "var(--panel-border-color)",
                      }}
                      title="Copiar ID da Sala"
                    >
                      {copiedSessionId ? (
                        <>
                          <span className="codicon codicon-check mr-1 animate-bounce" />
                          <span>Copiado!</span>
                        </>
                      ) : (
                        <>
                          <span className="codicon codicon-copy mr-1" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => {
                    localStorage.removeItem("jwtToken");
                    window.location.href = "/";
                  }}
                  className="w-full py-2.5 border-2 font-black text-sm neo-shadow-button hover:bg-red-500 hover:text-white rounded-xl transition-all"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderColor: "var(--panel-border-color)",
                    color: "rgb(239, 68, 68)",
                  }}
                >
                  <span className="codicon codicon-sign-out mr-1.5" />
                  Logout
                </button>
                <button
                  onClick={() => setAccountModalOpen(false)}
                  className="w-full py-2.5 border-2 font-black text-sm neo-shadow-button rounded-xl transition-all"
                  style={{
                    backgroundColor: "var(--button-bg-color)",
                    borderColor: "var(--panel-border-color)",
                    color: "var(--button-text-color)",
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// --- App Principal ---
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("jwtToken"),
  );
  const sessionId = new URLSearchParams(window.location.search).get(
    "sessionId",
  );

  return (
    <ToastProvider>
      <ThemeProvider>
        {!isAuthenticated ? (
          <AuthPageExtracted
            onLoginSuccess={() => setIsAuthenticated(true)}
            ThemeSwitcher={ThemeSwitcher}
          />
        ) : sessionId ? (
          <EditorPage sessionId={sessionId} />
        ) : (
          <HomePageExtracted ThemeSwitcher={ThemeSwitcher} />
        )}
      </ThemeProvider>
    </ToastProvider>
  );
}
