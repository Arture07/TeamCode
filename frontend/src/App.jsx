// frontend/src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import './index.css';
import Sidebar from './components/Sidebar';
import CreateFileModal from './components/CreateFileModal';

import { getLanguageFromExtension, LANGUAGES } from './utils/fileUtils';
import { getFileIcon, getIconByExtension } from './utils/fileIcons.jsx';

// ---------- URLs de save (ordem pensada para compatibilidade) ----------
const LEGACY_SAVE_CONTENT_URL = (sessionId) => `/api/sessions/${sessionId}/files/content`;
const LEGACY_SAVE_URL = (sessionId) => `/api/sessions/${sessionId}/files`;
const PRIMARY_SAVE_URL = (sessionId, fileName) => `/api/sessions/${sessionId}/files/${encodeURIComponent(fileName)}`;

// ---------- Aux: headers auth ----------
function getAuthHeaders() {
    const token = localStorage.getItem('jwtToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// ---------- Debounce hook local (pode remover se usar seu useDebounce.js) ----------
function useDebounce(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

/* -------------------- TerminalComponent -------------------- */
function TerminalComponent({ sessionId, stompClient, registerWriteFn }) {
    const containerRef = useRef(null);
    const termRef = useRef(null);
    const fitRef = useRef(null);

    useEffect(() => {
        const term = new Terminal({ cursorBlink: true, theme: { background: '#0f172a', foreground: '#cbd5e1' } });
        const fit = new FitAddon();
        term.loadAddon(fit);
        if (containerRef.current) {
            term.open(containerRef.current);
            try { fit.fit(); } catch (_) {}
        }
        termRef.current = term;
        fitRef.current = fit;

        if (typeof registerWriteFn === 'function') {
            registerWriteFn((data) => { try { term.write(data); } catch (_) {} });
        }

        const disp = term.onData((d) => {
            if (stompClient?.connected) {
                try { stompClient.publish({ destination: `/app/terminal.in/${sessionId}`, body: JSON.stringify({ input: d }) }); } catch (_) {}
            }
        });

        const handleResize = () => { try { fit.fit(); } catch (_) {} };
        window.addEventListener('resize', handleResize);

        return () => {
            try { disp.dispose(); } catch (_) {}
            window.removeEventListener('resize', handleResize);
            try { term.dispose(); } catch (_) {}
        };
    }, []); // só 1x

    useEffect(() => {
        if (stompClient?.connected) {
            try { stompClient.publish({ destination: `/app/terminal.start/${sessionId}` }); } catch (_) {}
        }
    }, [stompClient, sessionId]);

    return <div ref={containerRef} className="h-full w-full" />;
}

/* -------------------- AuthPage & HomePage -------------------- */
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
                setError('Registro realizado! Faça login.');
            }
        } catch (err) { setError(err.message); } finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
                <div className="text-center">
                    <h1 className="text-4xl font-bold">TeamCode</h1>
                    <p className="text-slate-300 mt-2">{isLoginView ? 'Bem-vindo de volta!' : 'Crie sua conta'}</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nome de usuário" required className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg" />
                    {!isLoginView && <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg" />}
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg" />
                    <button type="submit" disabled={isLoading} className="w-full bg-sky-600 hover:bg-sky-700 py-3 rounded-lg">{isLoading ? 'Processando...' : (isLoginView ? 'Entrar' : 'Registrar')}</button>
                </form>
                {error && <div className="bg-red-500/20 text-red-300 px-4 py-3 rounded-lg">{error}</div>}
                <p className="text-center text-sm text-slate-400">
                    {isLoginView ? 'Não tem conta?' : 'Já tem conta?'}
                    <button onClick={() => { setIsLoginView(!isLoginView); setError(null); }} className="font-semibold text-sky-400 ml-2">{isLoginView ? 'Registre-se' : 'Faça login'}</button>
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
            const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionName }) });
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
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans">
            <div className="absolute top-4 right-4 text-sm">
                <span>Olá, <strong>{localStorage.getItem('username') || 'User'}</strong>!</span>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 rounded-lg">Logout</button>
            </div>
            <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
                <div className="text-center"><h1 className="text-4xl font-bold">TeamCode</h1><p className="text-slate-300 mt-2">Crie uma sala de programação colaborativa</p></div>
                <div className="space-y-4">
                    <input type="text" value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Nome do projeto..." className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg" />
                    <button onClick={handleCreateSession} disabled={isLoading} className="w-full bg-sky-600 hover:bg-sky-700 py-3 rounded-lg">{isLoading ? 'Criando...' : 'Criar Sessão'}</button>
                </div>
                {error && <div className="bg-red-500/20 text-red-300 px-4 py-3 rounded-lg text-center">{error}</div>}
                {createdSession && <div className="bg-green-500/20 text-green-300 px-4 py-3 rounded-lg space-y-3"><h3 className="font-bold text-white">Sessão criada!</h3><p className="text-sm">Abra este link em outra aba:</p><input type="text" readOnly value={getEditorLink()} className="w-full bg-slate-900 p-2 rounded-lg" /></div>}
            </div>
        </div>
    );
}

