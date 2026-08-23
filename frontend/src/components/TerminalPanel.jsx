import React from "react";
import TerminalComponent from "./TerminalComponent";

function TerminalPanel({
  terminalMinimized,
  terminalHeight,
  setTerminalHeight,
  activeTerminalTab,
  setActiveTerminalTab,
  terminalApiRef,
  terminalBufferRef,
  setTerminalOutput,
  setProblems,
  sessionId,
  stompClient,
  terminalOutput,
  problems,
  editorRef,
  setTerminalMinimized,
}) {
  if (terminalMinimized) return null;

  return (
    <footer
      className="flex-shrink-0 border-t-2 terminal-footer flex flex-col"
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
      <div className="flex-grow relative min-h-0">
        <div
          className={`h-full w-full ${activeTerminalTab === "TERMINAL" ? "" : "hidden"}`}
        >
          <TerminalComponent
            sessionId={sessionId}
            stompClient={stompClient}
            registerApi={(api) => {
              terminalApiRef.current = api;
              if (terminalBufferRef?.current?.length > 0) {
                terminalBufferRef.current.forEach((chunk) => api.write(chunk));
                terminalBufferRef.current = [];
              }
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
  );
}

export default TerminalPanel;
