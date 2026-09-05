import React, { useState } from "react";

function StatusBar({ activeFile, cursorPos, language, connectionStatus, problems }) {
  const errCount = (problems || []).filter(p => p.severity === 'error').length;
  const warnCount = (problems || []).filter(p => p.severity === 'warning').length;

  const [aiEnabled, setAiEnabled] = useState(() => localStorage.getItem("ai_autocomplete_disabled") !== "true");

  const toggleAiAutocomplete = () => {
    const next = !aiEnabled;
    setAiEnabled(next);
    localStorage.setItem("ai_autocomplete_disabled", next ? "false" : "true");
  };

  return (
    <div className="status-bar select-none">
      <span className="status-bar-item" title="Synchronization Status">
        <span className="codicon codicon-circle-filled" style={{ fontSize: 8, color: connectionStatus === 'Sincronizado!' || connectionStatus === 'Synced!' ? '#4ade80' : '#f59e0b' }} />
        {connectionStatus}
      </span>
      {activeFile && (
        <span className="status-bar-item" title="Active File">
          <span className="codicon codicon-file" style={{ fontSize: 12 }} />
          {activeFile.split('/').pop()}
        </span>
      )}
      <div className="status-bar-right">
        <span 
          className="status-bar-item cursor-pointer hover:opacity-80 transition-opacity" 
          title={aiEnabled ? "AI Autocomplete: Enabled (Click to pause)" : "AI Autocomplete: Paused (Click to enable)"}
          onClick={toggleAiAutocomplete}
        >
          <span className="codicon codicon-sparkle" style={{ fontSize: 12, color: aiEnabled ? '#38bdf8' : '#9ca3af', marginRight: 4 }} />
          {aiEnabled ? "AI Autocomplete" : "AI Paused"}
        </span>

        {(errCount > 0 || warnCount > 0) && (
          <span className="status-bar-item" title="Code Problems">
            {errCount > 0 && <><span className="codicon codicon-error" style={{ fontSize: 12 }} /> {errCount}</>}
            {warnCount > 0 && <><span className="codicon codicon-warning" style={{ fontSize: 12, marginLeft: errCount > 0 ? 6 : 0 }} /> {warnCount}</>}
          </span>
        )}
        {language && (
          <span className="status-bar-item" title="File Language">{language}</span>
        )}
        {cursorPos && (
          <span className="status-bar-item" title="Cursor Line and Column">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
        )}
        <span className="status-bar-item">CrewCode</span>
      </div>
    </div>
  );
}

export default StatusBar;
