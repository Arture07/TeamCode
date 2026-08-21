import React from "react";

function StatusBar({ activeFile, cursorPos, language, connectionStatus, problems }) {
  const errCount = problems.filter(p => p.severity === 'error').length;
  const warnCount = problems.filter(p => p.severity === 'warning').length;
  return (
    <div className="status-bar">
      <span className="status-bar-item" title="Status">
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
        {(errCount > 0 || warnCount > 0) && (
          <span className="status-bar-item" title="Problemas">
            {errCount > 0 && <><span className="codicon codicon-error" style={{ fontSize: 12 }} /> {errCount}</>}
            {warnCount > 0 && <><span className="codicon codicon-warning" style={{ fontSize: 12, marginLeft: errCount > 0 ? 6 : 0 }} /> {warnCount}</>}
          </span>
        )}
        {language && (
          <span className="status-bar-item" title="Linguagem">{language}</span>
        )}
        {cursorPos && (
          <span className="status-bar-item" title="Linha e coluna">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
        )}
        <span className="status-bar-item">TeamCode</span>
      </div>
    </div>
  );
}

export default StatusBar;
