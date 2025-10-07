// frontend/src/App.jsx
import React, { useState, useEffect, useRef, createContext, useContext, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import './index.css';

// --- Theme Management ---
const themes = {
    'neobrutalism-dark': 'Neo Brutalism (Dark)',
    neobrutalism: 'Neo Brutalism (Light)',
    'aurora-light': 'Aurora (Light)',
    aurora: 'Aurora (Dark)',
    'cyber_glass-light': 'Cyber Glass (Light)',
    cyber_glass: 'Cyber Glass (Dark)',
};
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(localStorage.getItem('teamcode-theme') || 'neobrutalism-dark');

    useEffect(() => {
        localStorage.setItem('teamcode-theme', theme);
        document.body.className = '';
        document.body.classList.add(`theme-${theme}`);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

const useTheme = () => useContext(ThemeContext);

// --- UTILS ---
const LANGUAGES = [
    { name: 'JavaScript', extension: '.js' }, { name: 'Python', extension: '.py' },
    { name: 'Java', extension: '.java' }, { name: 'HTML', extension: '.html' },
    { name: 'CSS', extension: '.css' }, { name: 'Markdown', extension: '.md' },
    { name: 'JSON', extension: '.json' }, { name: 'TypeScript', extension: '.ts' },
    { name: 'Shell Script', extension: '.sh' },
];

const getLanguageFromExtension = (fileName) => {
    if (!fileName) return 'plaintext';
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
        case 'js': case 'jsx': return 'javascript';
        case 'ts': case 'tsx': return 'typescript';
        case 'py': return 'python';
        case 'java': return 'java';
        case 'html': return 'html';
        case 'css': return 'css';
        case 'json': return 'json';
        case 'md': return 'markdown';
        case 'sh': return 'shell';
        default: return 'plaintext';
    }
};

function FileIcon({ fileName }) {
    const { theme } = useTheme();
    if (!fileName) return null;

    const extension = fileName.split('.').pop().toLowerCase();
    const iconMap = {
        js: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg',
        py: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg',
        java: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg',
        html: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg',
        css: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg',
        md: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/markdown/markdown-original.svg',
        json: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/json/json-original.svg',
        ts: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg',
        sh: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/bash/bash-original.svg',
    };
    const iconUrl = iconMap[extension];
    
    const needsInvert = theme.includes('dark');
    const style = needsInvert ? { filter: 'invert(1) grayscale(1) brightness(2)' } : {};

    return iconUrl ? <img src={iconUrl} alt={extension} className="w-5 h-5" style={style} /> : <div className="w-5 h-5 bg-gray-300" />;
};


// --- HELPERS ---
const getAuthHeaders = () => {
    const token = localStorage.getItem('jwtToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
};

const useDebounce = (value, delay) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
};


// --- COMPONENTS ---

function ThemeSwitcher() {
    const { theme, setTheme } = useTheme();
    return (
        <div className="relative">
            <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="p-2 rounded-md appearance-none"
                style={{
                    backgroundColor: 'var(--input-bg-color)',
                    color: 'var(--text-color)',
                    border: '2px solid var(--panel-border-color)'
                }}
            >
                {Object.entries(themes).map(([key, name]) => (
                    <option key={key} value={key} style={{backgroundColor: 'var(--bg-color)', color: 'var(--text-color)'}}>{name}</option>
                ))}
            </select>
        </div>
    );
}

function EnhancedCreateFileModal({ isOpen, onClose, onCreate, folders = [] }) {
    const [fileName, setFileName] = useState('');
    const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
    const [type, setType] = useState('file'); // 'file' or 'folder'
    const [parentFolder, setParentFolder] = useState('');

    useEffect(() => {
        if (isOpen) {
            setFileName('');
            setSelectedLang(LANGUAGES[0]);
            setType('file');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCreate = () => {
        if (!fileName.trim()) return;
        if (type === 'folder') {
            const folderName = fileName.endsWith('/') ? fileName : `${fileName}/`;
            onCreate({ name: folderName, type: 'folder' });
            return;
        }
        const baseName = fileName.endsWith(selectedLang.extension) ? fileName : `${fileName}${selectedLang.extension}`;
        const finalName = parentFolder ? `${parentFolder.replace(/\/+$/, '')}/${baseName}` : baseName;
        onCreate({ name: finalName, language: selectedLang.name, type: 'file', parent: parentFolder });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                className="p-8 w-full max-w-lg space-y-6 border-2 glass-panel neo-shadow"
                style={{
                    backgroundColor: 'var(--panel-bg-color)',
                    borderColor: 'var(--panel-border-color)',
                    color: 'var(--text-color)'
                }}
            >
                <h2 className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>Criar Novo Arquivo</h2>
                <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 mr-2">
                        <label className="text-sm" style={{ color: 'var(--text-muted-color)' }}>Tipo</label>
                        <select value={type} onChange={(e) => setType(e.target.value)} className="px-2 py-2 border-2" style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', color: 'var(--text-color)'}}>
                            <option value="file">Arquivo</option>
                            <option value="folder">Pasta</option>
                        </select>
                    </div>
                    {type === 'file' && (
                        <div className="flex items-center space-x-2 flex-grow">
                            <input
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                placeholder="nome-do-arquivo"
                                className="flex-grow px-4 py-3 border-2 focus:outline-none focus:ring-2"
                                style={{
                                    backgroundColor: 'var(--input-bg-color)',
                                    borderColor: 'var(--panel-border-color)',
                                    '--tw-ring-color': 'var(--primary-color)',
                                    color: 'var(--text-color)',
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            />

                            <select
                                value={selectedLang.extension}
                                onChange={(e) => setSelectedLang(LANGUAGES.find(l => l.extension === e.target.value))}
                                className="border-2 px-3 py-2 focus:outline-none appearance-none extension-select"
                                style={{
                                    backgroundColor: 'var(--input-bg-color)',
                                    borderColor: 'var(--panel-border-color)',
                                    color: 'var(--text-color)',
                                    minWidth: '64px'
                                }}
                            >
                                {LANGUAGES.map(lang => (
                                    <option key={lang.extension} value={lang.extension} style={{backgroundColor: 'var(--panel-bg-color)', color: 'var(--text-color)'}}>
                                        {lang.extension}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {type === 'folder' && (
                        <input
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            placeholder="nome-da-pasta"
                            className="flex-grow px-4 py-3 border-2 focus:outline-none focus:ring-2"
                            style={{
                                backgroundColor: 'var(--input-bg-color)',
                                borderColor: 'var(--panel-border-color)',
                                '--tw-ring-color': 'var(--primary-color)',
                                color: 'var(--text-color)',
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                    )}
                </div>
                {type === 'file' && (
                    <div className="mt-2">
                        <label className="text-sm" style={{ color: 'var(--text-muted-color)' }}>Pasta</label>
                        <select value={parentFolder} onChange={(e) => setParentFolder(e.target.value)} className="w-full mt-1 p-2 border-2" id="parent-folder-select">
                            <option value="">(Raiz)</option>
                            {folders.map(f => (
                                <option key={f} value={f.replace(/\/+$/,'')}>{f.replace(/\/+$/,'')}/</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="flex justify-end space-x-4 pt-4">
                    <button onClick={onClose} className="px-6 py-2 font-bold border-2 neo-shadow-button" style={{ borderColor: 'var(--panel-border-color)'}}>Cancelar</button>
                    <button onClick={handleCreate} className="px-8 py-2 font-bold border-2 neo-shadow-button" style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)', borderColor: 'var(--panel-border-color)'}}>Criar</button>
                </div>
            </div>
        </div>
    );
}

function TerminalComponent({ sessionId, stompClient, registerApi }) {
    const { theme } = useTheme();
    const termRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;
        
        if(termRef.current) {
            termRef.current.dispose();
        }

        const terminalThemes = {
            'neobrutalism-dark': { background: '#1E1E1E', foreground: '#FF8C00', cursor: '#FF8C00' },
            neobrutalism: { background: '#000000', foreground: '#FF8C00', cursor: '#FF8C00' },
            'aurora-light': { background: '#111827', foreground: '#E5E7EB', cursor: '#D946EF' },
            aurora: { background: 'transparent', foreground: '#e5e7eb', cursor: '#FF00FF' },
            'cyber_glass-light': { background: '#0f172a', foreground: '#E2E8F0', cursor: '#0284c7' },
            cyber_glass: { background: 'transparent', foreground: '#e2e8f0', cursor: '#38BDF8' },
        };

        const term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: 'Fira Code, monospace',
            theme: terminalThemes[theme],
            allowTransparency: theme.includes('aurora') || theme.includes('cyber_glass')
        });

        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(containerRef.current);
        fit.fit();

        const onDataDisposable = term.onData((d) => {
            if (stompClient?.connected) {
                try { stompClient.publish({ destination: `/app/terminal.in/${sessionId}`, body: JSON.stringify({ input: d }) }); } catch (_) {}
            }
        });

        termRef.current = term;

        if (typeof registerApi === 'function') {
            registerApi({
                write: (data) => { if (termRef.current) termRef.current.write(data); },
                clear: () => { try { termRef.current?.clear(); } catch (_) {} },
                fit: () => { try { fit.fit(); } catch (_) {} }
            });
        }
        
        const handleResize = () => fit.fit();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            onDataDisposable.dispose();
            term.dispose(); 
        };
    }, [theme, sessionId, stompClient]); 

    useEffect(() => {
        if (stompClient?.connected) {
            try { stompClient.publish({ destination: `/app/terminal.start/${sessionId}` }); } catch (_) {}
        }
    }, [stompClient, sessionId]);

    return <div ref={containerRef} className="h-full w-full" />;
}


function AuthPage({ onLoginSuccess }) {
    const [isLoginView, setIsLoginView] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true); setError(null);
        const url = isLoginView ? '/api/users/login' : '/api/users/register';
        const body = isLoginView ? { username, password } : { username, email, password };
        try {
            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const text = await res.text();
            if (!res.ok) throw new Error(text || `Erro ${res.status}`);
            if (isLoginView) {
                const { token } = JSON.parse(text);
                localStorage.setItem('jwtToken', token);
                localStorage.setItem('username', username);
                onLoginSuccess();
            } else {
                setIsLoginView(true);
                setError('Registro realizado! Faça o login.');
            }
        } catch (err) { setError(err.message); } finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500">
            <div className="absolute top-6 right-6">
                <ThemeSwitcher />
            </div>
            <div className="w-full max-w-md p-8 space-y-6 border-2 glass-panel neo-shadow" style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)'}}>
                <div className="text-center">
                    <h1 className="text-4xl font-bold" style={{ color: 'var(--primary-color)' }}>TeamCode</h1>
                    <p className="mt-2" style={{ color: 'var(--text-muted-color)' }}>{isLoginView ? 'Bem-vindo de volta!' : 'Crie sua conta'}</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nome de usuário" required 
                        className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2" 
                        style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', '--tw-ring-color': 'var(--primary-color)', color: 'var(--text-color)'}}
                    />
                    {!isLoginView && <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required 
                        className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2" 
                        style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', '--tw-ring-color': 'var(--primary-color)', color: 'var(--text-color)'}}
                    />}
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required 
                        className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2" 
                        style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', '--tw-ring-color': 'var(--primary-color)', color: 'var(--text-color)'}}
                    />
                    <button type="submit" disabled={isLoading} 
                        className="w-full font-bold py-3 border-2 disabled:opacity-50 neo-shadow-button"
                        style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)', borderColor: 'var(--panel-border-color)'}}
                    >
                        {isLoading ? 'Processando...' : (isLoginView ? 'Entrar' : 'Registrar')}
                    </button>
                </form>
                {error && <div className="p-3 border-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.5)', color: 'rgb(252, 165, 165)'}}>{error}</div>}
                <p className="text-center text-sm" style={{ color: 'var(--text-muted-color)' }}>
                    {isLoginView ? 'Não tem conta?' : 'Já tem conta?'}
                    <button type="button" onClick={() => { setIsLoginView(!isLoginView); setError(null); }} className="font-bold underline ml-2" style={{ color: 'var(--primary-color)' }}>{isLoginView ? 'Registre-se' : 'Faça o login'}</button>
                </p>
            </div>
        </div>
    );
}

function HomePage() {
    const [sessionName, setSessionName] = useState('');
    const [createdSession, setCreatedSession] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleCreateSession = async () => {
        if (!sessionName.trim()) { setError('Por favor, insira um nome para a sessão.'); return; }
        setIsLoading(true); setError(null); setCreatedSession(null);
        try {
            const res = await fetch('/api/sessions', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ sessionName }) });
            if (!res.ok) throw new Error(`Erro na API (${res.status})`);
            const data = await res.json();
            setCreatedSession(data);
        } catch (err) { console.error(err); setError('Não foi possível conectar ao serviço de sessão.'); } finally { setIsLoading(false); }
    };

    const getEditorLink = () => {
        if (!createdSession) return '';
        const url = new URL(window.location.href);
        url.searchParams.set('sessionId', createdSession.publicId);
        return url.href;
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500">
             <div className="absolute top-6 right-6 flex items-center space-x-4">
                <ThemeSwitcher />
                <span className="font-bold">Olá, {localStorage.getItem('username') || 'User'}!</span>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="px-4 py-2 border-2 font-bold neo-shadow-button" style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)', borderColor: 'var(--panel-border-color)'}}>Logout</button>
            </div>
            <div className="w-full max-w-md p-8 space-y-6 border-2 glass-panel neo-shadow" style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)'}}>
                <div className="text-center">
                    <h1 className="text-4xl font-bold" style={{ color: 'var(--primary-color)' }}>TeamCode</h1>
                    <p className="mt-2" style={{ color: 'var(--text-muted-color)' }}>Crie uma sala de programação colaborativa</p>
                </div>
                <div className="space-y-4">
                    <input type="text" value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Nome do projeto..." 
                        className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2" 
                        style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', '--tw-ring-color': 'var(--primary-color)', color: 'var(--text-color)'}}
                    />
                    <button onClick={handleCreateSession} disabled={isLoading} 
                        className="w-full font-bold py-3 border-2 disabled:opacity-50 neo-shadow-button"
                        style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)', borderColor: 'var(--panel-border-color)'}}
                    >
                        {isLoading ? 'Criando...' : 'Criar Sessão'}
                    </button>
                </div>
                {error && <div className="p-3 border-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.5)', color: 'rgb(252, 165, 165)'}}>{error}</div>}
                {createdSession && <div className="p-4 border-2 space-y-2" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.5)'}}><h3 className="font-bold">Sessão criada!</h3><p className="text-sm">Abra este link em outra aba:</p><input type="text" readOnly value={getEditorLink()} className="w-full p-2 border-2" style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)'}}/></div>}
            </div>
        </div>
    );
}

function FileTabs({ openFiles, activeFile, onTabClick, onTabClose }) {
    return (
        <div className="flex-shrink-0 flex items-end overflow-x-auto" style={{ backgroundColor: 'var(--header-bg-color)'}}>
            {(openFiles || []).map(file => (
                <div 
                    key={file} 
                    onClick={() => onTabClick(file)}
                    className={`flex items-center space-x-2 px-4 py-2 cursor-pointer border-r-2 ${activeFile === file ? 'active-tab' : 'inactive-tab'}`}
                    style={{
                        borderColor: 'var(--panel-border-color)',
                    }}
                >
                    <div className="w-5 h-5 flex-shrink-0"><FileIcon fileName={file} /></div>
                    <span className="truncate text-sm font-medium">{file}</span>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onTabClose(file); }}
                        className="ml-2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-[var(--primary-bg-color)]"
                    >
                        &times;
                    </button>
                </div>
            ))}
        </div>
    );
}

