import React from "react";

function ActivityBar({
  showSidebar,
  setShowSidebar,
  activeSidebarTab,
  setActiveSidebarTab,
  setSearchModalOpen,
  handleOpenAIModal,
  isBrowserOpen,
  setIsBrowserOpen,
  setShareModalOpen,
  setAccountModalOpen,
  setThemeModalOpen,
}) {
  return (
    <div
      className="w-16 flex-shrink-0 flex flex-col items-center py-3 border-r-2 z-20"
      style={{
        backgroundColor: "var(--header-bg-color)",
        borderColor: "var(--panel-border-color)",
      }}
    >
      {/* Top buttons */}
      <button
        onClick={() => {
          if (activeSidebarTab === 'EXPLORER' && showSidebar) {
            setShowSidebar(false);
          } else {
            setActiveSidebarTab('EXPLORER');
            setShowSidebar(true);
          }
        }}
        className={`p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors ${showSidebar && activeSidebarTab === 'EXPLORER' ? "border-l-2 border-[var(--primary-color)]" : ""}`}
        title="Explorer"
        style={{
          color: showSidebar && activeSidebarTab === 'EXPLORER'
            ? "var(--primary-color)"
            : "var(--text-muted-color)",
        }}
      >
        <span
          className="codicon codicon-files"
          style={{ fontSize: "28px" }}
        ></span>
      </button>
      <button
        onClick={() => {
          if (activeSidebarTab === 'GIT' && showSidebar) {
            setShowSidebar(false);
          } else {
            setActiveSidebarTab('GIT');
            setShowSidebar(true);
          }
        }}
        className={`p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors ${showSidebar && activeSidebarTab === 'GIT' ? "border-l-2 border-[var(--primary-color)]" : ""}`}
        title="Source Control"
        style={{
          color: showSidebar && activeSidebarTab === 'GIT'
            ? "var(--primary-color)"
            : "var(--text-muted-color)",
        }}
      >
        <span
          className="codicon codicon-source-control"
          style={{ fontSize: "28px" }}
        ></span>
      </button>
      <button
        onClick={() => {
          if (activeSidebarTab === 'DEBUG' && showSidebar) {
            setShowSidebar(false);
          } else {
            setActiveSidebarTab('DEBUG');
            setShowSidebar(true);
          }
        }}
        className={`p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors ${showSidebar && activeSidebarTab === 'DEBUG' ? "border-l-2 border-[var(--primary-color)]" : ""}`}
        title="Executar e Depurar (Run and Debug)"
        style={{
          color: showSidebar && activeSidebarTab === 'DEBUG'
            ? "var(--primary-color)"
            : "var(--text-muted-color)",
        }}
      >
        <span
          className="codicon codicon-debug-alt"
          style={{ fontSize: "28px" }}
        ></span>
      </button>
      <button
        onClick={() => setSearchModalOpen(true)}
        className="p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors"
        title="Search"
        style={{ color: "var(--text-muted-color)" }}
      >
        <span
          className="codicon codicon-search"
          style={{ fontSize: "28px" }}
        ></span>
      </button>
      <button
        onClick={() => handleOpenAIModal()}
        className="p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors"
        title="AI Assistant"
        style={{ color: "var(--text-muted-color)" }}
      >
        <span
          className="codicon codicon-robot"
          style={{ fontSize: "28px" }}
        ></span>
      </button>
      <button
        onClick={() => setIsBrowserOpen(true)}
        className={`p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors ${isBrowserOpen ? "border-l-2 border-[var(--primary-color)]" : ""}`}
        title="Browser Interno"
        style={{ color: isBrowserOpen ? "var(--primary-color)" : "var(--text-muted-color)" }}
      >
        <span
          className="codicon codicon-browser"
          style={{ fontSize: "28px" }}
        ></span>
      </button>

      {/* Spacer */}
      <div className="flex-grow"></div>

      {/* Bottom buttons */}
      <button
        onClick={() => setShareModalOpen(true)}
        className="p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors"
        title="Share Room Link"
        style={{ color: "var(--text-muted-color)" }}
      >
        <span
          className="codicon codicon-share"
          style={{ fontSize: "28px" }}
        ></span>
      </button>
      <button
        onClick={() => setAccountModalOpen(true)}
        className="p-1 mb-3 rounded hover:bg-[var(--input-bg-color)] transition-colors"
        title="Account"
        style={{ color: "var(--text-muted-color)" }}
      >
        <span
          className="codicon codicon-account"
          style={{ fontSize: "28px" }}
        ></span>
      </button>
      <button
        onClick={() => setThemeModalOpen(true)}
        className="p-1 rounded hover:bg-[var(--input-bg-color)] transition-colors"
        title="Settings"
        style={{ color: "var(--text-muted-color)" }}
      >
        <span
          className="codicon codicon-settings-gear"
          style={{ fontSize: "28px" }}
        ></span>
      </button>
    </div>
  );
}

export default ActivityBar;
