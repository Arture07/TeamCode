// frontend/src/App.jsx
import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
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

function EnhancedCreateFileModal({ isOpen, onClose, onCreate }) {
    const [fileName, setFileName] = useState('');
    const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);

    useEffect(() => {
        if (isOpen) {
            setFileName('');
            setSelectedLang(LANGUAGES[0]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCreate = () => {
        if (fileName.trim()) {
            const finalName = fileName.endsWith(selectedLang.extension) ? fileName : `${fileName}${selectedLang.extension}`;
            onCreate({ name: finalName, language: selectedLang.name });
        }
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
                <h2 className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>Criar Novo Ficheiro</h2>
                <div className="flex items-stretch space-x-2">
                    <input
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        placeholder="nome-do-ficheiro"
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
                        className="border-2 px-3 py-2 focus:outline-none appearance-none"
                        style={{
                            backgroundColor: 'var(--input-bg-color)',
                            borderColor: 'var(--panel-border-color)',
                            color: 'var(--text-color)',
                        }}
                    >
                        {LANGUAGES.map(lang => (
                            <option key={lang.extension} value={lang.extension} style={{backgroundColor: 'var(--panel-bg-color)', color: 'var(--text-color)'}}>
                                {lang.extension}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex justify-end space-x-4 pt-4">
                    <button onClick={onClose} className="px-6 py-2 font-bold border-2 neo-shadow-button" style={{ borderColor: 'var(--panel-border-color)'}}>Cancelar</button>
                    <button onClick={handleCreate} className="px-8 py-2 font-bold border-2 neo-shadow-button" style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)', borderColor: 'var(--panel-border-color)'}}>Criar</button>
                </div>
            </div>
        </div>
    );
}

function TerminalComponent({ sessionId, stompClient, registerWriteFn }) {
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

        if (typeof registerWriteFn === 'function') {
            registerWriteFn((data) => { if(termRef.current) termRef.current.write(data); });
        }
        
        const handleResize = () => fit.fit();
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            onDataDisposable.dispose();
            term.dispose(); 
        };
    }, [theme]); 

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
                setError('Registo realizado! Faça o login.');
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
                    <p className="mt-2" style={{ color: 'var(--text-muted-color)' }}>{isLoginView ? 'Bem-vindo de volta!' : 'Crie a sua conta'}</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nome de utilizador" required 
                        className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2" 
                        style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', '--tw-ring-color': 'var(--primary-color)', color: 'var(--text-color)'}}
                    />
                    {!isLoginView && <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required 
                        className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2" 
                        style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', '--tw-ring-color': 'var(--primary-color)', color: 'var(--text-color)'}}
                    />}
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Palavra-passe" required 
                        className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2" 
                        style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', '--tw-ring-color': 'var(--primary-color)', color: 'var(--text-color)'}}
                    />
                    <button type="submit" disabled={isLoading} 
                        className="w-full font-bold py-3 border-2 disabled:opacity-50 neo-shadow-button"
                        style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)', borderColor: 'var(--panel-border-color)'}}
                    >
                        {isLoading ? 'A processar...' : (isLoginView ? 'Entrar' : 'Registar')}
                    </button>
                </form>
                {error && <div className="p-3 border-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.5)', color: 'rgb(252, 165, 165)'}}>{error}</div>}
                <p className="text-center text-sm" style={{ color: 'var(--text-muted-color)' }}>
                    {isLoginView ? 'Não tem conta?' : 'Já tem conta?'}
                    <button type="button" onClick={() => { setIsLoginView(!isLoginView); setError(null); }} className="font-bold underline ml-2" style={{ color: 'var(--primary-color)' }}>{isLoginView ? 'Registe-se' : 'Faça o login'}</button>
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
        } catch (err) { console.error(err); setError('Não foi possível ligar ao serviço de sessão.'); } finally { setIsLoading(false); }
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
                        {isLoading ? 'A criar...' : 'Criar Sessão'}
                    </button>
                </div>
                {error && <div className="p-3 border-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.5)', color: 'rgb(252, 165, 165)'}}>{error}</div>}
                {createdSession && <div className="p-4 border-2 space-y-2" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.5)'}}><h3 className="font-bold">Sessão criada!</h3><p className="text-sm">Abra este link noutra aba:</p><input type="text" readOnly value={getEditorLink()} className="w-full p-2 border-2" style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)'}}/></div>}
            </div>
        </div>
    );
}

