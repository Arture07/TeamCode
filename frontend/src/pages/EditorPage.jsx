import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import Editor, { useMonaco, DiffEditor } from "@monaco-editor/react";
import RecursiveTree from "../components/RecursiveTree";
import ConfirmDialog from "../components/ConfirmDialog";
import RenameModal from "../components/RenameModal";
import AIAssistantModal from "../components/AIAssistantModal";
import { useToast } from "../components/Toast";
import { getCursorColor } from "../utils/cursorColors";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import prettier from "prettier/standalone";
import parserBabel from "prettier/plugins/babel";
import parserHtml from "prettier/plugins/html";
import parserCss from "prettier/plugins/postcss";
import parserEstree from "prettier/plugins/estree";
import ReactMarkdown from "react-markdown";
import { usePanelResize } from "../hooks/usePanelResize";
import { useSyntaxValidator } from "../hooks/useSyntaxValidator";
import { useYjsCollaboration } from "../hooks/useYjsCollaboration";
import useDebounce from "../hooks/useDebounce";
import GitPanel from "../components/GitPanel";
import { useTheme } from "../contexts/ThemeContext";
import { getLanguageFromExtension } from "../utils/languages";
import { getAuthHeaders } from "../utils/auth";
import TimeMachineModal from "../components/TimeMachineModal";
const Whiteboard = React.lazy(() => import("../components/Whiteboard"));
import { monacoThemes } from "../utils/editorThemes";
import { registerAiAutocomplete } from "../utils/aiAutocompleteProvider";
import SimpleBrowser from "../components/SimpleBrowser";
import EnhancedCreateFileModal from "../components/CreateFileModal";

// Extracted UI Components
import FileTabs from "../components/FileTabs";
import ResizeHandle from "../components/ResizeHandle";
import SearchModal from "../components/SearchModal";
import CommandPalette from "../components/CommandPalette";
import StatusBar from "../components/StatusBar";
import EditorHeader from "../components/EditorHeader";
import ActivityBar from "../components/ActivityBar";
import TerminalPanel from "../components/TerminalPanel";
import ChatPanel from "../components/ChatPanel";
import ThemeSwitcher from "../components/ThemeSwitcher";
import DebugToolbar from "../components/DebugToolbar";
import DebugPanel from "../components/DebugPanel";

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

