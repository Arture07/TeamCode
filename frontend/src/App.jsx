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

// --- Theme Management ---
const themes = {
  "neobrutalism-dark": "Neo Brutalism (Dark)",
  neobrutalism: "Neo Brutalism (Light)",
  "aurora-light": "Aurora (Light)",
  aurora: "Aurora (Dark)",
  "cyber_glass-light": "Cyber Glass (Light)",
  cyber_glass: "Cyber Glass (Dark)",
};
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(
    localStorage.getItem("teamcode-theme") || "neobrutalism-dark"
  );

  useEffect(() => {
    localStorage.setItem("teamcode-theme", theme);
    document.body.className = "";
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => useContext(ThemeContext);

// --- UTILS ---
const LANGUAGES = [
  { name: "JavaScript", extension: ".js" },
  { name: "Python", extension: ".py" },
  { name: "Java", extension: ".java" },
  { name: "HTML", extension: ".html" },
  { name: "CSS", extension: ".css" },
  { name: "Markdown", extension: ".md" },
  { name: "JSON", extension: ".json" },
  { name: "TypeScript", extension: ".ts" },
  { name: "Shell Script", extension: ".sh" },
];

const getLanguageFromExtension = (fileName) => {
  if (!fileName) return "plaintext";
  const extension = fileName.split(".").pop().toLowerCase();
  switch (extension) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "java":
      return "java";
    case "html":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "sh":
      return "shell";
    default:
      return "plaintext";
  }
};

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
const getAuthHeaders = () => {
  const token = localStorage.getItem("jwtToken");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};

// --- COMPONENTS ---

function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="relative">
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="p-2 rounded-md appearance-none"
        style={{
          backgroundColor: "var(--input-bg-color)",
          color: "var(--text-color)",
          border: "2px solid var(--panel-border-color)",
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
                placeholder={type === "file" ? "nome-do-arquivo" : "nome-da-pasta"}
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
                      LANGUAGES.find((l) => l.extension === e.target.value)
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
  const { theme } = useTheme();
  const termRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (termRef.current) {
      termRef.current.dispose();
    }

    const terminalThemes = {
      "neobrutalism-dark": {
        background: "#1E1E1E",
        foreground: "#FF8C00",
        cursor: "#FF8C00",
      },
      neobrutalism: {
        background: "#000000",
        foreground: "#FF8C00",
        cursor: "#FF8C00",
      },
      "aurora-light": {
        background: "#111827",
        foreground: "#E5E7EB",
        cursor: "#D946EF",
      },
      aurora: {
        background: "transparent",
        foreground: "#e5e7eb",
        cursor: "#FF00FF",
      },
      "cyber_glass-light": {
        background: "#0f172a",
        foreground: "#E2E8F0",
        cursor: "#0284c7",
      },
      cyber_glass: {
        background: "transparent",
        foreground: "#e2e8f0",
        cursor: "#38BDF8",
      },
    };

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Fira Code, monospace",
      theme: terminalThemes[theme],
      allowTransparency:
        theme.includes("aurora") || theme.includes("cyber_glass"),
      convertEol: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    
    // Initial fit
    setTimeout(() => {
      try { fit.fit(); } catch (e) { console.warn("Initial fit failed", e); }
    }, 100);

    // Auto-fit on container resize
    const resizeObserver = new ResizeObserver(() => {
      try { fit.fit(); } catch (e) { console.warn("Resize fit failed", e); }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    const onDataDisposable = term.onData((d) => {
      if (stompClient?.connected) {
        try {
          stompClient.publish({
            destination: `/app/terminal.in/${sessionId}`,
            body: JSON.stringify({ input: d }),
          });
        } catch (_) {}
      }
    });

    termRef.current = term;

    if (typeof registerApi === "function") {
      registerApi({
        write: (data) => {
          if (termRef.current) termRef.current.write(data);
        },
        clear: () => {
          try {
            termRef.current?.clear();
          } catch (_) {}
        },
        fit: () => {
          try {
            fit.fit();
            console.log("Terminal fitted manually");
          } catch (e) {
            console.error("Manual fit failed", e);
          }
        },
      });
    }

    // Keep window resize listener as fallback
    const handleResize = () => {
        try { fit.fit(); } catch (_) {}
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      term.dispose();
    };
  }, [theme, sessionId, stompClient]);

  useEffect(() => {
    if (stompClient?.connected) {
      try {
        stompClient.publish({
          destination: `/app/terminal.start/${sessionId}`,
        });
      } catch (_) {}
    }
  }, [stompClient, sessionId]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function AuthPage({ onLoginSuccess }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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

function HomePage() {
  const [sessionName, setSessionName] = useState("");
  const [createdSession, setCreatedSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreateSession = async () => {
    if (!sessionName.trim()) {
      setError("Por favor, insira um nome para a sessão.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setCreatedSession(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ sessionName }),
      });
      if (!res.ok) throw new Error(`Erro na API (${res.status})`);
      const data = await res.json();
      setCreatedSession(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível conectar ao serviço de sessão.");
    } finally {
      setIsLoading(false);
    }
  };

  const getEditorLink = () => {
    if (!createdSession) return "";
    const url = new URL(window.location.href);
    url.searchParams.set("sessionId", createdSession.publicId);
    return url.href;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500">
      <div className="absolute top-6 right-6 flex items-center space-x-4">
        <ThemeSwitcher />
        <span className="font-bold">
          Olá, {localStorage.getItem("username") || "User"}!
        </span>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.reload();
          }}
          className="px-4 py-2 border-2 font-bold neo-shadow-button"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.8)",
            borderColor: "var(--panel-border-color)",
          }}
        >
          Logout
        </button>
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
            Crie uma sala de programação colaborativa
          </p>
        </div>
        <div className="space-y-4">
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Nome do projeto..."
            className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--input-bg-color)",
              borderColor: "var(--panel-border-color)",
              "--tw-ring-color": "var(--primary-color)",
              color: "var(--text-color)",
            }}
          />
          <button
            onClick={handleCreateSession}
            disabled={isLoading}
            className="w-full font-bold py-3 border-2 disabled:opacity-50 neo-shadow-button"
            style={{
              backgroundColor: "var(--button-bg-color)",
              color: "var(--button-text-color)",
              borderColor: "var(--panel-border-color)",
            }}
          >
            {isLoading ? "Criando..." : "Criar Sessão"}
          </button>
        </div>
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
        {createdSession && (
          <div
            className="p-4 border-2 space-y-2"
            style={{
              backgroundColor: "rgba(34, 197, 94, 0.1)",
              borderColor: "rgba(34, 197, 94, 0.5)",
            }}
          >
            <h3 className="font-bold">Sessão criada!</h3>
            <p className="text-sm">Abra este link em outra aba:</p>
            <input
              type="text"
              readOnly
              value={getEditorLink()}
              className="w-full p-2 border-2"
              style={{
                backgroundColor: "var(--input-bg-color)",
                borderColor: "var(--panel-border-color)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FileTabs({ openFiles, activeFile, onTabClick, onTabClose, onRunFile, isRunning, onFormat }) {
  return (
    <div
      className="flex-shrink-0 flex items-center overflow-x-auto border-b-2"
      style={{ backgroundColor: "var(--header-bg-color)", borderColor: "var(--panel-border-color)" }}
    >
      <div className="flex items-end flex-1 overflow-x-auto">
        {(openFiles || []).map((file) => (
          <div
            key={file}
            onClick={() => onTabClick(file)}
            className={`flex items-center space-x-2 px-4 py-2 cursor-pointer border-r-2 ${
              activeFile === file ? "active-tab" : "inactive-tab"
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
            className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            <span className="font-medium">{isRunning ? 'Running...' : 'Run'}</span>
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

function SearchModal({ isOpen, onClose, onSearch, results, onSelect }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    await onSearch(query);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="p-6 w-full max-w-2xl h-[80vh] flex flex-col border-2 glass-panel neo-shadow"
           style={{ backgroundColor: "var(--panel-bg-color)", borderColor: "var(--panel-border-color)", color: "var(--text-color)" }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold" style={{ color: "var(--primary-color)" }}>Busca Global</h2>
          <button onClick={onClose} className="text-xl font-bold">&times;</button>
        </div>
        <div className="flex space-x-2 mb-4">
          <input 
            value={query} 
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar em todos os arquivos..."
            className="flex-grow p-3 border-2 focus:outline-none focus:ring-2"
            style={{ backgroundColor: "var(--input-bg-color)", borderColor: "var(--panel-border-color)", color: "var(--text-color)", "--tw-ring-color": "var(--primary-color)" }}
          />
          <button onClick={handleSearch} className="px-6 py-2 border-2 font-bold neo-shadow-button"
                  style={{ backgroundColor: "var(--button-bg-color)", color: "var(--button-text-color)", borderColor: "var(--panel-border-color)" }}>
            Buscar
          </button>
        </div>
        <div className="flex-grow overflow-y-auto space-y-2 pr-2">
          {loading ? <p className="text-center p-4">Buscando...</p> : results.map((r, i) => (
            <div key={i} onClick={() => onSelect(r)} className="p-3 border-2 cursor-pointer hover:opacity-80 transition-opacity"
                 style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}>
              <div className="font-bold text-sm mb-1" style={{ color: "var(--primary-color)" }}>{r.path}</div>
              <div className="text-xs font-mono truncate opacity-80">Line {r.line}: {r.content}</div>
            </div>
          ))}
          {!loading && results.length === 0 && query && <p className="text-center p-4 opacity-60">Nenhum resultado encontrado.</p>}
        </div>
      </div>
    </div>
  );
}

function EditorPage({ sessionId }) {
  const [status, setStatus] = useState("Carregando...");
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [files, setFiles] = useState([]);
  const [isCreateFileModalOpen, setCreateFileModalOpen] = useState(false);
  const [editorContent, setEditorContent] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const DEFAULT_PANEL_SIZES = { left: 20, center: 55, right: 25 };
  const [panelSizes, setPanelSizes] = useState(() => {
    try {
      const raw = localStorage.getItem("teamcode-panel-sizes");
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return DEFAULT_PANEL_SIZES;
  });

  const editorRef = useRef(null);
  const stompClientRef = useRef(null);
  const chatMessagesEndRef = useRef(null);
  const rightAsideRef = useRef(null);
  const messagesRef = useRef(null);
  const debouncedEditorContent = useDebounce(editorContent, 1500);
  const terminalApiRef = useRef(null);
  const { theme } = useTheme();
  const dragInfo = useRef(null);
  const chatDragInfo = useRef(null);
  const terminalDragInfo = useRef(null);
  const [chatHeight, setChatHeight] = useState(() => {
    try {
      const v = localStorage.getItem("teamcode-chat-height");
      if (v) return Number(v);
    } catch (_) {}
    return 220;
  });
  const [terminalHeight, setTerminalHeight] = useState(() => {
    try {
      const v = localStorage.getItem("teamcode-terminal-height");
      if (v) return Number(v);
    } catch (_) {}
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

  // --- New Features Logic ---
  const handleSearch = async (query) => {
    try {
      const res = await fetch(`/api/tree/${sessionId}/search?query=${encodeURIComponent(query)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSearchResults(data);
    } catch (e) {
      console.error(e);
      alert("Erro na busca");
    }
  };

  const handleSearchResultSelect = (result) => {
    handleFileClick(result.path);
    setSearchModalOpen(false);
    // Optional: Scroll to line logic could be added here if Editor exposes it
    // For now just opening the file is good
  };

  const handleDownloadProject = () => {
    window.open(`/api/tree/${sessionId}/download`, '_blank');
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);
    // Upload to root for now, or selected folder if we tracked it
    formData.append("path", ""); 

    try {
      const res = await fetch(`/api/tree/${sessionId}/upload`, {
        method: "POST",
        headers: { "Authorization": getAuthHeaders()["Authorization"] }, // No Content-Type, let browser set boundary
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      await loadTree();
      alert("Arquivo enviado com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar arquivo");
    } finally {
      e.target.value = null; // Reset input
    }
  };

  const formatCode = async () => {
    if (!editorRef.current || !activeFile) return;
    const currentCode = editorRef.current.getValue();
    const ext = activeFile.split('.').pop();
    let parser = null;
    let plugins = [];

    switch(ext) {
      case 'js': case 'jsx': case 'ts': case 'tsx':
        parser = 'babel';
        plugins = [parserBabel, parserEstree];
        break;
      case 'html':
        parser = 'html';
        plugins = [parserHtml];
        break;
      case 'css':
        parser = 'css';
        plugins = [parserCss];
        break;
      case 'json':
        parser = 'json';
        plugins = [parserBabel];
        break;
      default:
        alert("Formatação não suportada para este arquivo.");
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
      alert("Erro ao formatar código: " + e.message);
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

  // --- LÓGICA DE REDIMENSIONAMENTO (CORRIGIDA) ---
  const onMouseDown = (divider) => (e) => {
    dragInfo.current = {
      divider,
      startX: e.clientX,
      initialSizes: { ...panelSizes },
    };
    e.preventDefault();
    // visual cursor feedback
    try {
      document.body.style.cursor = "col-resize";
      document.body.classList.add("no-transition");
    } catch (_) {}
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    // fallbacks: if mouse leaves window or window loses focus, abort drag
    window.addEventListener("mouseleave", onMouseUp);
    window.addEventListener("blur", onMouseUp);
  };
  // touch support for horizontal resize
  const onTouchStart = (divider) => (e) => {
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    dragInfo.current = {
      divider,
      startX: touch.clientX,
      initialSizes: { ...panelSizes },
    };
    try {
      document.body.style.cursor = "col-resize";
      document.body.classList.add("no-transition");
    } catch (_) {}
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onMouseUp);
  };

  const onTouchMove = (e) => {
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    // reuse mouse handler logic by mapping clientX
    const fakeEvent = { clientX: touch.clientX };
    onMouseMove(fakeEvent);
  };

  const onMouseMove = (e) => {
    if (!dragInfo.current) return;
    const { divider, startX, initialSizes } = dragInfo.current;
    const deltaX = e.clientX - startX;
    // Ignore very small moves to avoid stuck behaviour
    if (Math.abs(deltaX) < 2) return;
    const totalWidth = window.innerWidth;
    const deltaPercent = (deltaX / totalWidth) * 100;

    // Pixel-based minimums to respect CSS min-widths
    const minLeftPx = 220; // ensure sidebar doesn't collapse
    const minRightPx = 220; // ensure chat doesn't collapse
    const minCenterPx = 300; // keep editor usable

    const minLeft = Math.min(40, (minLeftPx / totalWidth) * 100);
    const minRight = Math.min(40, (minRightPx / totalWidth) * 100);
    const minCenter = Math.min(50, (minCenterPx / totalWidth) * 100);

    const maxLeft = 70;
    const maxRight = 70;

    let newLeft = initialSizes.left;
    let newRight = initialSizes.right;

    if (divider === "left") {
      newLeft = Math.max(
        minLeft,
        Math.min(initialSizes.left + deltaPercent, maxLeft)
      );
    } else {
      newRight = Math.max(
        minRight,
        Math.min(initialSizes.right - deltaPercent, maxRight)
      );
    }

    let newCenter = 100 - newLeft - newRight;

    // if center violated, try to adjust less dominant panel
    if (newCenter < minCenter) {
      const deficit = minCenter - newCenter;
      if (divider === "left") {
        newRight = Math.max(minRight, newRight - deficit);
      } else {
        newLeft = Math.max(minLeft, newLeft - deficit);
      }
      newCenter = 100 - newLeft - newRight;
    }

    // Only persist sizes when constraints satisfied
    if (newCenter >= minCenter) {
      const sizes = { left: newLeft, center: newCenter, right: newRight };
      setPanelSizes(sizes);
      try {
        localStorage.setItem("teamcode-panel-sizes", JSON.stringify(sizes));
      } catch (_) {}
    }
  };

  const onMouseUp = () => {
    dragInfo.current = null;
    try {
      document.body.style.cursor = "";
      document.body.classList.remove("no-transition");
    } catch (_) {}
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mouseleave", onMouseUp);
    window.removeEventListener("blur", onMouseUp);
  };

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
    } catch (_) {}
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
      Math.min(chatDragInfo.current.startHeight + deltaY, maxH)
    );
    setChatHeight(newH);
    try {
      localStorage.setItem("teamcode-chat-height", String(newH));
    } catch (_) {}
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
    } catch (_) {}
    window.removeEventListener("mousemove", onChatMouseMove);
    window.removeEventListener("mouseup", onChatMouseUp);
    window.removeEventListener("mouseleave", onChatMouseUp);
    window.removeEventListener("blur", onChatMouseUp);
  };

  // --- Terminal vertical resize handlers ---
  const onTerminalMouseDown = (e) => {
    terminalDragInfo.current = {
      startY: e.clientY,
      startHeight: terminalHeight,
    };
    e.preventDefault();
    try {
      document.body.style.cursor = "row-resize";
      document.body.classList.add("no-transition");
    } catch (_) {}
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
    
    const newH = Math.max(minH, Math.min(terminalDragInfo.current.startHeight + deltaY, maxH));
    setTerminalHeight(newH);
    try {
      localStorage.setItem("teamcode-terminal-height", String(newH));
    } catch (_) {}
  };

  const onTerminalMouseUp = () => {
    terminalDragInfo.current = null;
    try {
      document.body.style.cursor = "";
      document.body.classList.remove("no-transition");
    } catch (_) {}
    window.removeEventListener("mousemove", onTerminalMouseMove);
    window.removeEventListener("mouseup", onTerminalMouseUp);
    window.removeEventListener("mouseleave", onTerminalMouseUp);
    window.removeEventListener("blur", onTerminalMouseUp);
    // Trigger fit after resize ends
    try { terminalApiRef.current?.fit(); } catch (_) {}
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
        alert("Falha ao duplicar a pasta.");
      }
    },
    [sessionId, loadTree]
  );

  useEffect(() => {
    (async () => {
      try {
        await loadTree();
        setStatus("Carregando editor...");
      } catch (err) {
        console.error("Erro inicial", err);
        setStatus("Erro ao carregar sessão.");
      }
    })();
    return () => {
      try {
        stompClientRef.current?.deactivate();
      } catch (_) {}
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
        items.length === 1 ? items[0] : undefined
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
        alert("Falha ao renomear");
      } else {
        await loadTree();
        const parent = path.includes("/")
          ? path.substring(0, path.lastIndexOf("/"))
          : "";
        const newPath = parent ? `${parent}/${newName}` : newName;
        setOpenFiles((prev) => prev.map((f) => (f === path ? newPath : f)));
        if (activeFile === path) setActiveFile(newPath);
        publishTreeEvent("RENAMED", path, newPath);
      }
    } catch (e) {
      alert("Erro de rede ao renomear");
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
    } catch (_) {}
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
    const content = fileNode ? (fileNode.content ?? "") : (files.find(f => f.name === activeFile)?.content ?? "");

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
    if (!activeFile || editorContent === null) return;
    (async () => {
      try {
        const res = await fetch(`/api/tree/${sessionId}/content`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ path: activeFile, content: editorContent }),
        });
        if (!res.ok) console.error(`Falha ao salvar arquivo: ${res.status}`);
      } catch (err) {
        console.error("Erro de rede ao salvar", err);
      }
    })();
  }, [debouncedEditorContent]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Force initial content load if activeFile is set
    if (activeFile) {
        const fileNode = findNodeInTree(treeRoot, activeFile);
        const content = fileNode ? (fileNode.content ?? "") : (files.find(f => f.name === activeFile)?.content ?? "");
        if (content) {
            editor.setValue(content);
            setEditorContent(content);
        }
    }

    setStatus("Conectando...");
    connectToWebSocket();
  };

  const handleEditorChange = (value) => {
    setEditorContent(value ?? "");
  };

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
    } catch (e) {}
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
      setParticipants(JSON.parse(message.body).participants);
    } catch (e) {}
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
                prev.map((f) => (f === evt.path ? evt.newPath : f))
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
          } catch (_) {}
        })();
        client.subscribe(`/topic/terminal/${sessionId}`, (message) => {
          let content = message.body;
          try {
            const json = JSON.parse(message.body);
            // Verifica se é um objeto JSON do nosso protocolo (com campo 'output')
            // Isso evita que números soltos (ex: "10") sejam parseados como números e ignorados
            if (json && typeof json === 'object' && 'output' in json) {
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
            userId: `user-${Math.random().toString(36).substr(2, 9)}`,
            username: localStorage.getItem("username") || "User",
            type: "JOIN",
          }),
        });
        try {
          client.publish({ destination: `/app/terminal.start/${sessionId}` });
        } catch (_) {}
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
    } catch (_) {}
  };

  const handleRunFile = (filePath) => {
    if (!filePath || isRunning) return;
    
    setIsRunning(true);
    // Reset running state after a timeout (since we don't get a "finished" event from terminal easily yet)
    setTimeout(() => setIsRunning(false), 3000);

    // Use current editor content (most up-to-date) instead of tree
    // This ensures we run the latest code, even if debounce hasn't saved yet
    const content = editorContent || '';
    
    // Determine command based on file extension
    const ext = filePath.split('.').pop().toLowerCase();
    const fileName = filePath.split('/').pop(); // Get just the filename
    let command = '';
    
    switch(ext) {
      case 'js':
        command = `node ${fileName}`;
        break;
      case 'py':
        // Usa o módulo pty do Python para criar um terminal real.
        // Isso garante que input() funcione e que o texto digitado apareça (echo).
        command = `python3 -c "import pty; pty.spawn(['python3', '-u', '${fileName}'])"`;
        break;
      case 'java':
        // Extract class name from filename
        const className = fileName.replace(/\.java$/, '');
        command = `javac ${fileName} && java ${className}`;
        break;
      case 'c':
        const cOut = fileName.replace(/\.c$/, '') + '.out';
        command = `gcc ${fileName} -o ${cOut} && ./${cOut}`;
        break;
      case 'cpp':
      case 'cc':
        const cppOut = fileName.replace(/\.(cpp|cc)$/, '') + '.out';
        command = `g++ ${fileName} -o ${cppOut} && ./${cppOut}`;
        break;
      case 'rb':
        command = `ruby ${fileName}`;
        break;
      case 'go':
        command = `go run ${fileName}`;
        break;
      case 'rs':
        command = `rustc ${fileName} && ./${fileName.replace(/\.rs$/, '')}`;
        break;
      case 'sh':
        command = `bash ${fileName}`;
        break;
      case 'ts':
        command = `ts-node ${fileName}`;
        break;
      default:
        alert(`Unsupported file type: .${ext}`);
        return;
    }

    // Send file content and command via WebSocket to sync-service
    try {
      const client = stompClientRef.current;
      if (!client?.connected) {
        alert('WebSocket not connected. Please refresh the page.');
        return;
      }
      client.publish({
        destination: `/app/execute/${sessionId}`,
        body: JSON.stringify({ 
          command,
          fileName,
          content
        }),
      });
      // Optional: minimize terminal or focus it
      if (terminalMinimized) setTerminalMinimized(false);
    } catch (e) {
      console.error('Failed to send run command', e);
      alert('Failed to execute file.');
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
        if (!response.ok)
          alert(
            `Erro ao criar pasta: ${await response.text().catch(() => "")}`
          );
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
        if (!response.ok)
          alert(
            `Erro ao criar arquivo: ${await response.text().catch(() => "")}`
          );
        await loadTree();
        handleFileClick(fileInfo.name);
        publishTreeEvent("CREATED", payload.path);
      }
    } catch (err) {
      alert(
        "Não foi possível conectar ao serviço de sessão para criar o arquivo/pasta."
      );
    }
    setCreateFileModalOpen(false);
  };

  useEffect(() => {
    if (!terminalMinimized) {
      try {
        terminalApiRef.current?.fit();
      } catch (_) {}
    }
  }, [terminalMinimized]);

  return (
    <>
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
      />
      <div className="h-screen flex flex-col font-sans overflow-hidden transition-colors duration-500 editor-page-layout">
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
            <ThemeSwitcher />
            <div className="text-right">
              <h3 className="font-bold">
                Participantes ({participants.length})
              </h3>
              <div
                className="text-xs"
                style={{ color: "var(--text-muted-color)" }}
              >
                {participants.join(", ")}
              </div>
            </div>
            <div
              className="text-sm font-bold px-3 py-1 border-2"
              style={{
                backgroundColor: "var(--input-bg-color)",
                borderColor: "var(--panel-border-color)",
              }}
            >
              Status: {status}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAIModalOpen(true)}
                className="px-3 py-1 border-2 font-medium flex items-center space-x-1"
                style={{
                  backgroundColor: "var(--primary-color)",
                  color: "#fff",
                  borderColor: "var(--panel-border-color)",
                }}
              >
                <span className="codicon codicon-robot"></span>
                <span>AI Assistant</span>
              </button>
              <button
                onClick={() => {
                  setPanelSizes(DEFAULT_PANEL_SIZES);
                  setTerminalHeight(240);
                  setChatHeight(220);
                  try {
                    localStorage.setItem(
                      "teamcode-panel-sizes",
                      JSON.stringify(DEFAULT_PANEL_SIZES)
                    );
                    localStorage.setItem("teamcode-terminal-height", "240");
                    localStorage.setItem("teamcode-chat-height", "220");
                  } catch (_) {}
                }}
                title="Restaurar layout"
                className="px-3 py-1 border-2 font-medium"
                style={{
                  backgroundColor: "var(--button-bg-color)",
                  color: "var(--button-text-color)",
                  borderColor: "var(--panel-border-color)",
                }}
              >
                Restaurar layout
              </button>
              <div
                className="inline-flex items-center border-2 rounded"
                style={{ borderColor: "var(--panel-border-color)" }}
              >
                <button
                  title="Minimizar/Restaurar terminal"
                  onClick={() => {
                    setTerminalMinimized((s) => {
                      const v = !s;
                      try {
                        localStorage.setItem(
                          "teamcode-terminal-minimized",
                          v ? "1" : "0"
                        );
                      } catch (_) {}
                      return v;
                    });
                  }}
                  className="px-3 py-1 font-medium"
                  style={{
                    backgroundColor: "var(--button-bg-color)",
                    color: "var(--button-text-color)",
                  }}
                >
                  Terminal
                </button>
                <button
                  title="Limpar terminal"
                  onClick={() => {
                    try {
                      terminalApiRef.current?.clear();
                    } catch (_) {}
                  }}
                  className="px-3 py-1"
                >
                  Limpar
                </button>
                <button
                  title="Ajustar terminal"
                  onClick={() => {
                    try {
                      terminalApiRef.current?.fit();
                    } catch (_) {}
                  }}
                  className="px-3 py-1"
                >
                  Ajustar
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-grow overflow-hidden">
          <aside
            className="h-full flex flex-col border-r-2 editor-page-panel"
            style={{
              flexBasis: `${panelSizes.left}%`,
              backgroundColor: "var(--panel-bg-color)",
              borderColor: "var(--panel-border-color)",
            }}
          >
            <div
              className="p-3 border-b-2 flex flex-col gap-2"
              style={{ borderColor: "var(--panel-border-color)" }}
            >
              <div className="flex justify-between items-center">
                <h2
                  className="font-bold text-lg"
                  style={{ color: "var(--primary-color)" }}
                >
                  Arquivos
                </h2>
                <div className="flex space-x-1">
                   <button
                    onClick={() => setSearchModalOpen(true)}
                    title="Buscar em arquivos"
                    className="w-8 h-8 flex items-center justify-center font-bold border-2 neo-shadow-button"
                    style={{
                      backgroundColor: "var(--input-bg-color)",
                      color: "var(--text-color)",
                      borderColor: "var(--panel-border-color)",
                    }}
                  >
                    <span className="codicon codicon-search"></span>
                  </button>
                  <button
                    onClick={() => setCreateFileModalOpen(true)}
                    title="Novo Arquivo"
                    className="w-8 h-8 font-bold text-xl border-2 neo-shadow-button"
                    style={{
                      backgroundColor: "var(--button-bg-color)",
                      color: "var(--button-text-color)",
                      borderColor: "var(--panel-border-color)",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex space-x-2">
                 <button
                    onClick={handleDownloadProject}
                    title="Baixar Projeto (Zip)"
                    className="flex-1 py-1 text-xs font-bold border-2 neo-shadow-button flex items-center justify-center gap-1"
                    style={{
                      backgroundColor: "var(--input-bg-color)",
                      borderColor: "var(--panel-border-color)",
                    }}
                  >
                    <span className="codicon codicon-cloud-download"></span> Baixar
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload Arquivo"
                    className="flex-1 py-1 text-xs font-bold border-2 neo-shadow-button flex items-center justify-center gap-1"
                    style={{
                      backgroundColor: "var(--input-bg-color)",
                      borderColor: "var(--panel-border-color)",
                    }}
                  >
                    <span className="codicon codicon-cloud-upload"></span> Upload
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleUploadFile} 
                  />
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
                    // Direct creation path provided (e.g., duplicate file)
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
              />
            </div>
            <ConfirmDialog
              open={confirmState.open}
              title={
                confirmState.isFolder ? "Excluir pasta" : "Excluir arquivo"
              }
              message={`Tem certeza que deseja excluir ${
                confirmState.isFolder ? "a pasta" : "o arquivo"
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

          <ResizeHandle onMouseDown={onMouseDown("left")} />

          <div
            className="h-full flex-grow flex flex-col"
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
            <main className="flex-grow relative min-h-0 overflow-hidden">
              {openFiles.length > 0 ? (
                <Editor
                  key={theme}
                  height="100%"
                  theme={theme.endsWith("light") ? "light" : "vs-dark"}
                  path={activeFile}
                  language={getLanguageFromExtension(activeFile)}
                  onMount={handleEditorDidMount}
                  onChange={handleEditorChange}
                  options={{
                    automaticLayout: true,
                    minimap: { enabled: true },
                  }}
                />
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
              className={`flex-shrink-0 border-t-2 terminal-footer ${
                terminalMinimized ? "minimized" : ""
              }`}
              style={{
                backgroundColor: "var(--terminal-bg-color)",
                borderColor: "var(--panel-border-color)",
                height: terminalMinimized ? '36px' : `${terminalHeight}px`,
                maxHeight: 'none' // Override CSS max-height
              }}
            >
              {!terminalMinimized ? (
                <TerminalComponent
                  sessionId={sessionId}
                  stompClient={stompClientRef.current}
                  registerApi={(api) => {
                    terminalApiRef.current = api;
                  }}
                />
              ) : (
                <div
                  className="p-2 text-sm"
                  style={{ color: "var(--text-muted-color)" }}
                >
                  Terminal minimizado - clique no botão "Restaurar terminal"
                  para abrir.
                </div>
              )}
            </footer>
          </div>

          <ResizeHandle onMouseDown={onMouseDown("right")} />

          <aside
            ref={rightAsideRef}
            className="h-full flex flex-col border-l-2 editor-page-panel chat-panel"
            style={{
              flexBasis: `${panelSizes.right}%`,
              backgroundColor: "var(--panel-bg-color)",
              borderColor: "var(--panel-border-color)",
            }}
          >
            <div
              className="p-3 border-b-2"
              style={{ borderColor: "var(--panel-border-color)" }}
            >
              <h2
                className="font-bold text-lg"
                style={{ color: "var(--primary-color)" }}
              >
                Chat da Sessão
              </h2>
            </div>
            <div
              ref={messagesRef}
              className="p-3 overflow-y-auto space-y-4 chat-container"
              style={{ height: `${chatHeight}px` }}
            >
              {(messages || []).map((msg, idx) => (
                <div key={idx} className="flex flex-col">
                  <div className="flex items-baseline space-x-2">
                    <span
                      className="font-bold"
                      style={{ color: "var(--primary-color)" }}
                    >
                      {msg.username}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted-color)" }}
                    >
                      {msg.timestamp}
                    </span>
                  </div>
                  <p
                    className="border-2 p-2 mt-1"
                    style={{
                      backgroundColor: "var(--input-bg-color)",
                      borderColor: "var(--panel-border-color)",
                    }}
                  >
                    {msg.content}
                  </p>
                </div>
              ))}
              <div ref={chatMessagesEndRef} />
            </div>
            <div
              className="chat-resize-handle"
              onMouseDown={onChatMouseDown}
              title="Ajustar altura do chat"
            />
            <div
              className="p-3 border-t-2 chat-input"
              style={{ borderColor: "var(--panel-border-color)" }}
            >
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  (e.preventDefault(), handleSendChatMessage())
                }
                placeholder="Digite uma mensagem..."
                className="w-full p-2 border-2 resize-none focus:outline-none"
                style={{
                  backgroundColor: "var(--input-bg-color)",
                  borderColor: "var(--panel-border-color)",
                  "--tw-ring-color": "var(--primary-color)",
                  color: "var(--text-color)",
                }}
                rows="3"
              />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

// --- App Principal ---
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("jwtToken")
  );
  const sessionId = new URLSearchParams(window.location.search).get(
    "sessionId"
  );

  return (
    <ThemeProvider>
      {!isAuthenticated ? (
        <AuthPage onLoginSuccess={() => setIsAuthenticated(true)} />
      ) : sessionId ? (
        <EditorPage sessionId={sessionId} />
      ) : (
        <HomePage />
      )}
    </ThemeProvider>
  );
}
