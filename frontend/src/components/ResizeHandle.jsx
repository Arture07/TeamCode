import React from "react";

function ResizeHandle({ onMouseDown }) {
  return (
    <div
      className="w-3 flex-shrink-0 cursor-col-resize hover:bg-[var(--primary-color)] transition-colors"
      style={{
        backgroundColor: "var(--panel-border-color)",
        marginLeft: "-1px",
        marginRight: "-1px",
      }}
      onMouseDown={onMouseDown}
    />
  );
}

export default ResizeHandle;
