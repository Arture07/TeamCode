import React from "react";

/**
 * DebugToolbar — Floating debug control bar matching VS Code / Antigravity aesthetics.
 * Provides controls for Continue, Pause, Step Over, Step Into, Step Out, Restart, and Stop.
 */
export default function DebugToolbar({
  isDebugging,
  isPaused,
  currentLine,
  activeFile,
  onContinue,
  onPause,
  onStepOver,
  onStepInto,
  onStepOut,
  onRestart,
  onStop,
}) {
  if (!isDebugging) return null;

  const fileName = activeFile ? activeFile.split("/").pop() : "";

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-md border-2 neo-shadow glass-panel select-none animate-in fade-in slide-in-from-top-2 duration-200"
      style={{
        backgroundColor: "var(--panel-bg-color)",
        borderColor: "var(--panel-border-color)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
      }}
    >
      {/* Drag Grip Indicator & Status */}
      <div className="flex items-center gap-2 pr-2 border-r border-black/15 mr-1" style={{ borderColor: "var(--panel-border-color)" }}>
        <span className="codicon codicon-gripper opacity-40 text-xs cursor-move" />
        <span
          className="w-2.5 h-2.5 rounded-full animate-pulse"
          style={{
            backgroundColor: isPaused ? "#f59e0b" : "#10b981",
          }}
          title={isPaused ? "Execution paused at breakpoint" : "Running..."}
        />
        <span className="text-[11px] font-mono font-bold max-w-[120px] truncate" style={{ color: "var(--text-color)" }}>
          {isPaused ? `${fileName}:${currentLine || 1}` : "Running"}
        </span>
      </div>

      {/* Control Buttons */}
      {isPaused ? (
        <button
          onClick={onContinue}
          className="p-1.5 rounded hover:bg-black/10 text-emerald-400 hover:text-emerald-300 transition-colors flex items-center"
          title="Continue (F5)"
        >
          <span className="codicon codicon-debug-continue text-sm" />
        </button>
      ) : (
        <button
          onClick={onPause}
          className="p-1.5 rounded hover:bg-black/10 text-amber-400 hover:text-amber-300 transition-colors flex items-center"
          title="Pause (F6)"
        >
          <span className="codicon codicon-debug-pause text-sm" />
        </button>
      )}

      <button
        onClick={onStepOver}
        disabled={!isPaused}
        className="p-1.5 rounded hover:bg-black/10 text-blue-400 hover:text-blue-300 disabled:opacity-35 transition-colors flex items-center"
        title="Step Over (F10)"
      >
        <span className="codicon codicon-debug-step-over text-sm" />
      </button>

      <button
        onClick={onStepInto}
        disabled={!isPaused}
        className="p-1.5 rounded hover:bg-black/10 text-blue-400 hover:text-blue-300 disabled:opacity-35 transition-colors flex items-center"
        title="Step Into (F11)"
      >
        <span className="codicon codicon-debug-step-into text-sm" />
      </button>

      <button
        onClick={onStepOut}
        disabled={!isPaused}
        className="p-1.5 rounded hover:bg-black/10 text-blue-400 hover:text-blue-300 disabled:opacity-35 transition-colors flex items-center"
        title="Step Out (Shift+F11)"
      >
        <span className="codicon codicon-debug-step-out text-sm" />
      </button>

      <div className="h-4 w-px bg-black/20 mx-0.5" style={{ backgroundColor: "var(--panel-border-color)" }} />

      <button
        onClick={onRestart}
        className="p-1.5 rounded hover:bg-black/10 text-green-400 hover:text-green-300 transition-colors flex items-center"
        title="Restart (Ctrl+Shift+F5)"
      >
        <span className="codicon codicon-debug-restart text-sm" />
      </button>

      <button
        onClick={onStop}
        className="p-1.5 rounded hover:bg-black/10 text-red-400 hover:text-red-300 transition-colors flex items-center"
        title="Stop Debugging (Shift+F5)"
      >
        <span className="codicon codicon-debug-stop text-sm" />
      </button>
    </div>
  );
}
