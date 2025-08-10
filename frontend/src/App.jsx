import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import * as monaco from 'monaco-editor';
import './index.css';

// Gera um nome de utilizador e ID aleatórios
const myUsername = localStorage.getItem('username') || `User${Math.floor(Math.random() * 1000)}`;
const myUserId = "user-" + Math.random().toString(36).substr(2, 9);

// --- Modal de criação de ficheiros ---
function CreateFileModal({ isOpen, onClose, onCreate }) {
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 0);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCreate = () => {
        const fileName = inputRef.current?.value;
        if (fileName) onCreate(fileName);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleCreate();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4">
                <h2 className="text-xl font-bold text-white">Criar Novo Ficheiro</h2>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Ex: script.js"
                    onKeyDown={handleKeyDown}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500"
                />
                <div className="flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg">Cancelar</button>
                    <button onClick={handleCreate} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-lg">Criar</button>
                </div>
            </div>
        </div>
    );
}

// --- Login e Registro ---
function AuthPage({ onLoginSuccess }) {
    const [isLoginView, setIsLoginView] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        const url = isLoginView ? '/api/users/login' : '/api/users/register';
        const body = isLoginView ? { username, password } : { username, email, password };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const responseData = await response.text();

            if (!response.ok) throw new Error(responseData || `Erro ${response.status}`);

            if (isLoginView) {
                const { token } = JSON.parse(responseData);
                localStorage.setItem('jwtToken', token);
                localStorage.setItem('username', username);
                onLoginSuccess();
            } else {
                setIsLoginView(true);
                setError("Registo bem-sucedido! Agora faça login.");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
                <div className="text-center">
                    <h1 className="text-4xl font-bold">TeamCode</h1>
                    <p className="text-slate-300 mt-2">{isLoginView ? 'Bem-vindo de volta!' : 'Crie a sua conta'}</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuário"
                           className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg" required />
                    {!isLoginView && (
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
                               className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg" required />
                    )}
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha"
                           className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg" required />
                    <button type="submit" disabled={isLoading}
                            className="w-full bg-sky-600 hover:bg-sky-700 font-bold py-3 px-4 rounded-lg transition-all disabled:bg-slate-500">
                        {isLoading ? 'Processando...' : (isLoginView ? 'Entrar' : 'Registrar')}
                    </button>
                </form>
                {error && <div className="bg-red-500/20 text-red-300 px-4 py-3 rounded-lg text-center text-sm">{error}</div>}
                <p className="text-center text-sm text-slate-400">
                    {isLoginView ? 'Não tem uma conta?' : 'Já possui conta?'}
                    <button onClick={() => { setIsLoginView(!isLoginView); setError(null); }}
                            className="font-semibold text-sky-400 hover:text-sky-500 ml-2">
                        {isLoginView ? 'Registre-se' : 'Fazer login'}
                    </button>
                </p>
            </div>
        </div>
    );
}

