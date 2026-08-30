import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { useTheme } from "../contexts/ThemeContext";
import { xtermThemes } from "../utils/editorThemes";

function TerminalComponent({ sessionId, terminalId = "main", stompClient, registerApi, onApiReady }) {
  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const fitAddonRef = useRef(null);
  const stompClientRef = useRef(stompClient);
  const { theme, fontSize } = useTheme();

  useEffect(() => {
    stompClientRef.current = stompClient;
  }, [stompClient]);

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

  const getRestartDestination = () => {
    return (!terminalId || terminalId === "main" || terminalId === "1")
      ? `/app/terminal.restart/${sessionId}`
      : `/app/terminal.restart/${sessionId}/${terminalId}`;
  };

  const getOutTopic = () => {
    return (!terminalId || terminalId === "main" || terminalId === "1")
      ? `/topic/terminal/${sessionId}`
      : `/topic/terminal/${sessionId}/${terminalId}`;
  };

  // 1. Initialize Terminal instance and addons
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

    const safeFit = () => {
      if (
        terminalRef.current &&
        terminalRef.current.offsetWidth > 0 &&
        terminalRef.current.offsetHeight > 0
      ) {
        try {
          fitAddon.fit();
        } catch (_) { }
      }
    };

    // Immediate focus + retries on mount
    try {
      term.focus();
    } catch (_) { }

    setTimeout(() => {
      safeFit();
      try {
        term.focus();
      } catch (_) { }
    }, 50);

    setTimeout(() => {
      safeFit();
      try {
        term.focus();
      } catch (_) { }
    }, 200);

    const sendResize = () => {
      safeFit();
      const cols = term.cols;
      const rows = term.rows;
      const client = stompClientRef.current;
      if (client?.connected && cols > 0 && rows > 0) {
        try {
          client.publish({
            destination: getResizeDestination(),
            body: JSON.stringify({ cols, rows }),
          });
        } catch (_) { }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      sendResize();
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }
    window.addEventListener("resize", sendResize);

    term.attachCustomKeyEventHandler((event) => {
      if (event.key === 'Escape') return true;

      // Handle copy (Ctrl+C / Cmd+C) only when text is selected; otherwise let SIGINT pass
      if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'C') && event.type === 'keydown') {
        if (term.hasSelection()) {
          const selection = term.getSelection();
          if (selection) {
            navigator.clipboard.writeText(selection).catch(() => { });
          }
          return false;
        }
        return true;
      }

      // Handle paste (Ctrl+V / Cmd+V)
      if ((event.ctrlKey || event.metaKey) && (event.key === 'v' || event.key === 'V')) {
        if (event.type === 'keydown') {
          if (navigator.clipboard?.readText) {
            navigator.clipboard.readText().then((pasteText) => {
              if (pasteText) {
                term.paste(pasteText);
              }
            }).catch(() => { });
          }
        }
        return false;
      }

      return true;
    });

    const onDataDisposable = term.onData((data) => {
      const client = stompClientRef.current;
      if (client?.connected) {
        try {
          client.publish({
            destination: getInDestination(),
            body: JSON.stringify({ input: data }),
          });
        } catch (_) { }
      }
    });

    termInstance.current = term;
    fitAddonRef.current = fitAddon;

    const apiObj = {
      write: (data) => {
        if (termInstance.current) termInstance.current.write(data);
      },
      clear: () => {
        try { termInstance.current?.clear(); } catch (_) { }
      },
      fit: safeFit,
      focus: () => {
        try { termInstance.current?.focus(); } catch (_) { }
      },
      restart: () => {
        try {
          termInstance.current?.clear();
          if (stompClient?.connected) {
            let cols = termInstance.current?.cols || 80;
            let rows = termInstance.current?.rows || 24;
            stompClient.publish({
              destination: getRestartDestination(),
              body: JSON.stringify({ cols, rows, terminalId }),
            });
          }
        } catch (_) { }
      },
      sendResize,
    };

    const registerFn = registerApi || onApiReady;
    if (typeof registerFn === "function") {
      registerFn(apiObj, terminalId);
    }

    return () => {
      window.removeEventListener("resize", sendResize);
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, terminalId]);

  // 2. Dedicated Subscription Effect (handles connect, reconnect, topic isolation)
  useEffect(() => {
    if (!stompClient?.connected) return;

    let sub = null;
    const topic = getOutTopic();

    try {
      sub = stompClient.subscribe(topic, (message) => {
        let content = message.body;
        try {
          const json = JSON.parse(message.body);
          if (json && typeof json === "object" && "output" in json) {
            content = json.output;
          }
        } catch (_) { }
        termInstance.current?.write(content ?? "");
      });
    } catch (e) {
      console.error(`Error subscribing to terminal topic ${topic}`, e);
    }

    return () => {
      if (sub) {
        try { sub.unsubscribe(); } catch (_) { }
      }
    };
  }, [stompClient, stompClient?.connected, sessionId, terminalId]);

  // 3. Theme & Font Size updates
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
        try {
          if (terminalRef.current && terminalRef.current.offsetWidth > 0) {
            fitAddonRef.current?.fit();
          }
        } catch (_) { }
      }, 50);
    }
  }, [theme, fontSize]);

  // 4. Initial start notification to backend
  useEffect(() => {
    if (stompClient?.connected) {
      const timer = setTimeout(() => {
        let cols = 80;
        let rows = 24;
        try {
          if (fitAddonRef.current && termInstance.current && terminalRef.current?.offsetWidth > 0) {
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
