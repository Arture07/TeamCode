import React, { useState, useEffect, useRef } from "react";

const COMMANDS = [
  { id: 'search', label: 'Busca Global', icon: 'codicon-search', shortcut: 'Ctrl+Shift+F', action: 'openSearch' },
  { id: 'newfile', label: 'Novo Arquivo', icon: 'codicon-new-file', shortcut: 'A', action: 'newFile' },
  { id: 'newfolder', label: 'Nova Pasta', icon: 'codicon-new-folder', shortcut: 'Shift+A', action: 'newFolder' },
  { id: 'ai', label: 'Assistente AI', icon: 'codicon-robot', shortcut: '', action: 'openAI' },
  { id: 'preview', label: 'Toggle Preview', icon: 'codicon-browser', shortcut: '', action: 'togglePreview' },
  { id: 'terminal', label: 'Toggle Terminal', icon: 'codicon-terminal', shortcut: '', action: 'toggleTerminal' },
  { id: 'chat', label: 'Toggle Chat', icon: 'codicon-comment-discussion', shortcut: '', action: 'toggleChat' },
  { id: 'sidebar', label: 'Toggle Sidebar', icon: 'codicon-files', shortcut: '', action: 'toggleSidebar' },
  { id: 'format', label: 'Formatar Código (Prettier)', icon: 'codicon-wand', shortcut: '', action: 'formatCode' },
  { id: 'reset', label: 'Restaurar Layout', icon: 'codicon-layout', shortcut: '', action: 'resetLayout' },
  { id: 'download', label: 'Baixar Projeto', icon: 'codicon-cloud-download', shortcut: '', action: 'download' },
  { id: 'share', label: 'Compartilhar Link', icon: 'codicon-share', shortcut: '', action: 'openShare' },
  { id: 'settings', label: 'Configurações / Tema', icon: 'codicon-settings-gear', shortcut: '', action: 'openSettings' },
  { id: 'account', label: 'Conta', icon: 'codicon-account', shortcut: '', action: 'openAccount' },
  { id: 'logout', label: 'Sair (Logout)', icon: 'codicon-sign-out', shortcut: '', action: 'logout' },
];

function CommandPalette({ isOpen, onClose, onExecute }) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = query.trim()
    ? COMMANDS.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : COMMANDS;

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault();
      onExecute(filtered[selectedIdx].action);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[9000] pt-24 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl border-2 glass-panel neo-shadow overflow-hidden"
        style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b-2" style={{ borderColor: 'var(--panel-border-color)' }}>
          <span className="codicon codicon-chevron-right mr-2 opacity-60" style={{ color: 'var(--primary-color)' }} />
          <input
            ref={inputRef}
            id="command-palette-input"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Digite um comando..."
            className="flex-grow bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-color)' }}
          />
          <span className="text-xs opacity-40 ml-2">ESC para fechar</span>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
          {filtered.length === 0 ? (
            <div className="p-4 text-center opacity-50 text-sm" style={{ color: 'var(--text-muted-color)' }}>
              Nenhum comando encontrado
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <button
                key={cmd.id}
                id={`cmd-${cmd.id}`}
                onClick={() => { onExecute(cmd.action); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors text-sm ${idx === selectedIdx ? 'bg-[var(--primary-bg-color)]' : 'hover:bg-[var(--input-bg-color)]'}`}
                style={{ color: 'var(--text-color)' }}
              >
                <span className={`codicon ${cmd.icon} flex-shrink-0`} style={{ color: 'var(--primary-color)', fontSize: 16 }} />
                <span className="flex-grow">{cmd.label}</span>
                {cmd.shortcut && (
                  <span className="text-xs opacity-50 font-mono flex-shrink-0" style={{ color: 'var(--text-muted-color)' }}>
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