function ResizeHandle({ onMouseDown }) {
    return (
        <div
            className="w-3 flex-shrink-0 cursor-col-resize hover:bg-[var(--primary-color)] transition-colors" 
            style={{ backgroundColor: 'var(--panel-border-color)', marginLeft: '-1px', marginRight: '-1px' }}
            onMouseDown={onMouseDown}
        />
    );
}

function EditorPage({ sessionId }) {
    const [status, setStatus] = useState('Carregando...');
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [files, setFiles] = useState([]);
    const [isCreateFileModalOpen, setCreateFileModalOpen] = useState(false);
    const [editorContent, setEditorContent] = useState('');
    const [openFiles, setOpenFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const DEFAULT_PANEL_SIZES = { left: 20, center: 55, right: 25 };
    const [panelSizes, setPanelSizes] = useState(() => {
        try {
            const raw = localStorage.getItem('teamcode-panel-sizes');
            if (raw) return JSON.parse(raw);
        } catch (_) {}
        return DEFAULT_PANEL_SIZES;
    });

    const editorRef = useRef(null);
    const stompClientRef = useRef(null);
    const chatMessagesEndRef = useRef(null);
    const rightAsideRef = useRef(null);
    const messagesRef = useRef(null);
    const debouncedEditorContent = useDebounce(editorContent, 1500);
    const terminalApiRef = useRef(null);
    const { theme } = useTheme();
    const dragInfo = useRef(null); 
    const chatDragInfo = useRef(null);
    const [chatHeight, setChatHeight] = useState(() => {
        try { const v = localStorage.getItem('teamcode-chat-height'); if (v) return Number(v); } catch (_) {}
        return 220;
    });
    const [terminalMinimized, setTerminalMinimized] = useState(() => {
        try { return localStorage.getItem('teamcode-terminal-minimized') === '1'; } catch (_) { return false; }
    });

    // --- LÓGICA DE REDIMENSIONAMENTO (CORRIGIDA) ---
    const onMouseDown = (divider) => (e) => {
        dragInfo.current = {
            divider,
            startX: e.clientX,
            initialSizes: { ...panelSizes }
        };
        e.preventDefault();
        // visual cursor feedback
        try { document.body.style.cursor = 'col-resize'; document.body.classList.add('no-transition'); } catch (_) {}
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        // fallbacks: if mouse leaves window or window loses focus, abort drag
        window.addEventListener('mouseleave', onMouseUp);
        window.addEventListener('blur', onMouseUp);
    };
    // touch support for horizontal resize
    const onTouchStart = (divider) => (e) => {
        const touch = e.touches && e.touches[0];
        if (!touch) return;
        dragInfo.current = {
            divider,
            startX: touch.clientX,
            initialSizes: { ...panelSizes }
        };
        try { document.body.style.cursor = 'col-resize'; document.body.classList.add('no-transition'); } catch(_){}
        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onMouseUp);
    };

    const onTouchMove = (e) => {
        const touch = e.touches && e.touches[0];
        if (!touch) return;
        // reuse mouse handler logic by mapping clientX
        const fakeEvent = { clientX: touch.clientX };
        onMouseMove(fakeEvent);
    };

    const onMouseMove = (e) => {
        if (!dragInfo.current) return;
        const { divider, startX, initialSizes } = dragInfo.current;
        const deltaX = e.clientX - startX;
        // Ignore very small moves to avoid stuck behaviour
        if (Math.abs(deltaX) < 2) return;
        const totalWidth = window.innerWidth;
        const deltaPercent = (deltaX / totalWidth) * 100;

        // Pixel-based minimums to respect CSS min-widths
        const minLeftPx = 220; // ensure sidebar doesn't collapse
        const minRightPx = 220; // ensure chat doesn't collapse
        const minCenterPx = 300; // keep editor usable

        const minLeft = Math.min(40, (minLeftPx / totalWidth) * 100);
        const minRight = Math.min(40, (minRightPx / totalWidth) * 100);
        const minCenter = Math.min(50, (minCenterPx / totalWidth) * 100);

        const maxLeft = 70;
        const maxRight = 70;

        let newLeft = initialSizes.left;
        let newRight = initialSizes.right;

        if (divider === 'left') {
            newLeft = Math.max(minLeft, Math.min(initialSizes.left + deltaPercent, maxLeft));
        } else {
            newRight = Math.max(minRight, Math.min(initialSizes.right - deltaPercent, maxRight));
        }

        let newCenter = 100 - newLeft - newRight;

        // if center violated, try to adjust less dominant panel
        if (newCenter < minCenter) {
            const deficit = minCenter - newCenter;
            if (divider === 'left') {
                newRight = Math.max(minRight, newRight - deficit);
            } else {
                newLeft = Math.max(minLeft, newLeft - deficit);
            }
            newCenter = 100 - newLeft - newRight;
        }

        // Only persist sizes when constraints satisfied
        if (newCenter >= minCenter) {
            const sizes = { left: newLeft, center: newCenter, right: newRight };
            setPanelSizes(sizes);
            try { localStorage.setItem('teamcode-panel-sizes', JSON.stringify(sizes)); } catch (_) {}
        }
    };
    
    const onMouseUp = () => {
        dragInfo.current = null;
        try { document.body.style.cursor = ''; document.body.classList.remove('no-transition'); } catch (_) {}
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('mouseleave', onMouseUp);
        window.removeEventListener('blur', onMouseUp);
    };

    // --- Chat vertical resize handlers ---
    const onChatMouseDown = (e) => {
        chatDragInfo.current = {
            startY: e.clientY,
            startHeight: chatHeight,
            containerHeight: rightAsideRef.current?.getBoundingClientRect().height ?? 400
        };
        e.preventDefault();
        try { document.body.style.cursor = 'row-resize'; } catch (_) {}
        window.addEventListener('mousemove', onChatMouseMove);
        window.addEventListener('mouseup', onChatMouseUp);
        window.addEventListener('mouseleave', onChatMouseUp);
        window.addEventListener('blur', onChatMouseUp);
        // touch fallback
        window.addEventListener('touchmove', onChatTouchMove);
        window.addEventListener('touchend', onChatMouseUp);
    };

    const onChatMouseMove = (e) => {
        if (!chatDragInfo.current) return;
        const deltaY = chatDragInfo.current.startY - e.clientY; // dragging up -> increase messages height
        if (Math.abs(deltaY) < 2) return;
        const maxH = chatDragInfo.current.containerHeight - 60; // leave space for textarea/header
        const newH = Math.max(80, Math.min(chatDragInfo.current.startHeight + deltaY, maxH));
        setChatHeight(newH);
        try { localStorage.setItem('teamcode-chat-height', String(newH)); } catch (_) {}
    };

    const onChatTouchMove = (e) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        const fake = { clientY: t.clientY };
        onChatMouseMove(fake);
    };

    const onChatMouseUp = () => {
        chatDragInfo.current = null;
        try { document.body.style.cursor = ''; } catch (_) {}
        window.removeEventListener('mousemove', onChatMouseMove);
        window.removeEventListener('mouseup', onChatMouseUp);
        window.removeEventListener('mouseleave', onChatMouseUp);
        window.removeEventListener('blur', onChatMouseUp);
    };

    const handleFileClick = (fileName) => {
        if (!openFiles.includes(fileName)) {
            setOpenFiles(prev => [...prev, fileName]);
        }
        setActiveFile(fileName);
    };

    const handleTabClose = (fileToClose) => {
        const index = openFiles.indexOf(fileToClose);
        const newOpenFiles = openFiles.filter(f => f !== fileToClose);
        setOpenFiles(newOpenFiles);

        if (activeFile === fileToClose) {
            if (newOpenFiles.length === 0) {
                setActiveFile(null);
            } else {
                const newIndex = Math.max(0, index - 1);
                setActiveFile(newOpenFiles[newIndex]);
            }
        }
    };

    useEffect(() => { chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/sessions/${sessionId}`, { headers: getAuthHeaders() });
                if (!res.ok) throw new Error(`Sessão não encontrada (${res.status})`);
                const data = await res.json();
                const filesList = Array.isArray(data.files) ? data.files : [];
                setFiles(filesList);
                const firstFile = filesList[0]?.name ?? null;
                if(firstFile) {
                    handleFileClick(firstFile);
                    setEditorContent(filesList[0].content ?? '');
                }
                setStatus('Carregando editor...');
            } catch (err) {
                console.error('Erro ao carregar sessão', err);
                setStatus('Erro ao carregar sessão.');
            }
        })();
        return () => { try { stompClientRef.current?.deactivate(); } catch (_) {} };
    }, [sessionId]);

    const folderNames = useMemo(() => {
        const s = new Set();
        (files || []).forEach(f => {
            if (!f || !f.name) return;
            if (f.name.endsWith('/')) s.add(f.name.replace(/\/+$/,''));
            else if (f.name.includes('/')) s.add(f.name.split('/')[0]);
        });
        return Array.from(s);
    }, [files]);

    // Context menu state for sidebar (right click)
    const [contextMenu, setContextMenu] = useState(null); // { x, y, name, isFolder }

    const openContextMenu = (e, name) => {
        e.preventDefault();
        const isFolder = name.endsWith('/');
        setContextMenu({ x: e.clientX, y: e.clientY, name, isFolder });
    };

    const closeContextMenu = () => setContextMenu(null);

    const handleDeleteFile = async (name) => {
        if (!name) return;
        try {
            // If folder, delete all children and the folder entry (optimistic)
            if (name.endsWith('/')) {
                const prefix = name;
                const toDelete = (files || []).filter(f => f.name === name || f.name.startsWith(prefix));
                // Optimistic UI remove
                setFiles(prev => prev.filter(f => !(f.name === name || f.name.startsWith(prefix))));
                // call delete for each file (URL-encode)
                for (const f of toDelete) {
                    const encoded = encodeURIComponent(f.name);
                    await fetch(`/api/sessions/${sessionId}/files/${encoded}`, { method: 'DELETE', headers: getAuthHeaders() });
                }
            } else {
                const encoded = encodeURIComponent(name);
                // Optimistic remove from open tabs and file list
                setOpenFiles(prev => prev.filter(p => p !== name));
                setActiveFile(prev => prev === name ? null : prev);
                setFiles(prev => prev.filter(f => f.name !== name));
                await fetch(`/api/sessions/${sessionId}/files/${encoded}`, { method: 'DELETE', headers: getAuthHeaders() });
            }
        } catch (err) {
            console.error('Erro ao apagar', err);
            // on failure, reload list from server
            try { const r = await fetch(`/api/sessions/${sessionId}`, { headers: getAuthHeaders() }); if (r.ok) setFiles(await r.json().then(d => d.files || [])); } catch (_) {}
        } finally { closeContextMenu(); }
    };

    const handleMoveFile = async (name, destFolder) => {
        if (!name || !destFolder) return;
        try {
            const body = { name, dest: destFolder };
            const res = await fetch(`/api/sessions/${sessionId}/files/move`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
            if (!res.ok) throw new Error('Move failed');
            // optimistic update: compute new name
            const base = name.includes('/') ? name.substring(name.lastIndexOf('/')+1) : name;
            const newName = `${destFolder.replace(/\/+$/,'')}/${base}`;
            setFiles(prev => prev.map(f => f.name === name ? { ...f, name: newName } : f));
            setOpenFiles(prev => prev.map(f => f === name ? newName : f));
            if (activeFile === name) setActiveFile(newName);
        } catch (err) {
            console.error('Move failed', err);
            // reload list
            try { const r = await fetch(`/api/sessions/${sessionId}`, { headers: getAuthHeaders() }); if (r.ok) setFiles(await r.json().then(d => d.files || [])); } catch (_) {}
        } finally { closeContextMenu(); }
    };

    const onDragStartFile = (e, fileName) => {
        try { e.dataTransfer.setData('text/plain', fileName); } catch (_) {}
    };

    const onDropToFolder = (e, folderName) => {
        e.preventDefault();
        const dragged = e.dataTransfer.getData('text/plain');
        if (dragged && folderName) handleMoveFile(dragged, folderName);
    };

    useEffect(() => {
        if (!activeFile) {
            if (editorRef.current) editorRef.current.setValue('');
            return;
        };
        const fileData = (Array.isArray(files) ? files.find(f => f.name === activeFile) : undefined);
        if (fileData && editorRef.current) {
            if (editorRef.current.getValue() !== (fileData.content ?? '')) {
                editorRef.current.setValue(fileData.content ?? '');
            }
        }
    }, [activeFile, files]);

    useEffect(() => {
        if (!activeFile || editorContent === undefined) return;
        (async () => {
            try {
                const res = await fetch(`/api/sessions/${sessionId}/files`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ name: activeFile, content: editorContent }) });
                if (!res.ok) console.error(`Falha ao salvar arquivo: ${res.status}`);
            } catch (err) { console.error('Erro de rede ao salvar', err); }
        })();
    }, [debouncedEditorContent]); 

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        setStatus('Conectando...');
        connectToWebSocket();
    };

    const handleEditorChange = (value) => { setEditorContent(value ?? ''); };

    // --- CORREÇÃO: Atualiza a UI quando um arquivo é criado ---
    const handleFileEvent = (message) => {
        try {
            const event = JSON.parse(message.body);
            if (event?.type === 'CREATED') {
                // Adiciona à lista geral de arquivos
                setFiles(prev => [...prev, { name: event.name, content: event.content }]);
                // Abre o arquivo em uma nova aba
                handleFileClick(event.name);
            }
        } catch (e) { console.warn('fileEvent parse failed', e); }
    };

    const handleChatMessage = (message) => {
        try { setMessages(prev => [...prev, JSON.parse(message.body)]); } catch (e) {}
    };

    const handleSendChatMessage = () => {
        if (chatInput.trim() && stompClientRef.current?.connected) {
            stompClientRef.current.publish({ destination: `/app/chat/${sessionId}`, body: JSON.stringify({ username: localStorage.getItem('username') || 'User', content: chatInput.trim() }) });
            setChatInput('');
        }
    };

    const handleUserEvent = (message) => {
        try { setParticipants(JSON.parse(message.body).participants); } catch (e) {}
    };

    const connectToWebSocket = () => {
        const token = localStorage.getItem('jwtToken');
        const client = new Client({
            webSocketFactory: () => new SockJS(`http://${window.location.host}/ws-connect`),
            reconnectDelay: 5000,
            connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            onConnect: () => {
                setStatus('Sincronizado!');
                client.subscribe(`/topic/user/${sessionId}`, handleUserEvent);
                client.subscribe(`/topic/chat/${sessionId}`, handleChatMessage);
                client.subscribe(`/topic/file/${sessionId}`, handleFileEvent);
                // Ao conectar, solicite novamente a lista de arquivos para garantir sincronização
                (async () => {
                    try {
                        const res = await fetch(`/api/sessions/${sessionId}`, { headers: getAuthHeaders() });
                        if (!res.ok) return;
                        const data = await res.json();
                        const filesList = Array.isArray(data.files) ? data.files : [];
                        setFiles(filesList);
                        // se editor está vazio, abra o primeiro arquivo automaticamente
                        if (!activeFile && filesList[0]?.name) {
                            handleFileClick(filesList[0].name);
                            setEditorContent(filesList[0].content ?? '');
                        }
                    } catch (_) {}
                })();
                client.subscribe(`/topic/terminal/${sessionId}`, (message) => {
                    try {
                        const payload = JSON.parse(message.body);
                        terminalApiRef.current?.write(payload.output ?? '');
                    } catch {
                        terminalApiRef.current?.write(message.body);
                    }
                });
                client.publish({ destination: `/app/user.join/${sessionId}`, body: JSON.stringify({ userId: `user-${Math.random().toString(36).substr(2,9)}`, username: localStorage.getItem('username') || 'User', type: 'JOIN' }) });
                try { client.publish({ destination: `/app/terminal.start/${sessionId}` }); } catch (_) {}
            },
            onStompError: () => setStatus('Erro de conexão.'),
            onWebSocketClose: () => setStatus('Desconectado. Reconectando...'),
        });
        client.activate();
        stompClientRef.current = client;
    };
    
    const handleCreateFile = async (fileInfo) => {
        if (!fileInfo?.name) return;
        try {
            if (fileInfo.type === 'folder') {
                // create a placeholder file for the folder so backend stores path
                const placeholder = { name: `${fileInfo.name}.gitkeep`, content: '' };
                const response = await fetch(`/api/sessions/${sessionId}/files`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(placeholder) });
                if (!response.ok) {
                    alert(`Erro ao criar pasta: ${await response.text().catch(() => '')}`);
                } else {
                    // Update UI: represent folder as a name ending with '/'
                    setFiles(prev => {
                        const folderName = fileInfo.name.endsWith('/') ? fileInfo.name : `${fileInfo.name}/`;
                        if (prev.some(f => f.name === folderName)) return prev;
                        return [...prev, { name: folderName, type: 'folder' }];
                    });
                }
            } else {
                const newFile = { name: fileInfo.name, content: `// Arquivo: ${fileInfo.name}\n` };
                const response = await fetch(`/api/sessions/${sessionId}/files`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newFile) });
                if (!response.ok) {
                     alert(`Erro ao criar arquivo: ${await response.text().catch(() => '')}`);
                }
                if (response.ok) {
                    const created = await (async () => {
                        try { return await response.json(); } catch (_) { return newFile; }
                    })();
                    setFiles(prev => {
                        // ensure folder exists in UI when creating inside a folder
                        const newList = [...prev];
                        const folder = (created.name || newFile.name).includes('/') ? (created.name || newFile.name).split('/')[0] : null;
                        if (folder) {
                            const folderEntry = `${folder}/`;
                            if (!newList.some(f => f.name === folderEntry)) {
                                newList.push({ name: folderEntry, type: 'folder' });
                            }
                        }
                        if (!newList.some(f => f.name === (created.name))) {
                            newList.push({ name: created.name, content: created.content ?? newFile.content });
                        }
                        return newList;
                    });
                    handleFileClick(created.name ?? newFile.name);
                }
            }
        } catch (err) {
            alert('Não foi possível conectar ao serviço de sessão para criar o arquivo/pasta.');
        }
        setCreateFileModalOpen(false);
    };

    useEffect(() => {
        if (!terminalMinimized) {
            try { terminalApiRef.current?.fit(); } catch (_) {}
        }
    }, [terminalMinimized]);

    return (
        <>
            <EnhancedCreateFileModal isOpen={isCreateFileModalOpen} onClose={() => setCreateFileModalOpen(false)} onCreate={handleCreateFile} folders={folderNames} />
            <div className="h-screen flex flex-col font-sans overflow-hidden transition-colors duration-500 editor-page-layout">
                <header 
                    className="p-3 flex justify-between items-center shrink-0 z-10 border-b-2 editor-page-header"
                    style={{ backgroundColor: 'var(--header-bg-color)', borderColor: 'var(--panel-border-color)'}}
                >
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--primary-color)' }}>TeamCode</h1>
                        <p className="text-sm" style={{ color: 'var(--text-muted-color)' }}>Sessão: <span className="font-bold">{sessionId}</span></p>
                    </div>
                    <div className="flex items-center space-x-4">
                             <ThemeSwitcher />
                            <div className="text-right">
                            <h3 className="font-bold">Participantes ({participants.length})</h3>
                            <div className="text-xs" style={{ color: 'var(--text-muted-color)' }}>{participants.join(', ')}</div>
                        </div>
                            <div className="text-sm font-bold px-3 py-1 border-2" style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)'}}>Status: {status}</div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => { setPanelSizes(DEFAULT_PANEL_SIZES); try { localStorage.setItem('teamcode-panel-sizes', JSON.stringify(DEFAULT_PANEL_SIZES)); } catch(_){} }} title="Restaurar layout" className="px-3 py-1 border-2 font-medium" style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)', borderColor: 'var(--panel-border-color)'}}>Restaurar layout</button>
                                <div className="inline-flex items-center border-2 rounded" style={{ borderColor: 'var(--panel-border-color)' }}>
                                    <button title="Minimizar/Restaurar terminal" onClick={() => { setTerminalMinimized(s => { const v = !s; try { localStorage.setItem('teamcode-terminal-minimized', v ? '1' : '0'); } catch(_){}; return v; }); }} className="px-3 py-1 font-medium" style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)'}}>Terminal</button>
                                    <button title="Limpar terminal" onClick={() => { try { terminalApiRef.current?.clear(); } catch(_){} }} className="px-3 py-1">Limpar</button>
                                    <button title="Ajustar terminal" onClick={() => { try { terminalApiRef.current?.fit(); } catch(_){} }} className="px-3 py-1">Ajustar</button>
                                </div>
                            </div>
                    </div>
                </header>

                <div className="flex flex-grow overflow-hidden">
                    <aside className="h-full flex flex-col border-r-2 editor-page-panel" style={{ flexBasis: `${panelSizes.left}%`, backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)'}}>
                        <div className="p-3 border-b-2 flex justify-between items-center" style={{ borderColor: 'var(--panel-border-color)'}}>
                            <h2 className="font-bold text-lg" style={{ color: 'var(--primary-color)' }}>Arquivos</h2>
                            <button onClick={() => setCreateFileModalOpen(true)} className="w-8 h-8 font-bold text-xl border-2 neo-shadow-button" style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)', borderColor: 'var(--panel-border-color)'}}>+</button>
                        </div>
                        <div className="flex-grow p-2 overflow-y-auto">
                            {/**
                             * Build a simple one-level folder tree: entries ending with '/' are folders.
                             * Files with prefix 'foldername/...' are considered inside that folder.
                             */}
                            {(() => {
                                const folders = {};
                                const rootFiles = [];
                                (files || []).forEach(f => {
                                    if (!f || !f.name) return;
                                    if (f.name.endsWith('/')) {
                                        const name = f.name.replace(/\/+$/,'');
                                        folders[name] = folders[name] || { name, files: [] };
                                    } else if (f.name.includes('/')) {
                                        const parts = f.name.split('/');
                                        const folder = parts[0];
                                        const rest = parts.slice(1).join('/');
                                        folders[folder] = folders[folder] || { name: folder, files: [] };
                                        folders[folder].files.push({ name: f.name, display: rest, content: f.content });
                                    } else {
                                        rootFiles.push(f);
                                    }
                                });
                                return (
                                    <div>
                                        {Object.values(folders).map(folder => (
                                            <div key={folder.name} className="mb-2">
                                                <div className="px-3 py-2 font-bold" style={{ color: 'var(--primary-color)' }} onContextMenu={(e) => openContextMenu(e, folder.name + '/')} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDropToFolder(e, folder.name)}>{folder.name}/</div>
                                                <div className="pl-4">
                                                    {folder.files.map(ff => (
                                                        <div key={ff.name} onClick={() => handleFileClick(ff.name)} onContextMenu={(e) => openContextMenu(e, ff.name)} draggable onDragStart={(e) => onDragStartFile(e, ff.name)} className={`flex items-center space-x-2 px-3 py-2 cursor-pointer ${activeFile === ff.name ? 'bg-[var(--primary-bg-color)] border-[var(--primary-color)]' : ''}`}>
                                                            <div className="w-5 h-5"><FileIcon fileName={ff.name} /></div>
                                                            <span className="truncate">{ff.display}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                        {rootFiles.map(f => (
                                            <div key={f.name} onClick={() => handleFileClick(f.name)} onContextMenu={(e) => openContextMenu(e, f.name)} draggable onDragStart={(e) => onDragStartFile(e, f.name)} className={`flex items-center space-x-2 px-3 py-2 cursor-pointer ${activeFile === f.name ? 'bg-[var(--primary-bg-color)] border-[var(--primary-color)]' : ''}`}>
                                                <div className="w-5 h-5"><FileIcon fileName={f.name} /></div>
                                                <span className="truncate">{f.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </aside>
                    {contextMenu && (
                        <div className="sidebar-context" style={{ position: 'fixed', left: contextMenu.x + 4, top: contextMenu.y + 4 }} onMouseLeave={() => setContextMenu(null)}>
                            <button onClick={() => handleDeleteFile(contextMenu.name)}>Delete</button>
                            {!contextMenu.isFolder && <button onClick={() => { const dest = prompt('Mover para (pasta):', folderNames[0] ?? ''); if (dest) handleMoveFile(contextMenu.name, dest); }}>Move...</button>}
                            <button onClick={() => { setContextMenu(null); }}>Cancel</button>
                        </div>
                    )}

                    <ResizeHandle onMouseDown={onMouseDown('left')} />

                    <div className="h-full flex-grow flex flex-col" style={{ flexBasis: `${panelSizes.center}%`}}>
                        <FileTabs openFiles={openFiles} activeFile={activeFile} onTabClick={setActiveFile} onTabClose={handleTabClose} />
                        <main className="flex-grow relative">
                            {openFiles.length > 0 ? (
                                <Editor
                                    key={theme}
                                    height="100%"
                                    theme={theme.endsWith('light') ? 'light' : 'vs-dark'}
                                    path={activeFile}
                                    language={getLanguageFromExtension(activeFile)}
                                    onMount={handleEditorDidMount}
                                    onChange={handleEditorChange}
                                    options={{ automaticLayout: true, minimap: { enabled: true } }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center" style={{backgroundColor: theme.endsWith('light') ? '#FFFFFF' : '#1E1E1E', color: 'var(--text-muted-color)'}}>
                                    <p>Abra um arquivo para começar a editar</p>
                                </div>
                            )}
                        </main>
                        <footer className={`flex-shrink-0 border-t-2 terminal-footer ${terminalMinimized ? 'minimized' : ''}`} style={{ backgroundColor: 'var(--terminal-bg-color)', borderColor: 'var(--panel-border-color)'}}>
                            {!terminalMinimized ? (
                                <TerminalComponent
                                    sessionId={sessionId}
                                    stompClient={stompClientRef.current}
                                    registerApi={(api) => { terminalApiRef.current = api; }}
                                />
                            ) : (
                                <div className="p-2 text-sm" style={{ color: 'var(--text-muted-color)' }}>Terminal minimizado - clique no botão "Restaurar terminal" para abrir.</div>
                            )}
                        </footer>
                    </div>
                    
                    <ResizeHandle onMouseDown={onMouseDown('right')} />

                    <aside ref={rightAsideRef} className="h-full flex flex-col border-l-2 editor-page-panel chat-panel" style={{ flexBasis: `${panelSizes.right}%`, backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)'}}>
                        <div className="p-3 border-b-2" style={{ borderColor: 'var(--panel-border-color)'}}><h2 className="font-bold text-lg" style={{ color: 'var(--primary-color)' }}>Chat da Sessão</h2></div>
                        <div ref={messagesRef} className="p-3 overflow-y-auto space-y-4 chat-container" style={{ height: `${chatHeight}px` }}>
                            {(messages || []).map((msg, idx) => (
                                <div key={idx} className="flex flex-col">
                                    <div className="flex items-baseline space-x-2">
                                        <span className="font-bold" style={{ color: 'var(--primary-color)' }}>{msg.username}</span>
                                        <span className="text-xs" style={{ color: 'var(--text-muted-color)' }}>{msg.timestamp}</span>
                                    </div>
                                    <p className="border-2 p-2 mt-1" style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)'}}>{msg.content}</p>
                                </div>
                            ))}
                            <div ref={chatMessagesEndRef} />
                        </div>
                        <div className="chat-resize-handle" onMouseDown={onChatMouseDown} title="Ajustar altura do chat" />
                        <div className="p-3 border-t-2 chat-input" style={{ borderColor: 'var(--panel-border-color)' }}>
                            <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChatMessage())} placeholder="Digite uma mensagem..." 
                                className="w-full p-2 border-2 resize-none focus:outline-none" 
                                style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', '--tw-ring-color': 'var(--primary-color)', color: 'var(--text-color)' }} 
                                rows="3" />
                        </div>
                    </aside>
                </div>
            </div>
        </>
    );
}

// --- App Principal ---
export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('jwtToken'));
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');

    return (
        <ThemeProvider>
            {!isAuthenticated ? <AuthPage onLoginSuccess={() => setIsAuthenticated(true)} /> :
             sessionId ? <EditorPage sessionId={sessionId} /> : <HomePage />}
        </ThemeProvider>
    );
}

