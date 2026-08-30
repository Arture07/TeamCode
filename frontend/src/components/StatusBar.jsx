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
      <span className="status-bar-item" title="Status de Sincronização">
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
        <span 
          className="status-bar-item cursor-pointer hover:opacity-80 transition-opacity" 
          title={aiEnabled ? "IA Autocomplete: Ativado (Clique para pausar)" : "IA Autocomplete: Pausado (Clique para ativar)"}
          onClick={toggleAiAutocomplete}
        >
          <span className="codicon codicon-sparkle" style={{ fontSize: 12, color: aiEnabled ? '#38bdf8' : '#9ca3af', marginRight: 4 }} />
          {aiEnabled ? "IA Autocomplete" : "IA Pausada"}
        </span>

        {(errCount > 0 || warnCount > 0) && (
          <span className="status-bar-item" title="Problemas no código">
            {errCount > 0 && <><span className="codicon codicon-error" style={{ fontSize: 12 }} /> {errCount}</>}
            {warnCount > 0 && <><span className="codicon codicon-warning" style={{ fontSize: 12, marginLeft: errCount > 0 ? 6 : 0 }} /> {warnCount}</>}
          </span>
        )}
        {language && (
          <span className="status-bar-item" title="Linguagem do arquivo">{language}</span>
        )}
        {cursorPos && (
          <span className="status-bar-item" title="Linha e coluna do cursor">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
        )}
        <span className="status-bar-item">CodeSync</span>
      </div>
    </div>
  );
}

export default StatusBar;
