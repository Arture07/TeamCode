import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { useTheme } from "../contexts/ThemeContext";
import { xtermThemes } from "../utils/editorThemes";

function TerminalComponent({ sessionId, terminalId = "main", stompClient, registerApi }) {
  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const fitAddonRef = useRef(null);
  const { theme, fontSize } = useTheme();

  const getInDestination = () => {
    return (!terminalId || terminalId === "main" || terminalId === "1")
      ? `/app/terminal.in/${sessionId}`
      : `/app/terminal.in/${sessionId}/${terminalId}`;
  };

  const getResizeDestination = () => {
    return (!terminalId || terminalId === "main" || terminalId === "1")
      ? `/app/terminal.resize/${sessionId}`
      : `/app/terminal.resize/${sessionId}/${terminalId}`;
  };

  const getStartDestination = () => {
    return (!terminalId || terminalId === "main" || terminalId === "1")
      ? `/app/terminal.start/${sessionId}`
      : `/app/terminal.start/${sessionId}/${terminalId}`;
  };

  const getOutTopic = () => {
    return (!terminalId || terminalId === "main" || terminalId === "1")
      ? `/topic/terminal/${sessionId}`
      : `/topic/terminal/${sessionId}/${terminalId}`;
  };

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
      convertEol: false,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    setTimeout(() => {
      try { fitAddon.fit(); } catch (e) { /* ignore */ }
    }, 100);

    const sendResize = () => {
      if (!terminalRef.current || terminalRef.current.offsetHeight === 0) return;
      try {
        fitAddon.fit();
      } catch (e) { /* ignore */ }
      const cols = term.cols;
      const rows = term.rows;
      if (stompClient?.connected && cols > 0 && rows > 0) {
        try {
          stompClient.publish({
            destination: getResizeDestination(),
            body: JSON.stringify({ cols, rows }),
          });
        } catch (_) { }
      }
    };

    const resizeObserver = new ResizeObserver(() => sendResize());
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }
    window.addEventListener("resize", sendResize);

    term.attachCustomKeyEventHandler((event) => {
      if (event.key === 'Escape') return true;

      if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C') && event.type === 'keydown') {
        if (term.hasSelection()) {
          const selection = term.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection).catch(() => {});
          }
          return false;
        }
        return true;
      }

      if ((event.ctrlKey || event.metaKey) && (event.key === 'v' || event.key === 'V') && event.type === 'keydown') {
        navigator.clipboard.readText().then((clipText) => {
          if (clipText) term.paste(clipText);
        }).catch(() => {});
        return false;
      }

      return true;
    });

    const handleDomPaste = (e) => {
      const pasteText = e.clipboardData?.getData('text');
      if (pasteText) term.paste(pasteText);
    };
    const currentDomEl = terminalRef.current;
    if (currentDomEl) {
      currentDomEl.addEventListener('paste', handleDomPaste);
    }

    const onDataDisposable = term.onData((data) => {
      if (stompClient?.connected) {
        try {
          stompClient.publish({
            destination: getInDestination(),
            body: JSON.stringify({ input: data }),
          });
        } catch (_) { }
      }
    });

    // Subscribe directly to this terminal's topic
    let sub = null;
    if (stompClient?.connected) {
      try {
        sub = stompClient.subscribe(getOutTopic(), (message) => {
          let content = message.body;
          try {
            const json = JSON.parse(message.body);
            if (json && typeof json === "object" && "output" in json) {
              content = json.output;
            }
          } catch (_) { }
          term.write(content ?? "");
        });
      } catch (e) {
        console.error("Error subscribing to terminal topic", e);
      }
    }

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
        focus: () => {
          try { termInstance.current?.focus(); } catch (_) { }
        },
        sendResize,
      }, terminalId);
    }

    return () => {
      window.removeEventListener("resize", sendResize);
      if (currentDomEl) {
        currentDomEl.removeEventListener('paste', handleDomPaste);
      }
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      if (sub) {
        try { sub.unsubscribe(); } catch (_) { }
      }
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, terminalId, stompClient]);

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
            destination: getStartDestination(),
            body: JSON.stringify({ cols, rows }),
          });
        } catch (_) { }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [stompClient?.connected, sessionId, terminalId]);

  return (
    <div
      ref={terminalRef}
      className="h-full w-full"
      style={{ padding: "4px 0 0 4px" }}
      onClick={() => termInstance.current?.focus()}
    />
  );
}

export default TerminalComponent;
