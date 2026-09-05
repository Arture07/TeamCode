import React, { useState, useEffect, useCallback } from 'react';

/**
 * Normaliza URLs digitadas para funcionar tanto localmente quanto em VMs remotas (OCI)
 * Convertendo referências a localhost:PORTA para /port/PORTA/ via Nginx reverse proxy.
 */
function resolveBrowserUrl(input) {
  if (!input) return '/port/3000/';
  const trimmed = input.trim();

  // Caso seja apenas o número da porta (ex: "3000", "5000")
  if (/^\d{2,5}$/.test(trimmed)) {
    return `/port/${trimmed}/`;
  }

  // Se já for uma rota /port/XXXX
  if (trimmed.startsWith('/port/')) {
    return trimmed;
  }

  // Detecta localhost ou 127.0.0.1 com porta (ex: "http://localhost:3000/api", "localhost:3000")
  const localhostMatch = trimmed.match(/^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1):(\d{2,5})(\/.*)?$/i);
  if (localhostMatch) {
    const port = localhostMatch[1];
    const path = localhostMatch[2] || '/';
    return `/port/${port}${path}`;
  }

  // URLs externas padrão
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
    return 'http://' + trimmed;
  }

  return trimmed;
}

export default function SimpleBrowser({ isOpen, onClose, initialUrl = 'http://localhost:3000' }) {
  const [inputValue, setInputValue] = useState(initialUrl);
  const [iframeUrl, setIframeUrl] = useState(() => resolveBrowserUrl(initialUrl));
  const [key, setKey] = useState(0); // Força recarregamento do iframe

  // Sincroniza initialUrl quando o modal é aberto
  useEffect(() => {
    if (isOpen) {
      const resolved = resolveBrowserUrl(initialUrl);
      setInputValue(initialUrl);
      setIframeUrl(resolved);
    }
  }, [isOpen, initialUrl]);

  // Listener para fechar com a tecla ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNavigate = useCallback((e) => {
    if (e) e.preventDefault();
    const resolved = resolveBrowserUrl(inputValue);
    setIframeUrl(resolved);
    setKey(prev => prev + 1);
  }, [inputValue]);

  const navigateToPort = (port) => {
    setInputValue(`http://localhost:${port}`);
    setIframeUrl(`/port/${port}/`);
    setKey(prev => prev + 1);
  };

  const handleRefresh = () => {
    setKey(prev => prev + 1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
      <div
        className="w-full max-w-6xl h-[85vh] flex flex-col border-2 glass-panel neo-shadow overflow-hidden"
        style={{
          backgroundColor: 'var(--panel-bg-color)',
          borderColor: 'var(--panel-border-color)',
          color: 'var(--text-color)'
        }}
      >
        {/* Browser Toolbar */}
        <div
          className="flex items-center p-2 space-x-2 border-b-2 flex-wrap gap-y-2"
          style={{
            backgroundColor: 'var(--header-bg-color)',
            borderColor: 'var(--panel-border-color)'
          }}
        >
          <div className="flex space-x-1 mr-1">
            <button
              onClick={handleRefresh}
              className="p-1.5 hover:bg-black/10 rounded transition-colors"
              title="Reload page (F5)"
            >
              <span className="codicon codicon-refresh text-lg" style={{ color: 'var(--primary-color)' }} />
            </button>
          </div>

          {/* Quick Port Shortcuts */}
          <div className="flex items-center space-x-1 mr-2">
            {[3000, 5000, 8000, 8080].map((port) => (
              <button
                key={port}
                onClick={() => navigateToPort(port)}
                className={`px-2 py-0.5 text-xs font-mono font-bold rounded border transition-all ${
                  iframeUrl.includes(`/port/${port}/`) || inputValue.includes(`:${port}`)
                    ? 'bg-[var(--primary-color)] text-black border-[var(--primary-color)]'
                    : 'bg-[var(--input-bg-color)] border-[var(--panel-border-color)] opacity-80 hover:opacity-100'
                }`}
                title={`Open port ${port}`}
              >
                :{port}
              </button>
            ))}
          </div>

          <form onSubmit={handleNavigate} className="flex-1 flex min-w-[240px]">
            <div className="relative w-full flex items-center">
              <span className="codicon codicon-globe absolute left-3 text-sm opacity-50" />
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-sm border-2 focus:outline-none transition-colors font-mono"
                style={{
                  backgroundColor: 'var(--input-bg-color)',
                  borderColor: 'var(--panel-border-color)',
                  color: 'var(--text-color)',
                  borderRadius: '16px'
                }}
                placeholder="Ex: http://localhost:3000 or 3000"
              />
            </div>
          </form>

          <button
            onClick={onClose}
            className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors ml-2"
            title="Close Browser (ESC)"
          >
            <span className="codicon codicon-close text-xl" />
          </button>
        </div>

        {/* Browser Content */}
        <div className="flex-1 bg-white relative">
          <iframe
            key={key}
            src={iframeUrl}
            className="w-full h-full border-0 bg-white"
            title="Internal Browser"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          />
        </div>
      </div>
    </div>
  );
}
