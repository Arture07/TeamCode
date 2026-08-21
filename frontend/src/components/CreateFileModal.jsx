import React, { useState, useEffect } from "react";
import { LANGUAGES } from "../utils/languages";

export default function CreateFileModal({
  isOpen,
  onClose,
  onCreate,
  folders = [],
  defaultParent = "",
  defaultType = "file",
}) {
  const [fileName, setFileName] = useState("");
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [type, setType] = useState(defaultType); // 'file' or 'folder'
  const [parentFolder, setParentFolder] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFileName("");
      setSelectedLang(LANGUAGES[0]);
      setType(defaultType || "file");
      setParentFolder(defaultParent.replace(/\/+$/, ""));
    }
  }, [isOpen, defaultParent, defaultType]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!fileName.trim()) return;
    if (type === "folder") {
      const folderName = fileName.endsWith("/") ? fileName : `${fileName}/`;
      onCreate({ name: folderName, type: "folder" });
      return;
    }
    const baseName = fileName.endsWith(selectedLang.extension)
      ? fileName
      : `${fileName}${selectedLang.extension}`;
    const finalName = parentFolder
      ? `${parentFolder.replace(/\/+$/, "")}/${baseName}`
      : baseName;
    onCreate({
      name: finalName,
      language: selectedLang.name,
      type: "file",
      parent: parentFolder,
    });
  };

  const isFolder = type === "folder";

  const getPreviewPath = () => {
    let name = fileName.trim() || (isFolder ? "nova-pasta" : "novo-arquivo");
    if (!isFolder && !name.endsWith(selectedLang.extension)) {
      name += selectedLang.extension;
    }
    const parent = parentFolder ? parentFolder.replace(/\/+$/, "") : "";
    return parent ? `/${parent}/${name}` : `/${name}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div
        className="w-full max-w-lg overflow-hidden transform transition-all glass-panel neo-shadow border-2"
        style={{
          backgroundColor: "var(--panel-bg-color)",
          borderColor: "var(--panel-border-color)",
        }}
      >
        <div className="px-6 py-4 border-b flex items-center space-x-2" style={{ borderColor: "var(--panel-border-color)" }}>
          <span className={`codicon ${isFolder ? 'codicon-new-folder' : 'codicon-new-file'} text-xl`} style={{ color: "var(--primary-color)" }}></span>
          <h2 className="text-xl font-semibold" style={{ color: "var(--text-color)" }}>
            {isFolder ? 'Criar Nova Pasta' : 'Criar Novo Arquivo'}
          </h2>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-muted-color)" }}>
                Tipo
              </label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-10 py-2.5 border-2 appearance-none focus:outline-none focus:ring-2 transition-all cursor-pointer"
                  style={{
                    backgroundColor: "var(--input-bg-color)",
                    borderColor: "var(--panel-border-color)",
                    color: "var(--text-color)",
                    "--tw-ring-color": "var(--primary-color)",
                  }}
                >
                  <option value="file">Arquivo</option>
                  <option value="folder">Pasta</option>
                </select>
                <span className={`absolute left-3 top-3 text-lg codicon ${isFolder ? 'codicon-folder' : 'codicon-file'}`} style={{ color: "var(--text-muted-color)" }}></span>
                <span className="absolute right-3 top-3 text-lg codicon codicon-chevron-down pointer-events-none" style={{ color: "var(--text-muted-color)" }}></span>
              </div>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-muted-color)" }}>
                Local (Pasta Pai)
              </label>
              <div className="relative">
                <select
                  value={parentFolder}
                  onChange={(e) => setParentFolder(e.target.value)}
                  className="w-full px-10 py-2.5 border-2 appearance-none focus:outline-none focus:ring-2 transition-all cursor-pointer"
                  style={{
                    backgroundColor: "var(--input-bg-color)",
                    borderColor: "var(--panel-border-color)",
                    color: "var(--text-color)",
                    "--tw-ring-color": "var(--primary-color)",
                  }}
                >
                  <option value="">/ (Raiz)</option>
                  {folders.map((f) => (
                    <option key={f} value={f.replace(/\/+$/, "")}>
                      /{f.replace(/\/+$/, "")}
                    </option>
                  ))}
                </select>
                <span className="absolute left-3 top-3 text-lg codicon codicon-folder-opened" style={{ color: "var(--text-muted-color)" }}></span>
                <span className="absolute right-3 top-3 text-lg codicon codicon-chevron-down pointer-events-none" style={{ color: "var(--text-muted-color)" }}></span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-muted-color)" }}>
              Nome {isFolder ? 'da Pasta' : 'do Arquivo'}
            </label>
            <div className="flex items-center overflow-hidden border-2 focus-within:ring-2 transition-all"
              style={{
                borderColor: "var(--panel-border-color)",
                "--tw-ring-color": "var(--primary-color)",
              }}>
              <input
                autoFocus
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder={isFolder ? "minha-pasta" : "meu-arquivo"}
                className="flex-grow px-4 py-3 focus:outline-none w-full"
                style={{
                  backgroundColor: "var(--input-bg-color)",
                  color: "var(--text-color)",
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              {!isFolder && (
                <div className="border-l-2 relative" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--panel-bg-color)" }}>
                  <select
                    value={selectedLang.extension}
                    onChange={(e) => setSelectedLang(LANGUAGES.find((l) => l.extension === e.target.value))}
                    className="h-full pl-3 pr-8 py-3 focus:outline-none appearance-none cursor-pointer bg-transparent font-mono text-sm"
                    style={{ color: "var(--text-color)" }}
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.extension} value={lang.extension} style={{ backgroundColor: "var(--panel-bg-color)" }}>
                        {lang.extension}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm codicon codicon-chevron-down pointer-events-none" style={{ color: "var(--text-muted-color)" }}></span>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg border text-sm flex items-center gap-2"
            style={{ backgroundColor: "rgba(0,0,0,0.1)", borderColor: "var(--panel-border-color)", color: "var(--text-muted-color)" }}>
            <span className="codicon codicon-info text-blue-500"></span>
            <span>Será criado em: <code className="font-mono text-blue-400">{getPreviewPath()}</code></span>
          </div>
        </div>

        <div className="px-6 py-4 border-t-2 flex justify-end space-x-4 bg-opacity-50" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "rgba(0,0,0,0.1)" }}>
          <button
            onClick={onClose}
            className="px-6 py-2 font-bold border-2 neo-shadow-button transition-colors hover:bg-gray-500/20"
            style={{ color: "var(--text-color)", borderColor: "var(--panel-border-color)" }}
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!fileName.trim()}
            className={`px-8 py-2 font-bold border-2 neo-shadow-button flex items-center gap-2 transition-all ${!fileName.trim() ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:scale-95'}`}
            style={{
              backgroundColor: "var(--button-bg-color, var(--primary-color))",
              color: "var(--button-text-color, #ffffff)",
              borderColor: "var(--panel-border-color)",
            }}
          >
            <span className="codicon codicon-check"></span>
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}