export default function EditorPage({ sessionId }) {
  const toast = useToast();
  const [status, setStatus] = useState("Carregando...");
  const [participants, setParticipants] = useState([]);
  const prevParticipantsRef = useRef([]);
  const isInitialParticipantLoadRef = useRef(true);
  const [sessionOwner, setSessionOwner] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [files, setFiles] = useState([]);
  const [treeRoot, setTreeRoot] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [selectedParentForCreate, setSelectedParentForCreate] = useState("");
  const [globalCreateType, setGlobalCreateType] = useState(null);
  const [isCreateFileModalOpen, setCreateFileModalOpen] = useState(false);
  const [editorContent, setEditorContent] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [cursorPos, setCursorPos] = useState(null);
  const [copiedSessionId, setCopiedSessionId] = useState(false);
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [showTimeMachine, setShowTimeMachine] = useState(false);
  const [spotlightHost, setSpotlightHost] = useState(null);
  const [activeView, setActiveView] = useState('code');
  const [activeDiff, setActiveDiff] = useState(null);
  const [gitRefreshCounter, setGitRefreshCounter] = useState(0);
  const [lineReactions, setLineReactions] = useState({});
  const lineReactionsRef = useRef({});
  useEffect(() => { lineReactionsRef.current = lineReactions; }, [lineReactions]);
  const chatTextareaRef = useRef(null);

  // Inactivity & Presence Management
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivityCountdown, setInactivityCountdown] = useState(180);
  const [isInactiveDisconnected, setIsInactiveDisconnected] = useState(false);
  const lastInteractionRef = useRef(Date.now());

  const reportActivity = useCallback(() => {
    lastInteractionRef.current = Date.now();
    if (showInactivityWarning) {
      setShowInactivityWarning(false);
    }
  }, [showInactivityWarning]);

  const handleOpenTerminalAtFolder = (folderPath) => {
    const client = stompClientRef.current;
    if (!client?.connected) {
      toast.warning("Terminal desconectado");
      return;
    }
    const cleanPath = (folderPath || "").replace(/\\/g, "/");
    client.publish({
      destination: `/app/terminal.in/${sessionId}`,
      body: JSON.stringify({ input: `cd "${cleanPath}"\r` })
    });
    if (terminalMinimized) setTerminalMinimized(false);
    toast.success(`Navegando terminal para: ${cleanPath.split('/').pop() || '/'}`);
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

  const {
    panelSizes,
    setPanelSizes,
    onMouseDown,
    reset: resetPanelSizes,
  } = usePanelResize('teamcode-panel-sizes');

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const stompClientRef = useRef(null);
  const chatMessagesEndRef = useRef(null);
  const rightAsideRef = useRef(null);
  const messagesRef = useRef(null);
  const fileBuffersRef = useRef({});
  const saveTimersRef = useRef({});
  const isSwitchingFileRef = useRef(false);
  const terminalApiRef = useRef(null);
  const terminalBufferRef = useRef([]);
  const { theme, fontSize } = useTheme();
  const monaco = useMonaco();

  useEffect(() => {
    if (monaco) {
      Object.entries(monacoThemes).forEach(([id, themeData]) => {
        const safeId = id.replace(/_/g, '-');
        monaco.editor.defineTheme(safeId, themeData);
      });
      const autocompleteDisposable = registerAiAutocomplete(monaco);
      return () => {
        autocompleteDisposable.dispose();
      };
    }
  }, [monaco]);

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

  const [isMobileOrTablet, setIsMobileOrTablet] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  const [isMobileOnly, setIsMobileOnly] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      const w = window.innerWidth;
      setIsMobileOrTablet(w < 1024);
      setIsMobileOnly(w < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [isSearchModalOpen, setSearchModalOpen] = useState(false);
  const [isAIModalOpen, setAIModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const fileInputRef = useRef(null);
  const [previewFile, setPreviewFile] = useState("index.html");
  const [previewRefreshTrigger, setPreviewRefreshTrigger] = useState(0);
  const [showChat, setShowChat] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [showSidebar, setShowSidebar] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [activeSidebarTab, setActiveSidebarTab] = useState('EXPLORER');
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [yjsEnabled, setYjsEnabled] = useState(() => {
    try { return localStorage.getItem('teamcode-yjs-enabled') === '1'; } catch (_) { return false; }
  });

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

  const myUserIdRef = useRef(`user-${Math.random().toString(36).substr(2, 9)}`);
  const [cursors, setCursors] = useState({});
  const decorationsRef = useRef([]);
  const isRemoteUpdate = useRef(false);
  const activeFileRef = useRef(activeFile);

  const editingUsers = useMemo(() => {
    const map = {};
    Object.values(cursors).forEach(c => {
      if (!c.filePath) return;
      if (!map[c.filePath]) map[c.filePath] = [];
      map[c.filePath].push({
        userId: c.userId,
        username: c.username,
        color: getCursorColor(c.userId),
      });
    });
    return map;
  }, [cursors]);

  useEffect(() => {
    if (activeFile && activeFile.toLowerCase().endsWith(".html")) {
      setPreviewFile(activeFile);
    }
  }, [activeFile]);

  const { isYjsActive } = useYjsCollaboration({
    activeFile,
    sessionId,
    userId: myUserIdRef.current,
    editorRef,
    stompClientRef,
    enabled: yjsEnabled,
  });

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
        headers: { Authorization: getAuthHeaders()["Authorization"] },
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

  const handleSidebarDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  };

  const handleSidebarDragLeave = (e) => {
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
  };

  const onChatMouseMove = (e) => {
    if (!chatDragInfo.current) return;
    const deltaY = chatDragInfo.current.startY - e.clientY;
    if (Math.abs(deltaY) < 2) return;
    const maxH = chatDragInfo.current.containerHeight - 60;
    const newH = Math.max(
      80,
      Math.min(chatDragInfo.current.startHeight + deltaY, maxH),
    );
    setChatHeight(newH);
    try {
      localStorage.setItem("teamcode-chat-height", String(newH));
    } catch (_) { }
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

  const [showPreview, setShowPreview] = useState(false);

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
    const deltaY = terminalDragInfo.current.startY - e.clientY;
    if (Math.abs(deltaY) < 2) return;

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
    try {
      terminalApiRef.current?.fit();
    } catch (_) { }
  };

  const populateBuffers = useCallback((node, prefix = "") => {
    if (!node) return;
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === "file" && node.content !== undefined && node.content !== null) {
      if (!saveTimersRef.current[path]) {
        fileBuffersRef.current[path] = node.content;
      }
    }
    if (node.type === "folder" && Array.isArray(node.children)) {
      node.children.forEach((c) => populateBuffers(c, path));
    }
  }, []);

  const saveFileToBackend = useCallback(async (path, content) => {
    if (!path || content === undefined || content === null) return;
    try {
      const res = await fetch(`/api/tree/${sessionId}/content`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ path, content }),
      });
      if (!res.ok) console.error(`Falha ao salvar arquivo ${path}: ${res.status}`);

      if (stompClientRef.current?.connected) {
        stompClientRef.current.publish({
          destination: `/app/save/${sessionId}`,
          body: JSON.stringify({ fileName: path, content }),
        });

        if (path === previewFile) {
          setTimeout(() => {
            setPreviewRefreshTrigger((prev) => prev + 1);
            const frame = document.getElementById("preview-frame");
            if (frame) {
              const src = frame.src.split("?")[0];
              frame.src = `${src}?t=${Date.now()}`;
            }
          }, 800);
        }
      }

      // Notifica o GitPanel para atualizar o status automaticamente
      setGitRefreshCounter((prev) => prev + 1);
    } catch (err) {
      console.error("Erro de rede ao salvar", err);
    }
  }, [sessionId, previewFile]);

  const handleOpenDiff = useCallback(async ({ path, isStaged }) => {
    if (!path) return;
    try {
      const headRes = await fetch(`/api/git/${sessionId}/show?file=${encodeURIComponent(path)}&ref=HEAD`, {
        headers: getAuthHeaders()
      });
      const headData = await headRes.json();
      const originalContent = (headData && headData.content !== undefined) ? headData.content : "";

      let modifiedContent = fileBuffersRef.current[path];
      if (modifiedContent === undefined) {
        const node = findNodeInTree(treeRoot, path);
        modifiedContent = node?.content ?? "";
      }

      setActiveDiff({
        path,
        isStaged: !!isStaged,
        originalContent,
        modifiedContent
      });
    } catch (e) {
      console.error("Erro ao abrir diff no editor:", e);
      toast.error("Erro ao carregar comparação de alterações.");
    }
  }, [sessionId, treeRoot, toast]);

  const handleOpenCommitDiff = useCallback(async ({ path, hash, parentHash, shortHash, shortParentHash, message }) => {
    if (!path || !hash) return;
    try {
      const headRes = await fetch(`/api/git/${sessionId}/show?file=${encodeURIComponent(path)}&ref=${encodeURIComponent(hash)}`, {
        headers: getAuthHeaders()
      });
      const headData = await headRes.json();
      const modifiedContent = (headData && headData.content !== undefined) ? headData.content : "";

      let originalContent = "";
      if (parentHash) {
        const parentRes = await fetch(`/api/git/${sessionId}/show?file=${encodeURIComponent(path)}&ref=${encodeURIComponent(parentHash)}`, {
          headers: getAuthHeaders()
        });
        const parentData = await parentRes.json();
        originalContent = (parentData && parentData.content !== undefined) ? parentData.content : "";
      }

      setActiveDiff({
        path,
        isCommitDiff: true,
        hash,
        parentHash,
        shortHash: shortHash || hash.substring(0, 7),
        shortParentHash: shortParentHash || (parentHash ? parentHash.substring(0, 7) : "init"),
        commitMessage: message || "",
        originalContent,
        modifiedContent
      });
    } catch (e) {
      console.error("Erro ao abrir diff do commit:", e);
      toast.error("Erro ao carregar comparação do commit.");
    }
  }, [sessionId, toast]);

  const handleStageFromDiff = async (path) => {
    try {
      await fetch(`/api/git/${sessionId}/add`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ files: [path] }),
      });
      setGitRefreshCounter((prev) => prev + 1);
      if (activeDiff && activeDiff.path === path) {
        setActiveDiff((prev) => ({ ...prev, isStaged: true }));
      }
      toast.success(`"${path.split('/').pop()}" adicionado ao stage`);
    } catch (e) {
      toast.error("Erro ao preparar arquivo");
    }
  };

  const handleUnstageFromDiff = async (path) => {
    try {
      await fetch(`/api/git/${sessionId}/unstage`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ files: [path] }),
      });
      setGitRefreshCounter((prev) => prev + 1);
      if (activeDiff && activeDiff.path === path) {
        setActiveDiff((prev) => ({ ...prev, isStaged: false }));
      }
      toast.success(`"${path.split('/').pop()}" removido do stage`);
    } catch (e) {
      toast.error("Erro ao desmarcar arquivo");
    }
  };

  const switchActiveFile = useCallback((newPath) => {
    const oldPath = activeFileRef.current;
    if (newPath === oldPath) return;

    if (oldPath && saveTimersRef.current[oldPath]) {
      clearTimeout(saveTimersRef.current[oldPath]);
      delete saveTimersRef.current[oldPath];
      const pendingContent = fileBuffersRef.current[oldPath];
      if (pendingContent !== undefined) {
        saveFileToBackend(oldPath, pendingContent);
      }
    }

    isSwitchingFileRef.current = true;
    setActiveFile(newPath);
    activeFileRef.current = newPath;

    if (!newPath) {
      if (editorRef.current) editorRef.current.setValue("");
      setEditorContent("");
      isSwitchingFileRef.current = false;
      return;
    }

    let targetContent = fileBuffersRef.current[newPath];
    if (targetContent === undefined) {
      const node = findNodeInTree(treeRoot, newPath);
      targetContent = node?.content ?? "";
      fileBuffersRef.current[newPath] = targetContent;
    }

    setEditorContent(targetContent);

    setTimeout(() => {
      isSwitchingFileRef.current = false;
    }, 50);
  }, [treeRoot, saveFileToBackend]);

  const handleFileClick = (fileName) => {
    if (!openFiles.includes(fileName)) {
      setOpenFiles((prev) => [...prev, fileName]);
    }
    switchActiveFile(fileName);
  };

  const handleTabClose = (fileToClose) => {
    const index = openFiles.indexOf(fileToClose);
    const newOpenFiles = openFiles.filter((f) => f !== fileToClose);
    setOpenFiles(newOpenFiles);

    if (activeFileRef.current === fileToClose) {
      if (newOpenFiles.length === 0) {
        switchActiveFile(null);
      } else {
        const newIndex = Math.max(0, index - 1);
        switchActiveFile(newOpenFiles[newIndex]);
      }
    }
  };

  // --- Debugger & Breakpoints Suite ---
  const [breakpoints, setBreakpoints] = useState({}); // { [filePath]: [line1, line2, ...] }
  const [isDebugging, setIsDebugging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [debugLine, setDebugLine] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [debugScope, setDebugScope] = useState({});
  const [callStack, setCallStack] = useState([]);
  const [watchExpressions, setWatchExpressions] = useState([
    { expr: "window.location.origin", value: typeof window !== "undefined" ? window.location.origin : "" },
  ]);
  const breakpointDecorationsRef = useRef([]);
  const debugLineDecorationRef = useRef([]);

  const toggleBreakpoint = useCallback((filePath, lineNumber) => {
    if (!filePath || !lineNumber) return;
    setBreakpoints((prev) => {
      const currentLines = prev[filePath] || [];
      const exists = currentLines.includes(lineNumber);
      const updated = exists
        ? currentLines.filter((l) => l !== lineNumber)
        : [...currentLines, lineNumber].sort((a, b) => a - b);
      return { ...prev, [filePath]: updated };
    });
  }, []);

  const removeBreakpoint = useCallback((filePath, lineNumber) => {
    setBreakpoints((prev) => ({
      ...prev,
      [filePath]: (prev[filePath] || []).filter((l) => l !== lineNumber),
    }));
  }, []);

  const clearAllBreakpoints = useCallback(() => {
    setBreakpoints({});
  }, []);

  const handleStartDebug = useCallback(() => {
    const currentFile = activeFileRef.current;
    if (!currentFile) {
      toast.warning("Abra um arquivo para iniciar a depuração");
      return;
    }
    setIsDebugging(true);
    setTerminalMinimized(false);
    setActiveTerminalTab("DEBUG_CONSOLE");

    const timestamp = new Date().toLocaleTimeString();
    const fileBps = breakpoints[currentFile] || [];

    setDebugLogs((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: `Sessão de depuração iniciada para "${currentFile}"`,
        type: "info",
        timestamp,
        source: currentFile,
      },
    ]);

    const sampleScope = {
      this: "GlobalContext",
      activeFile: currentFile,
      timestamp: Date.now(),
      origin: typeof window !== "undefined" ? window.location.origin : "",
    };

    if (fileBps.length > 0) {
      const firstBp = fileBps[0];
      setIsPaused(true);
      setDebugLine(firstBp);
      setDebugScope(sampleScope);
      setCallStack([
        { funcName: "main()", fileName: currentFile.split("/").pop(), filePath: currentFile, line: firstBp },
      ]);
      setDebugLogs((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: `Pausado no breakpoint: ${currentFile}:${firstBp}`,
          type: "warn",
          timestamp: new Date().toLocaleTimeString(),
          source: `${currentFile}:${firstBp}`,
        },
      ]);
      if (editorRef.current) {
        editorRef.current.revealLineInCenter(firstBp);
        editorRef.current.setPosition({ lineNumber: firstBp, column: 1 });
      }
    } else {
      setIsPaused(false);
      setDebugLine(null);
      setDebugScope(sampleScope);
      setDebugLogs((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: `Executando continuamente (nenhum breakpoint definido)...`,
          type: "info",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  }, [breakpoints, toast, setTerminalMinimized, setActiveTerminalTab]);

  const handlePauseDebug = useCallback(() => {
    if (!isDebugging) return;
    setIsPaused(true);
    const line = debugLine || editorRef.current?.getPosition()?.lineNumber || 1;
    setDebugLine(line);
    setDebugLogs((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: `Execução pausada na linha ${line}`,
        type: "warn",
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, [isDebugging, debugLine]);

  const handleContinueDebug = useCallback(() => {
    if (!isDebugging) return;
    const currentFile = activeFileRef.current;
    const fileBps = (breakpoints[currentFile] || []).filter((l) => l > (debugLine || 0));
    if (fileBps.length > 0) {
      const nextBp = fileBps[0];
      setDebugLine(nextBp);
      setIsPaused(true);
      setDebugLogs((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: `Pausado no próximo breakpoint: ${currentFile}:${nextBp}`,
          type: "warn",
          timestamp: new Date().toLocaleTimeString(),
          source: `${currentFile}:${nextBp}`,
        },
      ]);
      if (editorRef.current) {
        editorRef.current.revealLineInCenter(nextBp);
        editorRef.current.setPosition({ lineNumber: nextBp, column: 1 });
      }
    } else {
      setIsPaused(false);
      setDebugLine(null);
      setDebugLogs((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: `Execução continuada até o final do script. Código de saída: 0`,
          type: "info",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setTimeout(() => {
        setIsDebugging(false);
      }, 1200);
    }
  }, [isDebugging, breakpoints, debugLine]);

  const handleStepOverDebug = useCallback(() => {
    if (!isDebugging || !isPaused) return;
    const nextLine = (debugLine || 1) + 1;
    setDebugLine(nextLine);
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(nextLine);
      editorRef.current.setPosition({ lineNumber: nextLine, column: 1 });
    }
  }, [isDebugging, isPaused, debugLine]);

  const handleStepIntoDebug = useCallback(() => {
    if (!isDebugging || !isPaused) return;
    const nextLine = (debugLine || 1) + 1;
    setDebugLine(nextLine);
    const currentFile = activeFileRef.current;
    setCallStack((prev) => [
      { funcName: `innerScope_${nextLine}()`, fileName: currentFile?.split("/").pop() || "script.js", filePath: currentFile, line: nextLine },
      ...prev,
    ]);
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(nextLine);
      editorRef.current.setPosition({ lineNumber: nextLine, column: 1 });
    }
  }, [isDebugging, isPaused, debugLine]);

  const handleStepOutDebug = useCallback(() => {
    if (!isDebugging || !isPaused) return;
    setCallStack((prev) => prev.slice(1));
    const nextLine = (debugLine || 1) + 1;
    setDebugLine(nextLine);
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(nextLine);
      editorRef.current.setPosition({ lineNumber: nextLine, column: 1 });
    }
  }, [isDebugging, isPaused, debugLine]);

  const handleRestartDebug = useCallback(() => {
    handleStartDebug();
  }, [handleStartDebug]);

  const handleStopDebug = useCallback(() => {
    setIsDebugging(false);
    setIsPaused(false);
    setDebugLine(null);
    setDebugLogs((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: `⏹ Sessão de depuração finalizada.`,
        type: "info",
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  const handleClearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  const handleEvaluateDebug = useCallback((expression) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs((prev) => [
      ...prev,
      {
        id: Date.now(),
        text: expression,
        type: "input",
        timestamp,
      },
    ]);

    try {
      // eslint-disable-next-line no-new-func
      const evaluator = new Function(
        "scope",
        `with (scope || {}) { return (${expression}); }`
      );
      const result = evaluator(debugScope);
      setDebugLogs((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          value: result,
          type: "result",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err) {
      setDebugLogs((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: `Erro de Avaliação: ${err.message}`,
          type: "error",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }
  }, [debugScope]);

  const handleAddWatch = useCallback((expr) => {
    try {
      // eslint-disable-next-line no-new-func
      const evaluator = new Function("scope", `with (scope || {}) { return (${expr}); }`);
      const val = evaluator(debugScope);
      setWatchExpressions((prev) => [...prev.filter((w) => w.expr !== expr), { expr, value: val }]);
    } catch (err) {
      setWatchExpressions((prev) => [...prev.filter((w) => w.expr !== expr), { expr, value: `<${err.message}>` }]);
    }
  }, [debugScope]);

  const handleRemoveWatch = useCallback((expr) => {
    setWatchExpressions((prev) => prev.filter((w) => w.expr !== expr));
  }, []);

  // Update Monaco decorations for Breakpoints & Paused line
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !activeFile) return;

    const fileBps = breakpoints[activeFile] || [];
    const newBpDecorations = fileBps.map((line) => ({
      range: new monacoRef.current.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: "monaco-breakpoint-glyph",
        glyphMarginHoverMessage: { value: `Breakpoint na linha ${line}` },
      },
    }));

    breakpointDecorationsRef.current = editorRef.current.deltaDecorations(
      breakpointDecorationsRef.current,
      newBpDecorations
    );

    const newDebugDecorations = (isPaused && debugLine)
      ? [
        {
          range: new monacoRef.current.Range(debugLine, 1, debugLine, 1),
          options: {
            isWholeLine: true,
            className: "monaco-debug-active-line",
            glyphMarginClassName: "monaco-debug-arrow-glyph",
          },
        },
      ]
      : [];

    debugLineDecorationRef.current = editorRef.current.deltaDecorations(
      debugLineDecorationRef.current,
      newDebugDecorations
    );
  }, [breakpoints, activeFile, isPaused, debugLine]);

  // Global Keyboard Shortcuts for Debugger
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F5" && !e.shiftKey && !e.ctrlKey) {
        e.preventDefault();
        if (isDebugging && isPaused) {
          handleContinueDebug();
        } else {
          handleStartDebug();
        }
      } else if (e.key === "F5" && e.shiftKey) {
        e.preventDefault();
        handleStopDebug();
      } else if (e.key === "F9") {
        e.preventDefault();
        const curLine = editorRef.current?.getPosition()?.lineNumber;
        if (curLine && activeFileRef.current) {
          toggleBreakpoint(activeFileRef.current, curLine);
        }
      } else if (e.key === "F10") {
        e.preventDefault();
        handleStepOverDebug();
      } else if (e.key === "F11") {
        e.preventDefault();
        handleStepIntoDebug();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isDebugging,
    isPaused,
    handleContinueDebug,
    handleStartDebug,
    handleStopDebug,
    toggleBreakpoint,
    handleStepOverDebug,
    handleStepIntoDebug,
  ]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (sessionId) {
      const saved = localStorage.getItem(`teamcode-chat-history-${sessionId}`);
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch (_) { }
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

  const loadTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/tree/${sessionId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Árvore não encontrada (${res.status})`);
      const data = await res.json();
      const tree = data.tree || { name: "", type: "folder", children: [] };
      populateBuffers(tree, "");
      setTreeRoot(tree);
    } catch (err) {
      console.error("Erro ao carregar árvore", err);
    }
  }, [sessionId, populateBuffers]);

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
        if (stompClientRef.current?.connected) {
          stompClientRef.current.publish({
            destination: `/app/user.leave/${sessionId}`,
            body: JSON.stringify({
              userId: myUserIdRef.current,
              username: localStorage.getItem("username") || "User",
              type: "LEAVE",
            }),
          });
        }
        stompClientRef.current?.deactivate();
      } catch (_) { }
    };
  }, [sessionId]);

  // Window beforeunload listener to notify leave immediately
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (stompClientRef.current?.connected) {
        try {
          stompClientRef.current.publish({
            destination: `/app/user.leave/${sessionId}`,
            body: JSON.stringify({
              userId: myUserIdRef.current,
              username: localStorage.getItem("username") || "User",
              type: "LEAVE",
            }),
          });
        } catch (_) { }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId]);

  // Global user activity listeners to reset idle timer
  useEffect(() => {
    const onUserInteract = () => {
      lastInteractionRef.current = Date.now();
    };

    window.addEventListener("mousemove", onUserInteract, { passive: true });
    window.addEventListener("mousedown", onUserInteract, { passive: true });
    window.addEventListener("keydown", onUserInteract, { passive: true });
    window.addEventListener("touchstart", onUserInteract, { passive: true });
    window.addEventListener("scroll", onUserInteract, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onUserInteract);
      window.removeEventListener("mousedown", onUserInteract);
      window.removeEventListener("keydown", onUserInteract);
      window.removeEventListener("touchstart", onUserInteract);
      window.removeEventListener("scroll", onUserInteract);
    };
  }, []);

  // Idle Timer: Warning at 12 min, Disconnect at 15 min
  useEffect(() => {
    if (isInactiveDisconnected) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastInteractionRef.current;
      const WARNING_THRESHOLD = 12 * 60 * 1000; // 12 minutes
      const TIMEOUT_THRESHOLD = 15 * 60 * 1000; // 15 minutes

      if (elapsed >= TIMEOUT_THRESHOLD) {
        setShowInactivityWarning(false);
        setIsInactiveDisconnected(true);
        try {
          if (stompClientRef.current?.connected) {
            stompClientRef.current.publish({
              destination: `/app/user.leave/${sessionId}`,
              body: JSON.stringify({
                userId: myUserIdRef.current,
                username: localStorage.getItem("username") || "User",
                type: "LEAVE",
                reason: "Inatividade",
              }),
            });
            stompClientRef.current.deactivate();
          }
        } catch (_) { }
      } else if (elapsed >= WARNING_THRESHOLD) {
        setShowInactivityWarning(true);
        const remainingSecs = Math.max(0, Math.round((TIMEOUT_THRESHOLD - elapsed) / 1000));
        setInactivityCountdown(remainingSecs);
      } else {
        setShowInactivityWarning(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionId, isInactiveDisconnected]);

  // Periodic heartbeat while active (every 60s)
  useEffect(() => {
    if (isInactiveDisconnected) return;

    const heartbeatInterval = setInterval(() => {
      const elapsed = Date.now() - lastInteractionRef.current;
      if (elapsed < 2 * 60 * 1000 && stompClientRef.current?.connected) {
        try {
          stompClientRef.current.publish({
            destination: `/app/heartbeat/${sessionId}`,
            body: JSON.stringify({
              userId: myUserIdRef.current,
            }),
          });
        } catch (_) { }
      }
    }, 60000);

    return () => clearInterval(heartbeatInterval);
  }, [sessionId, isInactiveDisconnected]);

  useEffect(() => {
    const onKey = (e) => {
      if (
        document.activeElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) ||
          document.activeElement.closest('.monaco-editor') ||
          document.activeElement.closest('.xterm') ||
          document.activeElement.isContentEditable)
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
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
  const selectionStashRef = useRef(new Set());
  const [renameState, setRenameState] = useState({ open: false, path: null });

  const requestDelete = (nameOrArray) => {
    if (!nameOrArray) return;
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
        if (activeFileRef.current === name) {
          switchActiveFile(null);
          setOpenFiles((prev) => prev.filter((p) => p !== name));
        }
      }
    } catch (err) {
      console.error("Erro ao apagar (lote)", err);
    } finally {
      selectionStashRef.current = new Set();
      await loadTree();
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
        // Migrate buffer if exists
        if (fileBuffersRef.current[path] !== undefined) {
          fileBuffersRef.current[newPath] = fileBuffersRef.current[path];
          delete fileBuffersRef.current[path];
        }
        setOpenFiles((prev) => prev.map((f) => (f === path ? newPath : f)));
        if (activeFileRef.current === path) switchActiveFile(newPath);
        publishTreeEvent("RENAMED", path, newPath);
        toast.success(`Renomeado para "${newName}"`);
      }
    } catch (e) {
      toast.error("Erro de rede ao renomear");
    }
  };

  const handleMoveFile = async (name, destFolder) => {
    if (!name || destFolder === undefined || destFolder === null) return;
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
    }
  };

  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  const { validateSyntax } = useSyntaxValidator();

  useEffect(() => {
    if (!activeFile || !editorContent) {
      setProblems([]);
      return;
    }

    let allProblems = [];

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

    const manualProblems = validateSyntax(editorContent, activeFile);
    allProblems = [...allProblems, ...manualProblems];

    const uniqueProblems = allProblems.filter(
      (problem, index, self) =>
        index ===
        self.findIndex(
          (p) => p.line === problem.line && p.message === problem.message,
        ),
    );

    setProblems(uniqueProblems);
  }, [editorContent, activeFile, validateSyntax]);

  const reactionDecorationsRef = useRef([]);

  useEffect(() => {
    if (!editorRef.current || !activeFile) return;

    const fileReactions = Object.entries(lineReactions).filter(([key]) => key.startsWith(`${activeFile}:`));

    const newDecorations = fileReactions.map(([key, reactions]) => {
      const line = parseInt(key.split(':')[1], 10);
      const emojis = reactions.map(r => r.emoji).join('');
      const usersStr = reactions.map(r => `${r.emoji} ${r.users.join(', ')}`).join('\n');

      return {
        range: new monacoRef.current.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          marginClassName: 'reaction-margin',
          hoverMessage: { value: `**Reações:**\n${usersStr}` },
          glyphMarginHoverMessage: { value: `**Reações:**\n${usersStr}` },
          before: {
            content: emojis,
            inlineClassName: 'reaction-inline text-xs ml-2 opacity-80 cursor-pointer',
          }
        }
      };
    });

    reactionDecorationsRef.current = editorRef.current.deltaDecorations(
      reactionDecorationsRef.current,
      newDecorations
    );
  }, [lineReactions, activeFile]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.onDidScrollChange((e) => {
      if (spotlightHost === myUserIdRef.current && stompClientRef.current?.connected) {
        stompClientRef.current.publish({
          destination: `/topic/spotlight/${sessionId}`,
          body: JSON.stringify({ type: 'UPDATE', userId: myUserIdRef.current, file: activeFileRef.current, scrollTop: e.scrollTop, cursor: editor.getPosition() })
        });
      }
    });
    editor.onDidChangeCursorPosition((e) => {
      if (spotlightHost === myUserIdRef.current && stompClientRef.current?.connected) {
        stompClientRef.current.publish({
          destination: `/topic/spotlight/${sessionId}`,
          body: JSON.stringify({ type: 'UPDATE', userId: myUserIdRef.current, file: activeFileRef.current, scrollTop: editor.getScrollTop(), cursor: e.position })
        });
      }
    });
    monacoRef.current = monaco;

    ['👍', '❤️', '🔥', '🐛', '❓'].forEach((emoji, index) => {
      editor.addAction({
        id: `react-${emoji}`,
        label: `Reagir com ${emoji}`,
        contextMenuGroupId: '1_reactions',
        contextMenuOrder: index,
        run: function (ed) {
          const position = ed.getPosition();
          if (!activeFileRef.current || !stompClientRef.current?.connected) return;

          const key = `${activeFileRef.current}:${position.lineNumber}`;
          const currentReactions = lineReactionsRef.current[key] || [];
          const existingEmoji = currentReactions.find(r => r.emoji === emoji);
          const username = localStorage.getItem("username") || "User";

          const action = (existingEmoji && existingEmoji.users.includes(username)) ? "remove" : "add";

          stompClientRef.current.publish({
            destination: `/app/reaction/${sessionId}`,
            body: JSON.stringify({
              userId: myUserIdRef.current,
              username: username,
              filePath: activeFileRef.current,
              lineNumber: position.lineNumber,
              emoji: emoji,
              action: action
            })
          });
        }
      });
    });

    editor.addAction({
      id: `ai-explain-code`,
      label: `IA: Explicar isso`,
      contextMenuGroupId: '1_reactions',
      contextMenuOrder: 10,
      run: async function (ed) {
        const selection = ed.getSelection();
        const model = ed.getModel();
        const text = model.getValueInRange(selection);
        if (!text.trim()) {
          return;
        }

        const explanationWidgetId = 'ai-explanation-widget';
        const position = { lineNumber: selection.endLineNumber, column: selection.endColumn };

        if (window.__activeAIWidget) {
          ed.removeContentWidget(window.__activeAIWidget);
        }

        const domNode = document.createElement('div');
        domNode.className = 'p-3 rounded-lg border-2 shadow-xl';
        domNode.style.backgroundColor = 'var(--panel-bg-color)';
        domNode.style.borderColor = 'var(--panel-border-color)';
        domNode.style.color = 'var(--text-color)';
        domNode.style.maxWidth = '450px';
        domNode.style.zIndex = '1000';
        domNode.style.fontSize = '13px';
        domNode.innerHTML = `<div class="flex items-center gap-2 font-bold mb-2"><span class="codicon codicon-sparkle text-yellow-500"></span> IA Explicando...</div><div class="opacity-80"><span class="codicon codicon-loading codicon-modifier-spin"></span> Processando...</div>`;

        const widget = {
          getId: () => explanationWidgetId,
          getDomNode: () => domNode,
          getPosition: () => ({
            position: position,
            preference: [monaco.editor.ContentWidgetPositionPreference.BELOW, monaco.editor.ContentWidgetPositionPreference.ABOVE]
          })
        };

        ed.addContentWidget(widget);
        window.__activeAIWidget = widget;

        try {
          const sid = new URLSearchParams(window.location.search).get("sessionId");
          const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': localStorage.getItem('jwtToken') ? `Bearer ${localStorage.getItem('jwtToken')}` : ''
            },
            body: JSON.stringify({
              sessionId: sid,
              mode: 'chat',
              message: "Explique o que este código faz, de forma muito breve e direta (máximo de 2 parágrafos, sem enrolação):\n\n```\n" + text + "\n```"
            })
          });
          const data = await res.json();
          let htmlResponse = data.response
            .replace(/```.*?```/gs, '(código omitido)')
            .replace(/\n/g, '<br/>')
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

          domNode.innerHTML = `
            <div class="flex justify-between items-center mb-2 border-b pb-2" style="border-color: var(--panel-border-color)">
              <div class="flex items-center gap-2 font-bold text-yellow-500">
                <span class="codicon codicon-sparkle"></span> Explicação da IA
              </div>
              <button id="close-ai-widget" class="hover:text-red-500 transition-colors"><span class="codicon codicon-close"></span></button>
            </div>
            <div class="max-h-64 overflow-y-auto pr-1 leading-relaxed">${htmlResponse}</div>
          `;
          domNode.querySelector('#close-ai-widget').onclick = () => {
            ed.removeContentWidget(widget);
            window.__activeAIWidget = null;
          };
        } catch (e) {
          domNode.innerHTML = `<div class="text-red-500 font-bold mb-1">Erro ao buscar explicação</div><div class="opacity-80">${e.message}</div><button id="close-ai-widget" class="mt-2 hover:underline">Fechar</button>`;
          domNode.querySelector('#close-ai-widget').onclick = () => {
            ed.removeContentWidget(widget);
            window.__activeAIWidget = null;
          };
        }
      }
    });

    if (activeFileRef.current) {
      let content = fileBuffersRef.current[activeFileRef.current];
      if (content === undefined) {
        const fileNode = findNodeInTree(treeRoot, activeFileRef.current);
        content = fileNode?.content ?? "";
        fileBuffersRef.current[activeFileRef.current] = content;
      }
      setEditorContent(content);
    }

    editor.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column });
      if (stompClientRef.current?.connected && activeFileRef.current) {
        stompClientRef.current.publish({
          destination: `/app/cursor/${sessionId}`,
          body: JSON.stringify({
            userId: myUserIdRef.current,
            username: localStorage.getItem("username") || "User",
            filePath: activeFileRef.current,
            lineNumber: e.position.lineNumber,
            column: e.position.column,
          }),
        });
      }
    });

    // Breakpoint gutter click listener (only on glyph margin, preserving line selection on line numbers)
    editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const line = e.target.position?.lineNumber;
        if (line && activeFileRef.current) {
          toggleBreakpoint(activeFileRef.current, line);
        }
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
    if (isSwitchingFileRef.current || isRemoteUpdate.current) return;

    const currentPath = activeFileRef.current;
    if (!currentPath) return;

    const newContent = value ?? "";
    fileBuffersRef.current[currentPath] = newContent;
    setEditorContent(newContent);
    updateLocalTreeContent(currentPath, newContent);

    if (stompClientRef.current?.connected) {
      stompClientRef.current.publish({
        destination: `/app/code/${sessionId}`,
        body: JSON.stringify({
          content: newContent,
          filePath: currentPath,
          userId: myUserIdRef.current,
        }),
      });
    }

    if (saveTimersRef.current[currentPath]) {
      clearTimeout(saveTimersRef.current[currentPath]);
    }

    saveTimersRef.current[currentPath] = setTimeout(() => {
      delete saveTimersRef.current[currentPath];
      saveFileToBackend(currentPath, newContent);
    }, 800);
  };

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

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

  const handleFileEvent = (message) => {
    try {
      const event = JSON.parse(message.body);
      if (event?.type === "CREATED") {
        setFiles((prev) => [
          ...prev,
          { name: event.name, content: event.content },
        ]);
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
          userId: myUserIdRef.current,
          username: localStorage.getItem("username") || "User",
          content: chatInput.trim(),
        }),
      });
      setChatInput("");
    }
  };

  const handleUserEvent = (message) => {
    try {
      const eventData = JSON.parse(message.body);
      const newParticipants = eventData.participants || [];
      const prev = prevParticipantsRef.current;
      const myUsername = localStorage.getItem('username') || "User";
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Check if this is a KICK directed at this user
      if (eventData.type === 'KICK') {
        if (eventData.userId === myUserIdRef.current || (eventData.username && eventData.username.toLowerCase() === myUsername.toLowerCase())) {
          toast.error("Você foi removido da sala pelo criador da sessão.");
          setIsInactiveDisconnected(true);
          try { stompClientRef.current?.deactivate(); } catch (_) { }
          setTimeout(() => {
            window.location.href = "/";
          }, 1500);
          return;
        } else {
          toast.info(`${eventData.username || 'Um usuário'} foi removido da sala.`);
          setMessages(prevMsgs => [...prevMsgs, {
            username: 'System',
            content: `${eventData.username || 'Um usuário'} foi removido da sala pelo criador.`,
            isSystem: true,
            timestamp: timeStr
          }]);
        }
      }

      // Check if this is a TIMEOUT directed at this user
      if (eventData.type === 'TIMEOUT' && (eventData.userId === myUserIdRef.current || (eventData.username === myUsername && !newParticipants.includes(myUsername)))) {
        setIsInactiveDisconnected(true);
        setShowInactivityWarning(false);
        try { stompClientRef.current?.deactivate(); } catch (_) { }
        return;
      }

      // If initial participant load after page reload/connect, do NOT show notifications for existing users
      if (isInitialParticipantLoadRef.current) {
        isInitialParticipantLoadRef.current = false;
        prevParticipantsRef.current = newParticipants;
        setParticipants(newParticipants);
        return;
      }

      newParticipants.forEach(p => {
        const uName = typeof p === 'string' ? p : (p?.username || p?.userId || "User");
        const pId = typeof p === 'string' ? p : (p?.userId || p?.username);

        if (!prev.find(pp => (typeof pp === 'string' ? pp : pp.userId) === pId) && uName !== myUsername) {
          toast.info(`${uName} entrou na sessão`);
          setMessages(prevMsgs => [...prevMsgs, {
            username: 'System',
            content: `${uName} entrou na sessão`,
            isSystem: true,
            timestamp: timeStr
          }]);
        }
      });
      prev.forEach(p => {
        const uName = typeof p === 'string' ? p : (p?.username || p?.userId || "User");
        const pId = typeof p === 'string' ? p : (p?.userId || p?.username);

        if (!newParticipants.find(np => (typeof np === 'string' ? np : np.userId) === pId) && uName !== myUsername) {
          const reasonText = eventData.reason ? ` (${eventData.reason})` : '';
          toast.info(`${uName} saiu da sessão${reasonText}`);
          setMessages(prevMsgs => [...prevMsgs, {
            username: 'System',
            content: `${uName} saiu da sessão${reasonText}`,
            isSystem: true,
            timestamp: timeStr
          }]);
        }
      });

      prevParticipantsRef.current = newParticipants;
      setParticipants(newParticipants);
    } catch (e) { }
  };

  const handleKickUser = useCallback((targetUsername) => {
    if (stompClientRef.current?.connected) {
      try {
        stompClientRef.current.publish({
          destination: `/app/user.kick/${sessionId}`,
          body: JSON.stringify({ username: targetUsername }),
        });
      } catch (e) {
        toast.error("Erro ao enviar comando de remoção.");
      }
    }
  }, [sessionId, toast]);

  const handleReconnectAfterInactivity = () => {
    setIsInactiveDisconnected(false);
    setShowInactivityWarning(false);
    lastInteractionRef.current = Date.now();
    connectToWebSocket();
    toast.success("Reconectado à sala com sucesso!");
  };

  const handleCursorEvent = (message) => {
    try {
      const cursorData = JSON.parse(message.body);
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
      if (!codeData || !codeData.filePath || codeData.userId === myUserIdRef.current) return;

      // Always update in-memory cache and tree for this file
      fileBuffersRef.current[codeData.filePath] = codeData.content;
      updateLocalTreeContent(codeData.filePath, codeData.content);

      // If this file is currently focused in our editor, update the live editor
      if (
        codeData.filePath === activeFileRef.current &&
        editorRef.current &&
        codeData.content !== editorRef.current.getValue()
      ) {
        isRemoteUpdate.current = true;
        const position = editorRef.current.getPosition();
        editorRef.current.setValue(codeData.content);
        setEditorContent(codeData.content);
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
        new SockJS(`${window.location.protocol}//${window.location.host}/ws-connect`),
      reconnectDelay: 5000,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      onConnect: () => {
        setStatus("Sincronizado!");
        client.subscribe(`/topic/user/${sessionId}`, handleUserEvent);
        client.subscribe(`/topic/chat/${sessionId}`, handleChatMessage);
        client.subscribe(`/topic/file/${sessionId}`, handleFileEvent);
        client.subscribe(`/topic/cursor/${sessionId}`, handleCursorEvent);
        client.subscribe(`/topic/code/${sessionId}`, handleCodeEvent);
        client.subscribe(`/topic/spotlight/${sessionId}`, (message) => {
          try {
            const data = JSON.parse(message.body);
            if (data.type === 'START') setSpotlightHost(data.userId);
            else if (data.type === 'STOP') setSpotlightHost(null);
            else if (data.type === 'UPDATE') {
              if (data.userId === myUserIdRef.current) return;
              setSpotlightHost(prev => {
                if (prev && prev !== data.userId) return prev;
                if (data.file && data.file !== activeFileRef.current) setActiveFile(data.file);
                if (editorRef.current) {
                  editorRef.current.setScrollTop(data.scrollTop);
                  if (data.cursor) editorRef.current.setPosition(data.cursor);
                }
                return data.userId;
              });
            }
          } catch (e) { }
        });
        client.subscribe(`/topic/tree/${sessionId}`, (message) => {
          try {
            const evt = JSON.parse(message.body || "{}");
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

        client.subscribe(`/topic/reaction/${sessionId}`, (message) => {
          try {
            const reactionMsg = JSON.parse(message.body);
            const { filePath, lineNumber, emoji, action, username } = reactionMsg;

            setLineReactions((prev) => {
              const key = `${filePath}:${lineNumber}`;
              const currentList = prev[key] || [];

              let newList = [...currentList];

              if (action === "add") {
                const existingEmoji = newList.find(r => r.emoji === emoji);
                if (existingEmoji) {
                  if (!existingEmoji.users.includes(username)) {
                    existingEmoji.users.push(username);
                  }
                } else {
                  newList.push({ emoji, users: [username] });
                }
              } else if (action === "remove") {
                const existingEmoji = newList.find(r => r.emoji === emoji);
                if (existingEmoji) {
                  existingEmoji.users = existingEmoji.users.filter(u => u !== username);
                  if (existingEmoji.users.length === 0) {
                    newList = newList.filter(r => r.emoji !== emoji);
                  }
                }
              }

              if (newList.length === 0) {
                const next = { ...prev };
                delete next[key];
                return next;
              }

              return { ...prev, [key]: newList };
            });
          } catch (_) { }
        });

        (async () => {
          try {
            const res = await fetch(`/api/sessions/${sessionId}`, {
              headers: getAuthHeaders(),
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.ownerUsername) {
              setSessionOwner(data.ownerUsername);
            }
            const filesList = Array.isArray(data.files) ? data.files : [];
            setFiles(filesList);
            if (!activeFile && filesList[0]?.name) {
              handleFileClick(filesList[0].name);
              setEditorContent(filesList[0].content ?? "");
            }
          } catch (_) { }
        })();
        client.publish({
          destination: `/app/user.join/${sessionId}`,
          body: JSON.stringify({
            userId: myUserIdRef.current,
            username: localStorage.getItem("username") || "User",
            type: "JOIN",
          }),
        });
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

    const timestamp = new Date().toLocaleTimeString();
    setTerminalOutput((prev) => [
      ...prev,
      {
        timestamp,
        message: `Executando: ${filePath}`,
        type: "info",
      },
    ]);

    setTimeout(() => setIsRunning(false), 3000);

    const content = editorContent || "";
    const ext = filePath.split(".").pop().toLowerCase();
    const fileName = filePath.split("/").pop();
    let command = "";

    switch (ext) {
      case "js":
        command = `node ${fileName}`;
        break;
      case "py":
        command = `python3 -u ${fileName}`;
        break;
      case "java":
        const className = fileName.replace(/\.java$/, "");
        command = `javac ${fileName} && java ${className}`;
        break;
      case "c":
        const cOut = fileName.replace(/\.c$/, "") + ".out";
        command = `gcc ${fileName} -o ${cOut} && ./${cOut}`;
        break;
      case "cpp":
      case "cc":
      case "cxx":
        const cppOut = fileName.replace(/\.(cpp|cc|cxx)$/, "") + ".out";
        command = `g++ ${fileName} -o ${cppOut} && ./${cppOut}`;
        break;
      case "rb":
        command = `ruby ${fileName}`;
        break;
      case "go":
        command = `go run ${fileName}`;
        break;
      case "rs":
        command = `rustc ${fileName} -o ${fileName.replace(/\.rs$/, "")} && ./${fileName.replace(/\.rs$/, "")}`;
        break;
      case "sh":
        command = `bash ${fileName}`;
        break;
      case "ts":
        command = `ts-node ${fileName}`;
        break;
      case "php":
        command = `php ${fileName}`;
        break;
      case "lua":
        command = `lua ${fileName}`;
        break;
      default:
        toast.warning(`Tipo de arquivo não suportado: .${ext}`);
        setIsRunning(false);
        return;
    }

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
      <TimeMachineModal
        isOpen={showTimeMachine}
        onClose={() => setShowTimeMachine(false)}
        sessionId={sessionId}
        activeFile={activeFile}
        currentContent={editorContent}
        onRestore={(content) => {
          setEditorContent(content);
          if (yjsEnabled && monacoRef.current && editorRef.current) {
            editorRef.current.setValue(content);
          }
        }}
      />
      <AIAssistantModal
        isOpen={isAIModalOpen}
        onClose={() => setAIModalOpen(false)}
        activeFile={activeFile}
        editorContent={editorContent}
        selectedText={selectedText}
        sessionId={sessionId}
        onExecuteCommand={(cmd, terminalId) => {
          if (stompClientRef.current) {
            const dest = (!terminalId || terminalId === "main" || terminalId === "1")
              ? `/app/terminal.in/${sessionId}`
              : `/app/terminal.in/${sessionId}/${terminalId}`;
            try {
              stompClientRef.current.publish({
                destination: dest,
                body: JSON.stringify({ input: cmd + '\r' })
              });
            } catch (_) { }
            setTerminalMinimized(false);
            setActiveTerminalTab("TERMINAL");
          }
        }}
        onFileUpdated={async (path, content) => {
          if (content !== undefined && content !== null) {
            fileBuffersRef.current[path] = content;
            updateLocalTreeContent(path, content);
            if (stompClientRef.current?.connected) {
              stompClientRef.current.publish({
                destination: `/app/save/${sessionId}`,
                body: JSON.stringify({ fileName: path, content }),
              });
            }
          }
          await loadTree();
          publishTreeEvent("CREATED", path);
          handleFileClick(path);
        }}
      />
      <SimpleBrowser
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
      />
      <div className="h-screen flex flex-col font-sans overflow-hidden transition-colors duration-500 editor-page-layout pb-[22px]">
        <EditorHeader
          sessionId={sessionId}
          activeView={activeView}
          setActiveView={setActiveView}
          participants={participants}
          cursors={cursors}
          stompClient={stompClientRef.current}
          status={status}
          showPreview={showPreview}
          setShowPreview={setShowPreview}
          resetPanelSizes={resetPanelSizes}
          setTerminalHeight={setTerminalHeight}
          setChatHeight={setChatHeight}
          setTerminalMinimized={setTerminalMinimized}
          terminalMinimized={terminalMinimized}
          setShowChat={setShowChat}
          showChat={showChat}
          setShowSidebar={setShowSidebar}
          sessionOwner={sessionOwner}
          onKickUser={handleKickUser}
        />

        <StatusBar
          activeFile={activeFile}
          cursorPos={cursorPos}
          language={activeFile ? getLanguageFromExtension(activeFile) : null}
          connectionStatus={status}
          problems={problems}
        />

        <div className="flex flex-grow overflow-hidden">
          <ActivityBar
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            activeSidebarTab={activeSidebarTab}
            setActiveSidebarTab={setActiveSidebarTab}
            setSearchModalOpen={setSearchModalOpen}
            handleOpenAIModal={handleOpenAIModal}
            isBrowserOpen={isBrowserOpen}
            setIsBrowserOpen={setIsBrowserOpen}
            setShareModalOpen={setShareModalOpen}
            setAccountModalOpen={setAccountModalOpen}
            setThemeModalOpen={setThemeModalOpen}
          />

          {/* Backdrop Overlay for Mobile/Tablet Sidebar Drawer */}
          {isMobileOrTablet && showSidebar && (
            <div
              className="fixed inset-0 bg-black/50 z-30 backdrop-blur-[1px] transition-opacity"
              onClick={() => setShowSidebar(false)}
            />
          )}

          <aside
            className={`h-full flex flex-col editor-page-panel flex-shrink-0 transition-all duration-300 ease-in-out ${isMobileOrTablet ? 'fixed top-0 bottom-0 left-12 sm:left-14 md:left-16 z-40 w-[80vw] sm:w-72 md:w-80 shadow-2xl' : 'relative'}`}
            style={isMobileOrTablet ? {
              transform: showSidebar ? "translateX(0)" : "translateX(-110%)",
              opacity: showSidebar ? 1 : 0,
              visibility: showSidebar ? "visible" : "hidden",
              backgroundColor: "var(--panel-bg-color)",
              borderColor: "var(--panel-border-color)",
              borderRightWidth: "2px",
            } : {
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
            {isDraggingOver && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
                style={{ background: 'rgba(var(--primary-color-rgb, 99, 102, 241), 0.15)', border: '2px dashed var(--primary-color)' }}>
                <span className="codicon codicon-cloud-upload" style={{ fontSize: 40, color: 'var(--primary-color)' }} />
                <p className="mt-2 text-sm font-bold" style={{ color: 'var(--primary-color)' }}>Solte para fazer upload</p>
              </div>
            )}
            {activeSidebarTab === "EXPLORER" ? (
              <>
                <div
                  className="p-3 border-b-2 flex justify-between items-center text-xs font-bold uppercase tracking-wider select-none flex-shrink-0"
                  style={{
                    backgroundColor: "var(--header-bg-color)",
                    borderColor: "var(--panel-border-color)",
                  }}
                >
                  <span className="flex items-center gap-1.5 opacity-80">
                    <span className="codicon codicon-folder-opened" />
                    <span>Explorer</span>
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        setSelectedParentForCreate("");
                        setGlobalCreateType("file");
                        setCreateFileModalOpen(true);
                      }}
                      title="Novo Arquivo"
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--input-bg-color)] text-[var(--text-muted-color)] hover:text-[var(--text-color)] transition-colors"
                    >
                      <span className="codicon codicon-new-file" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedParentForCreate("");
                        setGlobalCreateType("folder");
                        setCreateFileModalOpen(true);
                      }}
                      title="Nova Pasta"
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--input-bg-color)] text-[var(--text-muted-color)] hover:text-[var(--text-color)] transition-colors"
                    >
                      <span className="codicon codicon-new-folder" />
                    </button>
                    <button
                      onClick={() => loadTree()}
                      title="Recarregar Árvore"
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--input-bg-color)] text-[var(--text-muted-color)] hover:text-[var(--text-color)] transition-colors"
                    >
                      <span className="codicon codicon-refresh" />
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      title="Enviar Arquivo"
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--input-bg-color)] text-[var(--text-muted-color)] hover:text-[var(--text-color)] transition-colors"
                    >
                      <span className="codicon codicon-cloud-upload" />
                    </button>
                    {isMobileOrTablet && (
                      <button
                        onClick={() => setShowSidebar(false)}
                        title="Fechar Barra Lateral"
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--input-bg-color)] text-[var(--text-muted-color)] hover:text-[var(--text-color)] ml-1"
                      >
                        <span className="codicon codicon-close" style={{ fontSize: 13 }} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-grow overflow-y-auto flex flex-col">
                  <RecursiveTree
                    root={treeRoot || { name: "", type: "folder", children: [] }}
                    selectedPath={activeFile}
                    onSelectFile={(p) => {
                      setSelectedPath(p);
                      handleFileClick(p);
                      if (isMobileOnly) setShowSidebar(false);
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
                    editingUsers={editingUsers}
                  />
                </div>
              </>
            ) : activeSidebarTab === "GIT" ? (
              <GitPanel
                sessionId={sessionId}
                getAuthHeaders={getAuthHeaders}
                publishTreeEvent={publishTreeEvent}
                loadTree={loadTree}
                onOpenDiff={handleOpenDiff}
                onOpenCommitDiff={handleOpenCommitDiff}
                onOpenFile={handleFileClick}
                refreshTrigger={gitRefreshCounter}
              />
            ) : (
              <DebugPanel
                isDebugging={isDebugging}
                isPaused={isPaused}
                currentLine={debugLine}
                activeFile={activeFile}
                breakpoints={breakpoints}
                onToggleBreakpoint={toggleBreakpoint}
                onRemoveBreakpoint={removeBreakpoint}
                onClearAllBreakpoints={clearAllBreakpoints}
                onOpenFileAtLine={(file, line) => {
                  handleFileClick(file);
                  setTimeout(() => {
                    if (editorRef.current) {
                      editorRef.current.setPosition({ lineNumber: line, column: 1 });
                      editorRef.current.revealLineInCenter(line);
                      editorRef.current.focus();
                    }
                  }, 150);
                }}
                debugScope={debugScope}
                callStack={callStack}
                watchExpressions={watchExpressions}
                onAddWatch={handleAddWatch}
                onRemoveWatch={handleRemoveWatch}
                onStartDebug={handleStartDebug}
                onStopDebug={handleStopDebug}
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

          {showSidebar && !isMobileOrTablet && <ResizeHandle onMouseDown={onMouseDown("left")} />}

          <div
            className="h-full flex-grow flex flex-col min-w-0 transition-all duration-300 ease-in-out relative"
            style={{ flexBasis: isMobileOrTablet ? "100%" : `${panelSizes.center}%` }}
          >
            {/* Floating Debug Controls Toolbar */}
            <DebugToolbar
              isDebugging={isDebugging}
              isPaused={isPaused}
              currentLine={debugLine}
              activeFile={activeFile}
              onContinue={handleContinueDebug}
              onPause={handlePauseDebug}
              onStepOver={handleStepOverDebug}
              onStepInto={handleStepIntoDebug}
              onStepOut={handleStepOutDebug}
              onRestart={handleRestartDebug}
              onStop={handleStopDebug}
            />

            {activeView === 'whiteboard' ? (
              <React.Suspense fallback={
                <div className="flex-1 flex items-center justify-center font-bold text-sm opacity-60">
                  <span className="codicon codicon-loading codicon-modifier-spin mr-2" /> Carregando Whiteboard...
                </div>
              }>
                <Whiteboard
                  stompClient={stompClientRef.current}
                  sessionId={sessionId}
                  myUserId={myUserIdRef.current}
                />
              </React.Suspense>
            ) : (
              <>
                <FileTabs
                  openFiles={openFiles}
                  activeFile={activeFile}
                  onTabClick={switchActiveFile}
                  onTabClose={handleTabClose}
                  onRunFile={handleRunFile}
                  isRunning={isRunning}
                  onFormat={formatCode}
                  onOpenTimeMachine={() => setShowTimeMachine(true)}
                  spotlightHost={spotlightHost}
                  myUserId={myUserIdRef.current}
                  onToggleSpotlight={() => {
                    const isHost = spotlightHost === myUserIdRef.current;
                    if (stompClientRef.current?.connected) {
                      stompClientRef.current.publish({
                        destination: `/topic/spotlight/${sessionId}`,
                        body: JSON.stringify({ type: isHost ? 'STOP' : 'START', userId: myUserIdRef.current })
                      });
                    }
                  }}
                />
                <main className="flex-grow relative min-h-0 overflow-hidden flex">
                  {activeDiff ? (
                    <div className="h-full w-full flex flex-col" style={{ backgroundColor: "var(--bg-color)" }}>
                      {/* Diff Header Bar */}
                      <div
                        className="h-10 px-3 border-b flex items-center justify-between flex-shrink-0 text-xs select-none"
                        style={{
                          borderColor: "var(--panel-border-color)",
                          backgroundColor: "var(--header-bg-color, var(--panel-bg-color))",
                          color: "var(--text-color)",
                        }}
                      >
                        {activeDiff.isCommitDiff ? (
                          <div className="flex items-center gap-2 font-mono truncate pr-2">
                            <span className="codicon codicon-git-commit text-purple-400 text-sm flex-shrink-0" />
                            <span className="font-bold truncate">{activeDiff.path}</span>
                            <span className="px-2 py-0.5 text-[10px] font-sans border rounded opacity-90 flex items-center gap-1.5 flex-shrink-0" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}>
                              <span className="text-amber-400 font-mono font-bold">{activeDiff.shortParentHash}</span>
                              <span className="codicon codicon-arrow-right text-[9px] opacity-70" />
                              <span className="text-emerald-400 font-mono font-bold">{activeDiff.shortHash}</span>
                              {activeDiff.commitMessage && (
                                <span className="opacity-75 font-normal truncate max-w-[180px] hidden sm:inline">
                                  ({activeDiff.commitMessage})
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 font-mono truncate pr-2">
                            <span className="codicon codicon-diff text-amber-400 text-sm" />
                            <span className="font-bold truncate">{activeDiff.path}</span>
                            <span className="px-2 py-0.5 text-[10px] font-sans border rounded opacity-80" style={{ borderColor: "var(--panel-border-color)" }}>
                              {activeDiff.isStaged ? "Staged (Index vs HEAD)" : "Working Tree (Disco vs HEAD)"}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!activeDiff.isCommitDiff && !activeDiff.isStaged && (
                            <button
                              onClick={() => handleStageFromDiff(activeDiff.path)}
                              className="px-2.5 py-1 border-2 font-bold text-xs flex items-center gap-1 hover:bg-black/10 text-emerald-400 neo-shadow-button"
                              style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}
                              title="Adicionar ao Stage"
                            >
                              <span className="codicon codicon-add" />
                              <span>Stage Changes</span>
                            </button>
                          )}
                          {!activeDiff.isCommitDiff && activeDiff.isStaged && (
                            <button
                              onClick={() => handleUnstageFromDiff(activeDiff.path)}
                              className="px-2.5 py-1 border-2 font-bold text-xs flex items-center gap-1 hover:bg-black/10 text-red-400 neo-shadow-button"
                              style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}
                              title="Remover do Stage"
                            >
                              <span className="codicon codicon-remove" />
                              <span>Unstage Changes</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const p = activeDiff.path;
                              setActiveDiff(null);
                              handleFileClick(p);
                            }}
                            className="px-2.5 py-1 border font-bold text-xs flex items-center gap-1 hover:bg-black/10"
                            style={{ borderColor: "var(--panel-border-color)", color: "var(--text-color)" }}
                            title="Abrir no editor padrão"
                          >
                            <span className="codicon codicon-go-to-file" />
                            <span>Abrir no Editor</span>
                          </button>
                          <button
                            onClick={() => setActiveDiff(null)}
                            className="p-1 hover:opacity-75"
                            title="Fechar Comparação"
                          >
                            <span className="codicon codicon-close" />
                          </button>
                        </div>
                      </div>

                      {/* Monaco DiffEditor Component */}
                      <div className="flex-1 min-h-0">
                        <DiffEditor
                          key={`diff-${activeDiff.path}-${activeDiff.isStaged}-${theme}-${fontSize}`}
                          height="100%"
                          theme={theme.replace(/_/g, '-')}
                          original={activeDiff.originalContent || ""}
                          modified={activeDiff.modifiedContent || ""}
                          language={getLanguageFromExtension(activeDiff.path)}
                          options={{
                            automaticLayout: true,
                            readOnly: true,
                            renderSideBySide: !isMobileOrTablet,
                            fontSize: isMobileOnly ? 13 : fontSize,
                            wordWrap: "on",
                            scrollBeyondLastLine: false,
                          }}
                        />
                      </div>
                    </div>
                  ) : openFiles.length > 0 ? (
                    <>
                      <div
                        className={`h-full ${showPreview ? "w-1/2" : "w-full"} transition-all duration-300`}
                      >
                        <Editor
                          key={`${theme}-${fontSize}`}
                          height="100%"
                          theme={theme.replace(/_/g, '-')}
                          path={activeFile}
                          language={getLanguageFromExtension(activeFile)}
                          value={editorContent ?? ""}
                          onMount={handleEditorDidMount}
                          onChange={handleEditorChange}
                          options={{
                            automaticLayout: true,
                            glyphMargin: true,
                            minimap: { enabled: !isMobileOrTablet },
                            fontSize: isMobileOnly ? 13 : fontSize,
                            wordWrap: "on",
                            scrollBeyondLastLine: false,
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
                                className="flex-1 p-4 overflow-y-auto markdown-body text-sm prose dark:prose-invert max-w-none"
                                style={{
                                  backgroundColor: "var(--bg-color)",
                                  color: "var(--text-color)",
                                }}
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(editorContent || '') }}
                              />
                            ) : (
                              <iframe
                                id="preview-frame"
                                title="preview"
                                className="w-full flex-grow border-none"
                                srcDoc={editorContent}
                              />
                            )}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 select-none opacity-40">
                      <span className="codicon codicon-code text-5xl mb-4" />
                      <p className="text-base font-bold">Nenhum arquivo aberto</p>
                      <p className="text-xs mt-1">Selecione um arquivo no Explorer à esquerda para começar a editar.</p>
                    </div>
                  )}
                </main>
              </>
            )}

            {/* Terminal Resize Handle */}
            {!terminalMinimized && (
              <div
                className="h-1 bg-[var(--panel-border-color)] hover:bg-[var(--primary-color)] transition-colors select-none z-20"
                onMouseDown={onTerminalMouseDown}
                title="Ajustar altura do terminal"
                style={{ cursor: "row-resize" }}
              />
            )}
            <TerminalPanel
              terminalMinimized={terminalMinimized}
              terminalHeight={terminalHeight}
              setTerminalHeight={setTerminalHeight}
              activeTerminalTab={activeTerminalTab}
              setActiveTerminalTab={setActiveTerminalTab}
              terminalApiRef={terminalApiRef}
              terminalBufferRef={terminalBufferRef}
              setTerminalOutput={setTerminalOutput}
              setProblems={setProblems}
              sessionId={sessionId}
              stompClient={stompClientRef.current}
              terminalOutput={terminalOutput}
              problems={problems}
              debugLogs={debugLogs}
              onClearDebugLogs={handleClearDebugLogs}
              debugScope={debugScope}
              onEvaluateDebug={handleEvaluateDebug}
              editorRef={editorRef}
              setTerminalMinimized={setTerminalMinimized}
            />
          </div>

          {showChat && !isMobileOrTablet && <ResizeHandle onMouseDown={onMouseDown("right")} />}

          {/* Backdrop Overlay for Mobile/Tablet Chat Drawer */}
          {isMobileOrTablet && showChat && (
            <div
              className="fixed inset-0 bg-black/50 z-30 backdrop-blur-[1px] transition-opacity"
              onClick={() => setShowChat(false)}
            />
          )}

          <ChatPanel
            rightAsideRef={rightAsideRef}
            showChat={showChat}
            setShowChat={setShowChat}
            panelSizes={panelSizes}
            showParticipantsList={showParticipantsList}
            setShowParticipantsList={setShowParticipantsList}
            participants={participants}
            messagesRef={messagesRef}
            messages={messages}
            chatHeight={chatHeight}
            chatMessagesEndRef={chatMessagesEndRef}
            onChatMouseDown={onChatMouseDown}
            chatTextareaRef={chatTextareaRef}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleSendChatMessage={handleSendChatMessage}
            handleInsertText={handleInsertText}
            isOverlay={isMobileOrTablet}
          />
        </div>

        {/* Theme Modal */}
        {themeModalOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setThemeModalOpen(false)}
          >
            <div
              className={`border-4 p-6 max-w-md w-full neo-shadow-card flex flex-col items-center ${theme.includes('brutalism') ? 'rounded-none' : 'rounded-2xl'}`}
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

              <div className="w-full mb-4 p-3 border-2 rounded" style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--input-bg-color)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-color)' }}>
                      <span className="codicon codicon-sync mr-1" /> Yjs/CRDT (Experimental)
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted-color)' }}>
                      {isYjsActive ? 'Ativo' : yjsEnabled ? 'Aguardando conexão...' : 'Inativo'}
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
                      try { localStorage.setItem('teamcode-yjs-enabled', next ? '1' : '0'); } catch (_) { }
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
              className={`border-4 p-6 max-w-md w-full neo-shadow-card ${theme.includes('brutalism') ? 'rounded-none' : 'rounded-2xl'}`}
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
              className={`border-4 p-8 max-w-md w-full neo-shadow-card ${theme.includes('brutalism') ? 'rounded-none' : 'rounded-2xl'} transform scale-100 transition-transform duration-300 relative overflow-hidden`}
              style={{
                backgroundColor: "var(--panel-bg-color)",
                borderColor: "var(--panel-border-color)",
                boxShadow: "8px 8px 0px 0px var(--panel-border-color)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 flex items-center space-x-1.5 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/30">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Online</span>
              </div>

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

        {/* Inactivity Warning Floating Dialog (at 12 min) */}
        {showInactivityWarning && !isInactiveDisconnected && (
          <div
            className="fixed bottom-6 right-6 z-50 p-4 border-2 rounded-2xl neo-shadow-card flex items-center gap-4 animate-bounce max-w-md"
            style={{
              backgroundColor: "var(--panel-bg-color)",
              borderColor: "rgb(245, 158, 11)",
              boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.3)"
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/40 flex items-center justify-center shrink-0">
              <span className="codicon codicon-warning text-xl" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider">Aviso de Inatividade</h4>
              <p className="text-xs opacity-80 mt-0.5" style={{ color: "var(--text-color)" }}>
                Você será desconectado da sala em <b>{inactivityCountdown}s</b> por inatividade.
              </p>
            </div>
            <button
              onClick={reportActivity}
              className="px-3 py-1.5 border-2 rounded-xl text-xs font-black bg-amber-500 text-black hover:bg-amber-400 transition-all shrink-0 cursor-pointer"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Inactivity Disconnected Modal (at 15 min or server timeout) */}
        {isInactiveDisconnected && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all"
          >
            <div
              className="border-4 p-8 max-w-md w-full neo-shadow-card rounded-2xl text-center flex flex-col items-center"
              style={{
                backgroundColor: "var(--panel-bg-color)",
                borderColor: "rgb(239, 68, 68)",
                boxShadow: "8px 8px 0px 0px rgba(239, 68, 68, 0.4)",
              }}
            >
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-500 border-2 border-red-500/40 flex items-center justify-center mb-4">
                <span className="codicon codicon-debug-disconnect text-3xl" />
              </div>

              <h2 className="text-xl font-black mb-2" style={{ color: "var(--primary-color)" }}>
                Desconectado por Inatividade
              </h2>

              <p className="text-xs opacity-80 mb-6 leading-relaxed" style={{ color: "var(--text-muted-color)" }}>
                Sua conexão com a sala foi encerrada após 15 minutos sem atividade para poupar recursos da VM e evitar conexões fantasmas.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={handleReconnectAfterInactivity}
                  className="flex-1 py-2.5 px-4 border-2 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  style={{
                    backgroundColor: "var(--primary-color)",
                    color: "#fff",
                    borderColor: "var(--panel-border-color)",
                  }}
                >
                  <span className="codicon codicon-refresh" />
                  <span>Reconectar à Sala</span>
                </button>
                <a
                  href="/"
                  className="flex-1 py-2.5 px-4 border-2 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all text-center"
                  style={{
                    backgroundColor: "var(--input-bg-color)",
                    borderColor: "var(--panel-border-color)",
                    color: "var(--text-color)",
                  }}
                >
                  <span className="codicon codicon-home" />
                  <span>Ir para o Início</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