/* -------------------- EditorPage -------------------- */
function EditorPage({ sessionId }) {
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const stompClientRef = useRef(null);
    const chatMessagesEndRef = useRef(null);

    const [status, setStatus] = useState('Carregando dados da sessão...');
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [files, setFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [isCreateFileModalOpen, setCreateFileModalOpen] = useState(false);

    const [editorContent, setEditorContent] = useState('');
    const debouncedEditorContent = useDebounce(editorContent, 1500);
    const terminalWriteRef = useRef(null);

    useEffect(() => { chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/sessions/${sessionId}`);
                if (!res.ok) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(txt || `Sessão não encontrada (${res.status})`);
                }
                const txt = await res.text();
                let data;
                try { data = txt ? JSON.parse(txt) : {}; } catch (e) { data = {}; }
                const filesList = Array.isArray(data.files) ? data.files : [];
                setFiles(filesList);
                setActiveFile(filesList[0]?.name ?? null);
                setStatus('Carregando editor...');
            } catch (err) {
                console.error('Erro ao carregar sessão', err);
                setFiles([]); setActiveFile(null); setStatus('Erro ao carregar dados da sessão.');
            }
        })();

        return () => { try { stompClientRef.current?.deactivate(); } catch (_) {} try { editorRef.current?.dispose?.(); } catch (_) {} };
    }, [sessionId]);

    useEffect(() => {
        if (!activeFile) return;
        const fileData = (Array.isArray(files) ? files.find(f => f && f.name === activeFile) : undefined);
        if (fileData && editorRef.current) {
            try { if (editorRef.current.getValue() !== (fileData.content ?? '')) editorRef.current.setValue(fileData.content ?? ''); } catch (e) { console.warn(e); }
            setEditorContent(fileData.content ?? '');
        }
        const lang = getLanguageFromExtension(activeFile);
        try {
            if (monacoRef.current && editorRef.current) {
                const model = editorRef.current.getModel();
                if (model) monacoRef.current.editor.setModelLanguage(model, lang);
            }
        } catch (e) { console.warn('setModelLanguage falhou', e); }
    }, [activeFile, files]);

    // salvar (tenta endpoints em ordem para compatibilidade)
    useEffect(() => {
        if (!activeFile || debouncedEditorContent === undefined) return;
        (async () => {
            try {
                const legacyPayload = { name: activeFile, content: debouncedEditorContent };
                let res = await fetch(LEGACY_SAVE_CONTENT_URL(sessionId), { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(legacyPayload) });

                if (res.status === 404 || res.status === 405) {
                    console.warn(`[save] legacy content returned ${res.status}, trying /files`);
                    res = await fetch(LEGACY_SAVE_URL(sessionId), { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(legacyPayload) });
                }

                if (res.status === 404 || res.status === 405) {
                    console.warn(`[save] /files returned ${res.status}, trying per-file endpoint`);
                    const primaryPayload = { content: debouncedEditorContent };
                    res = await fetch(PRIMARY_SAVE_URL(sessionId, activeFile), { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(primaryPayload) });
                }

                if (!res.ok) {
                    const txt = await res.text().catch(() => '');
                    console.error('[save] failed', res.status, txt);
                }
            } catch (err) {
                console.error('[save] network error', err);
            }
        })();
    }, [debouncedEditorContent, activeFile, sessionId]);

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor; monacoRef.current = monaco;
        setStatus('Conectando ao servidor...');
        connectToWebSocket();
    };

    const handleEditorChange = (value) => { setEditorContent(value ?? ''); };

    const handleFileEvent = (message) => {
        try {
            const event = JSON.parse(message.body);
            if (event?.type === 'CREATED') {
                setFiles(prev => Array.isArray(prev) ? [...prev, { name: event.name, content: event.content }] : [{ name: event.name, content: event.content }]);
            }
        } catch (e) { console.warn('fileEvent parse failed', e); }
    };

    const handleChatMessage = (message) => {
        try {
            const m = JSON.parse(message.body);
            setMessages(prev => Array.isArray(prev) ? [...prev, m] : [m]);
        } catch (e) { console.warn('chat parse failed', e); }
    };

    const handleSendChatMessage = () => {
        if (chatInput.trim() && stompClientRef.current?.connected) {
            stompClientRef.current.publish({ destination: `/app/chat/${sessionId}`, body: JSON.stringify({ username: localStorage.getItem('username') || 'User', content: chatInput.trim() }) });
            setChatInput('');
        }
    };

    const handleUserEvent = (message) => {
        try { const p = JSON.parse(message.body).participants; setParticipants(Array.isArray(p) ? p : []); } catch (e) { console.warn('userEvent parse failed', e); }
    };

    const connectToWebSocket = () => {
        const token = localStorage.getItem('jwtToken');
        const client = new Client({
            webSocketFactory: () => new SockJS(`http://${window.location.host}/ws-connect`),
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
            connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            onConnect: () => {
                setStatus('Ligado e pronto a sincronizar!');
                client.subscribe(`/topic/user/${sessionId}`, handleUserEvent);
                client.subscribe(`/topic/chat/${sessionId}`, handleChatMessage);
                client.subscribe(`/topic/file/${sessionId}`, handleFileEvent);
                client.subscribe(`/topic/terminal/${sessionId}`, (message) => {
                    let out;
                    try { const payload = JSON.parse(message.body); out = payload.output ?? payload.data ?? payload.payload ?? message.body; } catch (_) { out = message.body; }
                    try { terminalWriteRef.current?.(out); } catch (_) {}
                });
                client.publish({ destination: `/app/user.join/${sessionId}`, body: JSON.stringify({ userId: `user-${Math.random().toString(36).substr(2,9)}`, username: localStorage.getItem('username') || 'User', type: 'JOIN' }) });
                try { client.publish({ destination: `/app/terminal.start/${sessionId}` }); } catch (_) {}
            },
            onStompError: (frame) => { console.error('STOMP error', frame); setStatus('Erro STOMP. Tentando reconectar...'); },
            onWebSocketClose: () => setStatus('Desconectado (WS fechado). Tentando reconectar...'),
        });
        client.activate();
        stompClientRef.current = client;
    };

    const handleCreateFile = async (fileInfo) => {
        if (!fileInfo?.name) return;

        const newFile = { name: fileInfo.name, content: `// Arquivo: ${fileInfo.name}\n`, language: fileInfo.language };

        try {
            const response = await fetch(`/api/sessions/${sessionId}/files`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(newFile) });
            if (response.ok) {
                if (stompClientRef.current?.connected) {
                    stompClientRef.current.publish({ destination: `/app/file/${sessionId}`, body: JSON.stringify({ type: 'CREATED', ...newFile }) });
                }
            } else {
                alert(`Erro ao criar arquivo: ${await response.text().catch(() => '')}`);
            }
        } catch (err) {
            alert('Não foi possível conectar ao serviço de sessão para criar o arquivo.');
        }
        setCreateFileModalOpen(false);
    };

    return (
        <>
            <CreateFileModal isOpen={isCreateFileModalOpen} onClose={() => setCreateFileModalOpen(false)} onCreate={handleCreateFile} />
            <div className="h-screen bg-slate-900 text-white flex flex-col font-sans overflow-hidden">
                <header className="bg-slate-800 p-3 shadow-md flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-xl font-bold">TeamCode - Editor</h1>
                        <p className="text-sm text-slate-400">Sessão: <span className="font-mono bg-slate-700 px-2 py-1 rounded">{sessionId}</span></p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="text-right">
                            <h3 className="text-white font-bold">Participantes ({participants.length})</h3>
                            <div className="text-xs text-slate-300">{Array.isArray(participants) ? participants.join(', ') : ''}</div>
                        </div>
                        <div className="text-sm font-mono bg-slate-700 px-3 py-1 rounded">Status: {status}</div>
                    </div>
                </header>

                <div className="flex flex-grow overflow-hidden">
                    <aside className="w-1/6 bg-slate-800/50 flex flex-col border-r border-slate-700">
                        <div className="p-3 border-b border-slate-700 flex justify-between items-center">
                            <h2 className="font-bold text-white">Arquivos</h2>
                            <button onClick={() => setCreateFileModalOpen(true)} className="px-2 py-1 text-xs bg-sky-600 hover:bg-sky-700 rounded">+</button>
                        </div>
                        <div className="flex-grow p-1 overflow-y-auto">
                            {(Array.isArray(files) ? files : [])
                                .filter(file => file && typeof file.name === 'string')
                                .map(file => (
                                    <div
                                        key={file.name}
                                        onClick={() => setActiveFile(file.name)}
                                        className={`flex items-center space-x-2 px-3 py-2 text-sm rounded cursor-pointer ${activeFile === file.name ? 'bg-sky-500/30 text-sky-300' : 'hover:bg-slate-700/50'}`}
                                    >
                                        <div className="w-5 h-5">{getFileIcon(file.name)}</div>
                                        <span className="truncate">{file.name}</span>
                                    </div>
                                ))}
                        </div>
                    </aside>

                    <div className="flex flex-col flex-grow" style={{ width: '58.333333%' }}>
                        <main className="h-3/4">
                            <Editor
                                height="100%"
                                theme="vs-dark"
                                language={getLanguageFromExtension(activeFile)}
                                onMount={handleEditorDidMount}
                                onChange={handleEditorChange}
                                options={{ automaticLayout: true }}
                            />
                        </main>
                        <footer className="h-1/4 border-t-2 border-slate-700">
                            <TerminalComponent
                                sessionId={sessionId}
                                stompClient={stompClientRef.current}
                                registerWriteFn={(fn) => { terminalWriteRef.current = fn; if (stompClientRef.current?.connected) { try { stompClientRef.current.publish({ destination: `/app/terminal.start/${sessionId}` }); } catch (_) {} } }}
                            />
                        </footer>
                    </div>

                    <aside className="w-1/4 bg-slate-800 flex flex-col border-l border-slate-700">
                        <div className="p-3 border-b border-slate-700"><h2 className="font-bold text-white">Chat da Sessão</h2></div>
                        <div className="flex-grow p-3 overflow-y-auto space-y-4">
                            {(Array.isArray(messages) ? messages : []).map((msg, idx) => (
                                <div key={idx} className="flex flex-col">
                                    <div className="flex items-baseline space-x-2"><span className="font-bold text-sky-400 text-sm">{msg.username}</span><span className="text-xs text-slate-500">{msg.timestamp}</span></div>
                                    <p className="text-slate-300 text-sm bg-slate-700/50 px-3 py-2 rounded-lg break-words">{msg.content}</p>
                                </div>
                            ))}
                            <div ref={chatMessagesEndRef} />
                        </div>
                        <div className="p-3 border-t border-slate-700">
                            <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChatMessage())} placeholder="Digite uma mensagem..." className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white resize-none" rows="3" />
                        </div>
                    </aside>
                </div>
            </div>
        </>
    );
}

/* -------------------- App principal -------------------- */
export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('jwtToken'));
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');

    if (!isAuthenticated) return <AuthPage onLoginSuccess={() => setIsAuthenticated(true)} />;
    if (sessionId) return <EditorPage sessionId={sessionId} />;
    return <HomePage />;
}
