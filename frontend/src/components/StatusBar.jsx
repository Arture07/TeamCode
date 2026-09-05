import React, { useState } from "react";
import { useTranslation } from "../contexts/LanguageContext";

function StatusBar({ activeFile, cursorPos, language, connectionStatus, problems }) {
  const { t } = useTranslation();
  const errCount = (problems || []).filter(p => p.severity === 'error').length;
  const warnCount = (problems || []).filter(p => p.severity === 'warning').length;

  const [aiEnabled, setAiEnabled] = useState(() => localStorage.getItem("ai_autocomplete_disabled") !== "true");

  const toggleAiAutocomplete = () => {
    const next = !aiEnabled;
    setAiEnabled(next);
    localStorage.setItem("ai_autocomplete_disabled", next ? "false" : "true");
  };

  const isSynced = connectionStatus === 'Sincronizado!' || connectionStatus === 'Synced!';

  return (
    <div className="status-bar select-none">
      <span className="status-bar-item" title={t("statusBar.syncStatus")}>
        <span className="codicon codicon-circle-filled" style={{ fontSize: 8, color: isSynced ? '#4ade80' : '#f59e0b' }} />
        {isSynced ? t("header.synced") : t("header.syncing")}
      </span>
      {activeFile && (
        <span className="status-bar-item" title={t("statusBar.activeFile")}>
          <span className="codicon codicon-file" style={{ fontSize: 12 }} />
          {activeFile.split('/').pop()}
        </span>
      )}
      <div className="status-bar-right">
        <span 
          className="status-bar-item cursor-pointer hover:opacity-80 transition-opacity" 
          title={aiEnabled ? t("statusBar.aiAutocompleteEnabled") : t("statusBar.aiAutocompletePaused")}
          onClick={toggleAiAutocomplete}
        >
          <span className="codicon codicon-sparkle" style={{ fontSize: 12, color: aiEnabled ? '#38bdf8' : '#9ca3af', marginRight: 4 }} />
          {aiEnabled ? t("statusBar.aiAutocomplete") : t("statusBar.aiPaused")}
        </span>

        {(errCount > 0 || warnCount > 0) && (
          <span className="status-bar-item" title={t("statusBar.codeProblems")}>
            {errCount > 0 && <><span className="codicon codicon-error" style={{ fontSize: 12 }} /> {errCount}</>}
            {warnCount > 0 && <><span className="codicon codicon-warning" style={{ fontSize: 12, marginLeft: errCount > 0 ? 6 : 0 }} /> {warnCount}</>}
          </span>
        )}
        {language && (
          <span className="status-bar-item" title={t("statusBar.fileLanguage")}>{language}</span>
        )}
        {cursorPos && (
          <span className="status-bar-item" title={t("statusBar.cursorPosition")}>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
        )}
        <span className="status-bar-item">CodeSync</span>
      </div>
    </div>
  );
}

export default StatusBar;