// --- Página Inicial ---
function HomePage() {
    const [sessionName, setSessionName] = useState('');
    const [createdSession, setCreatedSession] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleCreateSession = async () => {
        if (!sessionName.trim()) {
            setError('Insira um nome para a sessão');
            return;
        }
        setIsLoading(true);
        try {
            const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName }),
            });
            if (!response.ok) throw new Error(`Erro na API (${response.status})`);
            const data = await response.json();
            setCreatedSession(data);
        } catch (err) {
            setError("Erro ao conectar com o serviço de sessão.");
        } finally {
            setIsLoading(false);
        }
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
                <span>Olá, {localStorage.getItem('username')}!</span>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }}
                        className="ml-4 px-3 py-1 bg-red-600 hover:bg-red-700 rounded-lg">Logout</button>
            </div>
            <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
                <div className="text-center">
                    <h1 className="text-4xl font-bold">TeamCode</h1>
                    <p className="text-slate-300 mt-2">Crie uma sala de programação colaborativa</p>
                </div>
                <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Nome da sessão"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg"
                />
                <button
                    onClick={handleCreateSession}
                    disabled={isLoading}
                    className="w-full bg-sky-600 hover:bg-sky-700 font-bold py-3 px-4 rounded-lg transition-all disabled:bg-slate-500"
                >
                    {isLoading ? 'Criando...' : 'Criar Sessão'}
                </button>
                {error && <div className="bg-red-500/20 text-red-300 px-4 py-3 rounded-lg text-center">{error}</div>}
                {createdSession && (
                    <div className="bg-green-500/20 text-green-300 px-4 py-3 rounded-lg space-y-2">
                        <h3 className="font-bold text-center text-white">Sessão Criada!</h3>
                        <p className="text-sm">Compartilhe esse link:</p>
                        <input type="text" readOnly value={getEditorLink()}
                               className="w-full bg-slate-900 p-2 rounded-lg outline-none" />
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Componente da Página do Editor ---
function EditorPage({ sessionId }) {
    const editorRef = useRef(null);
    const stompClientRef = useRef(null);
    const remoteCursorDecorationsRef = useRef({});
    const remoteDecorations = useRef({});
    const chatMessagesEndRef = useRef(null);

    const [status, setStatus] = useState('A carregar dados da sessão...');
    const [participants, setParticipants] = useState([]);
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [files, setFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [isCreateFileModalOpen, setCreateFileModalOpen] = useState(false);

    useEffect(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        // CORREÇÃO: Usar 127.0.0.1
        fetch(`/api/sessions/${sessionId}`)
            .then(res => res.json())
            .then(data => {
                setFiles(data.files || []);
                setActiveFile(data.files[0]?.name || null);
                setStatus('A carregar o editor...');
            })
            .catch(err => {
                console.error(err);
                setStatus("Erro ao carregar dados da sessão.");
            });

        return () => {
            stompClientRef.current?.deactivate();
            editorRef.current?.dispose();
        };
    }, [sessionId]);

    useEffect(() => {
        if (editorRef.current && activeFile) {
            const fileData = files.find(f => f.name === activeFile);
            if (fileData && editorRef.current.getValue() !== fileData.content) {
                editorRef.current.setValue(fileData.content);
            }
        }
    }, [activeFile, files]);

    const handleEditorDidMount = (editor) => {
        editorRef.current = editor;

        // Quando o cursor local se mover, publica a posição
        editor.onDidChangeCursorPosition(e => {
            if (stompClientRef.current?.connected) {
                stompClientRef.current.publish({
                    destination: `/app/cursor/${sessionId}`,
                    body: JSON.stringify({
                        userId: myUserId,
                        username: myUsername,
                        lineNumber: e.position.lineNumber,
                        column: e.position.column
                    })
                });
            }
        });
        setStatus('A ligar ao servidor...');
        connectToWebSocket();
    };

    const handleEditorChange = (value) => {
        if (activeFile) {
            setFiles(prevFiles =>
                prevFiles.map(f =>
                    f.name === activeFile ? { ...f, content: value } : f
                )
            );
            if (stompClientRef.current?.connected) {
                stompClientRef.current.publish({
                    destination: `/app/file/${sessionId}`,   // nota o /app/… que bate no backend
                    body: JSON.stringify({
                        type: 'UPDATED',
                        name: activeFile,
                        content: value
                    })
                });
            }
        }
        fetch(`/api/sessions/${sessionId}/files`, {
            method: 'PUT',    // você terá que expor um endpoint PUT no backend
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: activeFile, content: value })
        }).catch(console.error);
    };

    const connectToWebSocket = () => {
        const client = new Client({
            webSocketFactory: () => new SockJS(`http://${window.location.host}/ws-connect`),
            onConnect: () => {
                setStatus("Ligado e pronto a sincronizar!");

                client.subscribe(`/topic/user/${sessionId}`, handleUserEvent);
                client.subscribe(`/topic/chat/${sessionId}`, handleChatMessage);
                client.subscribe(`/topic/file/${sessionId}`, handleFileEvent);

                client.subscribe(`/topic/cursor/${sessionId}`, message => {
                    const cursor = JSON.parse(message.body);
                    if (cursor.userId === myUserId) return;

                    const editor = editorRef.current;
                    const remoteCursorDecorations = remoteCursorDecorationsRef.current;

                    const oldDecorations = remoteCursorDecorations[cursor.userId] || [];
                    const newDecorations = editor.deltaDecorations(
                        oldDecorations,
                        [{
                            range: new monaco.Range(cursor.lineNumber, 1, cursor.lineNumber, 1),
                            options: {
                                isWholeLine: true,
                                className: 'remoteCursorLine',
                                glyphMarginClassName: 'remoteCursorGlyph',
                                glyphMarginHoverMessage: { value: `**${cursor.username}**` }
                            }
                        }]
                    );

                    remoteCursorDecorationsRef.current[cursor.userId] = newDecorations;
                });

                client.publish({
                    destination: `/app/user.join/${sessionId}`,
                    body: JSON.stringify({ userId: myUserId, username: myUsername, type: 'JOIN' }),
                });
            },
            onStompError: () => setStatus("Erro de ligação."),
        });

        client.activate();
        stompClientRef.current = client;
    };

    const handleCreateFile = async (fileName) => {
        if (!fileName.trim()) return;
        const newFile = { name: fileName.trim(), content: `// Ficheiro: ${fileName.trim()}\n` };

        try {
            // CORREÇÃO: Usar 127.0.0.1
            const response = await fetch(`/api/sessions/${sessionId}/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newFile),
            });
            if (response.ok) {
                if (stompClientRef.current?.connected) {
                    stompClientRef.current.publish({
                        destination: `/app/file/${sessionId}`,
                        body: JSON.stringify({ type: 'CREATED', ...newFile }),
                    });
                }
            } else {
                alert(`Erro ao criar o ficheiro: ${await response.text()}`);
            }
        } catch (err) {
            alert("Não foi possível ligar ao serviço de sessão para criar o ficheiro.");
        }
        setCreateFileModalOpen(false);
    };

    const handleFileEvent = (message) => {
        const event = JSON.parse(message.body);
        setFiles(prevFiles => {
            // Se for CREATED, adiciona novo; se for UPDATED, altera existente
            if (event.type === 'CREATED') {
                return [...prevFiles, { name: event.name, content: event.content }];
            }
            // para qualquer outro (incluindo UPDATED), atualiza o conteúdo
            return prevFiles.map(f =>
                f.name === event.name
                    ? { ...f, content: event.content }
                    : f
            );
        });
    };

    const handleChatMessage = (message) => {
        setMessages(prev => [...prev, JSON.parse(message.body)]);
    };

    const handleSendChatMessage = () => {
        if (chatInput.trim() && stompClientRef.current?.connected) {
            stompClientRef.current.publish({
                destination: `/app/chat/${sessionId}`,
                body: JSON.stringify({ username: myUsername, content: chatInput.trim() }),
            });
            setChatInput('');
        }
    };

    const handleUserEvent = (message) => {
        setParticipants(JSON.parse(message.body).participants);
    };

    return (
        <React.Fragment>
            <CreateFileModal isOpen={isCreateFileModalOpen} onClose={() => setCreateFileModalOpen(false)} onCreate={handleCreateFile} />
            <div className="h-screen bg-slate-900 text-white flex flex-col font-sans overflow-hidden">
                <header className="bg-slate-800 p-3 shadow-md flex justify-between items-center shrink-0">
                    <div>
                        <h1 className="text-xl font-bold">TeamCode - Editor</h1>
                        <p className="text-sm text-slate-400">Sessão ID: <span className="font-mono bg-slate-700 px-2 py-1 rounded">{sessionId}</span></p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="text-right">
                            <h3 className="text-white font-bold">Participantes ({participants.length})</h3>
                            <div className="text-xs text-slate-300">{participants.join(', ')}</div>
                        </div>
                        <div className="text-sm font-mono bg-slate-700 px-3 py-1 rounded">Status: {status}</div>
                    </div>
                </header>
                <div className="flex flex-grow overflow-hidden">
                    <aside className="w-1/6 bg-slate-800/50 flex flex-col border-r border-slate-700">
                        <div className="p-3 border-b border-slate-700 flex justify-between items-center">
                            <h2 className="font-bold text-white">Ficheiros</h2>
                            <button onClick={() => setCreateFileModalOpen(true)} className="px-2 py-1 text-xs bg-sky-600 hover:bg-sky-700 rounded">+</button>
                        </div>
                        <div className="flex-grow p-1 overflow-y-auto">
                            {files.map(file => (
                                <div key={file.name}
                                     onClick={() => setActiveFile(file.name)}
                                     className={`px-3 py-2 text-sm rounded cursor-pointer ${activeFile === file.name ? 'bg-sky-500/30 text-sky-300' : 'hover:bg-slate-700/50'}`}>
                                    {file.name}
                                </div>
                            ))}
                        </div>
                    </aside>
                    <main className="flex-grow w-2/3">
                        <Editor
                            height="100%"
                            theme="vs-dark"
                            language="javascript"
                            onMount={handleEditorDidMount}
                            onChange={handleEditorChange}
                        />
                    </main>
                    <aside className="w-1/4 bg-slate-800 flex flex-col border-l border-slate-700">
                        <div className="p-3 border-b border-slate-700">
                            <h2 className="font-bold text-white">Chat da Sessão</h2>
                        </div>
                        <div className="flex-grow p-3 overflow-y-auto space-y-4">
                            {messages.map((msg, index) => (
                                <div key={index} className="flex flex-col">
                                    <div className="flex items-baseline space-x-2">
                                        <span className="font-bold text-sky-400 text-sm">{msg.username}</span>
                                        <span className="text-xs text-slate-500">{msg.timestamp}</span>
                                    </div>
                                    <p className="text-slate-300 text-sm bg-slate-700/50 px-3 py-2 rounded-lg break-words">{msg.content}</p>
                                </div>
                            ))}
                            <div ref={chatMessagesEndRef} />
                        </div>
                        <div className="p-3 border-t border-slate-700">
                            <textarea
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendChatMessage())}
                                placeholder="Digite uma mensagem..."
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none"
                                rows="3"
                            />
                        </div>
                    </aside>
                </div>
            </div>
        </React.Fragment>
    );
}

// --- Componente Principal ---
export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('jwtToken'));
    const sessionId = new URLSearchParams(window.location.search).get('sessionId');

    if (!isAuthenticated) return <AuthPage onLoginSuccess={() => setIsAuthenticated(true)} />;
    if (sessionId) return <EditorPage sessionId={sessionId} />;
    return <HomePage />;
}