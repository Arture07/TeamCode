import React from "react";
import FileIcon from "./FileIcon";

function FileTabs({
  openFiles,
  activeFile,
  onTabClick,
  onTabClose,
  onRunFile,
  isRunning,
  onFormat,
  onOpenTimeMachine,
  spotlightHost,
  myUserId,
  onToggleSpotlight,
}) {
  return (
    <div
      className="flex-shrink-0 flex items-center overflow-x-auto border-b-2"
      style={{
        backgroundColor: "var(--header-bg-color)",
        borderColor: "var(--panel-border-color)",
      }}
    >
      <div className="flex items-end flex-1 overflow-x-auto">
        {(openFiles || []).map((file) => (
          <div
            key={file}
            onClick={() => onTabClick(file)}
            className={`flex items-center space-x-2 px-4 py-2 cursor-pointer border-r-2 ${activeFile === file ? "active-tab" : "inactive-tab"
              }`}
            style={{
              borderColor: "var(--panel-border-color)",
            }}
          >
            <div className="w-5 h-5 flex-shrink-0">
              <FileIcon fileName={file} />
            </div>
            <span className="truncate text-sm font-medium">{file}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(file);
              }}
              className="ml-2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-[var(--primary-bg-color)]"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center px-2 space-x-2">
        <button
          onClick={onToggleSpotlight}
          className={`p-1 rounded transition-colors ${spotlightHost === myUserId ? 'text-yellow-400 bg-yellow-400/20' : spotlightHost ? 'text-blue-400' : 'hover:bg-[var(--primary-bg-color)]'}`}
          title={spotlightHost === myUserId ? "Você é o Apresentador" : spotlightHost ? "Acompanhando Apresentador" : "Iniciar Modo Apresentação"}
        >
          <span className="codicon codicon-device-camera-video"></span>
        </button>
        {activeFile && (
          <button
            onClick={onOpenTimeMachine}
            className="p-1 rounded hover:bg-[var(--primary-bg-color)]"
            title="Time Machine (Histórico)"
          >
            <span className="codicon codicon-history"></span>
          </button>
        )}
        {activeFile && onFormat && (
          <button
            onClick={() => onFormat()}
            className="p-1 rounded hover:bg-[var(--primary-bg-color)]"
            title="Format Code (Prettier)"
          >
            <span className="codicon codicon-wand"></span>
          </button>
        )}
        {activeFile && onRunFile && (
          <button
            onClick={() => onRunFile(activeFile)}
            disabled={isRunning}
            className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
            style={{
              backgroundColor: "var(--primary-color)",
              color: "#fff",
            }}
            title="Run file (executes in terminal)"
          >
            {isRunning ? (
              <span className="codicon codicon-loading codicon-modifier-spin"></span>
            ) : (
              <span className="codicon codicon-play"></span>
            )}
            <span className="font-medium">
              {isRunning ? "Running..." : "Run"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export default FileTabs;
