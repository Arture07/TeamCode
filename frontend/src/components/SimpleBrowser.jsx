import React, { useState, useEffect } from 'react';

export default function SimpleBrowser({ isOpen, onClose, initialUrl = 'http://localhost:5000' }) {
  const [url, setUrl] = useState(initialUrl);
  const [inputValue, setInputValue] = useState(initialUrl);
  const [key, setKey] = useState(0); // Used to force iframe reload

  // Reset URL only if it's the very first time (or we can just leave it alone)
  useEffect(() => {
    // Empty dependency array, we don't want to reset it on every open
  }, []);

  if (!isOpen) return null;

  const handleNavigate = (e) => {
    e.preventDefault();
    let finalUrl = inputValue.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'http://' + finalUrl;
    }
    setUrl(finalUrl);
    setInputValue(finalUrl);
  };

  const handleRefresh = () => {
    setKey(prev => prev + 1);
  };

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
          className="flex items-center p-2 space-x-2 border-b-2"
          style={{
            backgroundColor: 'var(--header-bg-color)',
            borderColor: 'var(--panel-border-color)'
          }}
        >
          <div className="flex space-x-1 mr-2">
            <button
              onClick={handleRefresh}
              className="p-1.5 hover:bg-black/10 rounded transition-colors"
              title="Recarregar página"
            >
              <span className="codicon codicon-refresh text-lg" style={{ color: 'var(--primary-color)' }} />
            </button>
          </div>

          <form onSubmit={handleNavigate} className="flex-1 flex">
            <div className="relative w-full flex items-center">
              <span className="codicon codicon-globe absolute left-3 text-sm opacity-50" />
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-sm border-2 focus:outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--input-bg-color)',
                  borderColor: 'var(--panel-border-color)',
                  color: 'var(--text-color)',
                  borderRadius: '16px'
                }}
                placeholder="Digite a URL (ex: http://localhost:5000)"
              />
            </div>
          </form>

          <button
            onClick={onClose}
            className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors ml-2"
            title="Fechar Browser"
          >
            <span className="codicon codicon-close text-xl" />
          </button>
        </div>

        {/* Browser Content */}
        <div className="flex-1 bg-white relative">
          {/* Iframe for the browser */}
          <iframe
            key={key}
            src={url}
            className="w-full h-full border-0 bg-white"
            title="Internal Browser"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  );
}