function EditorPage({ sessionId }) {
    const [status, setStatus] = useState('A carregar...');
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [files, setFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [isCreateFileModalOpen, setCreateFileModalOpen] = useState(false);
    const [editorContent, setEditorContent] = useState('');

    const editorRef = useRef(null);
    const stompClientRef = useRef(null);
    const chatMessagesEndRef = useRef(null);
    const debouncedEditorContent = useDebounce(editorContent, 1500);
    const terminalWriteRef = useRef(null);
    const { theme } = useTheme();

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
                setActiveFile(firstFile);
                if(firstFile) setEditorContent(filesList[0].content ?? '');
                setStatus('A carregar o editor...');
            } catch (err) {
                console.error('Erro ao carregar a sessão', err);
                setStatus('Erro ao carregar a sessão.');
            }
        })();
        return () => { try { stompClientRef.current?.deactivate(); } catch (_) {} };
    }, [sessionId]);

    useEffect(() => {
        if (!activeFile) return;
        const fileData = (Array.isArray(files) ? files.find(f => f.name === activeFile) : undefined);
        if (fileData && editorRef.current) {
            try {
                if (editorRef.current.getValue() !== (fileData.content ?? '')) {
                    editorRef.current.setValue(fileData.content ?? '');
                }
            } catch (e) { console.warn('Falha ao definir o valor do editor', e); }
        }
    }, [activeFile, files]);

    useEffect(() => {
        if (!activeFile || editorContent === undefined) return;
        (async () => {
            try {
                const res = await fetch(`/api/sessions/${sessionId}/files`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ name: activeFile, content: editorContent }) });
                if (!res.ok) console.error(`Falha ao guardar o ficheiro: ${res.status}`);
            } catch (err) { console.error('Erro de rede ao guardar', err); }
        })();
    }, [debouncedEditorContent]); 

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
        setStatus('A ligar...');
        connectToWebSocket();
    };

    const handleEditorChange = (value) => { setEditorContent(value ?? ''); };

    const handleFileEvent = (message) => {
        try {
            const event = JSON.parse(message.body);
            if (event?.type === 'CREATED') {
                setFiles(prev => [...prev, { name: event.name, content: event.content }]);
                setActiveFile(event.name);
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
                client.subscribe(`/topic/terminal/${sessionId}`, (message) => {
                    try {
                        const payload = JSON.parse(message.body);
                        terminalWriteRef.current?.(payload.output ?? '');
                    } catch {
                        terminalWriteRef.current?.(message.body);
                    }
                });
                client.publish({ destination: `/app/user.join/${sessionId}`, body: JSON.stringify({ userId: `user-${Math.random().toString(36).substr(2,9)}`, username: localStorage.getItem('username') || 'User', type: 'JOIN' }) });
                try { client.publish({ destination: `/app/terminal.start/${sessionId}` }); } catch (_) {}
            },
            onStompError: () => setStatus('Erro de ligação.'),
            onWebSocketClose: () => setStatus('Desligado. A religar...'),
        });
        client.activate();
        stompClientRef.current = client;
    };
    
    const handleCreateFile = async (fileInfo) => {
        if (!fileInfo?.name) return;
        const newFile = { name: fileInfo.name, content: `// Ficheiro: ${fileInfo.name}\n` };
        try {
            const response = await fetch(`/api/sessions/${sessionId}/files`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newFile) });
            if (!response.ok) {
                 alert(`Erro ao criar o ficheiro: ${await response.text().catch(() => '')}`);
            }
        } catch (err) {
            alert('Não foi possível ligar ao serviço de sessão para criar o ficheiro.');
        }
        setCreateFileModalOpen(false);
    };

    return (
        <>
            <EnhancedCreateFileModal isOpen={isCreateFileModalOpen} onClose={() => setCreateFileModalOpen(false)} onCreate={handleCreateFile} />
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
                    </div>
                </header>

                <div className="flex flex-grow overflow-hidden">
                    <aside className="w-64 flex flex-col border-r-2 editor-page-panel" style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)'}}>
                        <div className="p-3 border-b-2 flex justify-between items-center" style={{ borderColor: 'var(--panel-border-color)'}}>
                            <h2 className="font-bold text-lg" style={{ color: 'var(--primary-color)' }}>Ficheiros</h2>
                            <button onClick={() => setCreateFileModalOpen(true)} className="w-8 h-8 font-bold text-xl border-2 neo-shadow-button" style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)', borderColor: 'var(--panel-border-color)'}}>+</button>
                        </div>
                        <div className="flex-grow p-2 overflow-y-auto">
                            {(files || []).map(file => (
                                <div
                                    key={file.name}
                                    onClick={() => setActiveFile(file.name)}
                                    className={`flex items-center space-x-2 px-3 py-2 cursor-pointer border-2 border-transparent`}
                                    style={ activeFile === file.name ? { backgroundColor: 'var(--primary-bg-color)', borderColor: 'var(--primary-color)' } : {}}
                                >
                                    <div className="w-5 h-5 flex-shrink-0"><FileIcon fileName={file.name} /></div>
                                    <span className="truncate font-medium">{file.name}</span>
                                </div>
                            ))}
                        </div>
                    </aside>

                    <div className="flex flex-col flex-grow">
                        <main className="h-3/4">
                            <Editor
                                key={theme} // Force re-mount on theme change to prevent style glitches
                                height="100%"
                                theme={theme.endsWith('light') ? 'light' : 'vs-dark'}
                                path={activeFile}
                                language={getLanguageFromExtension(activeFile)}
                                onMount={handleEditorDidMount}
                                onChange={handleEditorChange}
                                options={{ automaticLayout: true, minimap: { enabled: true } }}
                            />
                        </main>
                        <footer className="h-1/4 border-t-2" style={{ backgroundColor: 'var(--terminal-bg-color)', borderColor: 'var(--panel-border-color)'}}>
                            <TerminalComponent
                                sessionId={sessionId}
                                stompClient={stompClientRef.current}
                                registerWriteFn={(fn) => { terminalWriteRef.current = fn; }}
                            />
                        </footer>
                    </div>

                    <aside className="w-80 flex flex-col border-l-2 editor-page-panel" style={{ backgroundColor: 'var(--panel-bg-color)', borderColor: 'var(--panel-border-color)'}}>
                        <div className="p-3 border-b-2" style={{ borderColor: 'var(--panel-border-color)'}}><h2 className="font-bold text-lg" style={{ color: 'var(--primary-color)' }}>Chat da Sessão</h2></div>
                        <div className="flex-grow p-3 overflow-y-auto space-y-4">
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
                        <div className="p-3 border-t-2" style={{ borderColor: 'var(--panel-border-color)'}}>
                            <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChatMessage())} placeholder="Digite uma mensagem..." 
                                className="w-full p-2 border-2 resize-none focus:outline-none" 
                                style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', '--tw-ring-color': 'var(--primary-color)', color: 'var(--text-color)'}} 
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

