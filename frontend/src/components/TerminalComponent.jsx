import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { useTheme } from "../contexts/ThemeContext";
import { xtermThemes } from "../utils/editorThemes";

function TerminalComponent({ sessionId, stompClient, registerApi }) {
  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const fitAddonRef = useRef(null);
  const { theme, fontSize } = useTheme();

  useEffect(() => {
    const defaultTheme = {
      background: theme.includes("dark") ? "#1e1e1e" : "#ffffff",
      foreground: theme.includes("dark") ? "#cccccc" : "#333333",
      cursor: theme.includes("dark") ? "#ffffff" : "#000000",
      selectionBackground: theme.includes("dark") ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
    };

    const term = new Terminal({
      theme: xtermThemes[theme] || defaultTheme,
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
      // Skip resize when the container is hidden (height = 0).
      if (!terminalRef.current || terminalRef.current.offsetHeight === 0) return;
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

    // Custom key event handler for Clipboard shortcuts & ESC passthrough
    term.attachCustomKeyEventHandler((event) => {
      // Allow Escape key to pass through to PTY (for vim, nano, htop, less)
      if (event.key === 'Escape') {
        return true;
      }

      // Handle Copy: Ctrl+C / Cmd+C / Ctrl+Shift+C
      if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C') && event.type === 'keydown') {
        if (term.hasSelection()) {
          const selection = term.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection).catch(() => {});
          }
          return false; // Prevent sending \x03 to terminal when copying text
        }
        // When no text is selected, let Ctrl+C pass through as SIGINT (\x03) to kill processes!
        return true;
      }

      // Handle Paste: Ctrl+V / Cmd+V / Ctrl+Shift+V
      if ((event.ctrlKey || event.metaKey) && (event.key === 'v' || event.key === 'V') && event.type === 'keydown') {
        navigator.clipboard.readText().then((clipText) => {
          if (clipText) {
            term.paste(clipText);
          }
        }).catch(() => {
          // Fallback if browser permission is blocked
        });
        return false; // Prevent sending raw unhandled Ctrl+V to terminal
      }

      return true;
    });

    // Native DOM paste listener as fallback
    const handleDomPaste = (e) => {
      const pasteText = e.clipboardData?.getData('text');
      if (pasteText) {
        term.paste(pasteText);
      }
    };
    const currentDomEl = terminalRef.current;
    if (currentDomEl) {
      currentDomEl.addEventListener('paste', handleDomPaste);
    }

    // RAW passthrough: every keystroke goes directly to the PTY
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
      if (currentDomEl) {
        currentDomEl.removeEventListener('paste', handleDomPaste);
      }
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, stompClient]);

  // Update theme and font size dynamically without wiping terminal history
  useEffect(() => {
    if (termInstance.current) {
      const defaultTheme = {
        background: theme.includes("dark") ? "#1e1e1e" : "#ffffff",
        foreground: theme.includes("dark") ? "#cccccc" : "#333333",
        cursor: theme.includes("dark") ? "#ffffff" : "#000000",
        selectionBackground: theme.includes("dark") ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
      };
      termInstance.current.options.theme = xtermThemes[theme] || defaultTheme;
      termInstance.current.options.fontSize = fontSize || 14;
      setTimeout(() => {
        try { fitAddonRef.current?.fit(); } catch (_) { }
      }, 50);
    }
  }, [theme, fontSize]);

  // When connected, start the PTY with the correct initial size
  useEffect(() => {
    if (stompClient?.connected) {
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
  }, [stompClient?.connected, sessionId]);

  return (
    <div
      ref={terminalRef}
      className="h-full w-full"
      style={{ padding: "4px 0 0 4px" }}
    />
  );
}

export default TerminalComponent;
