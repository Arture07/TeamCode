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
            destination: `/app/terminal.resize/${sessionId}`,
            body: JSON.stringify({ cols, rows }),
          });
        } catch (_) { }
      }, 300);
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
