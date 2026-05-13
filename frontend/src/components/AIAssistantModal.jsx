import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

export default function AIAssistantModal({ isOpen, onClose, activeFile, editorContent, sessionId }) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Carregar histórico local
    useEffect(() => {
        if (isOpen && sessionId) {
            const savedHistory = localStorage.getItem(`teamcode-ai-history-${sessionId}`);
            if (savedHistory) {
                setMessages(JSON.parse(savedHistory));
            } else {
                setMessages([
                    { role: 'assistant', content: 'Olá! Sou seu assistente de código. Como posso ajudar?' }
                ]);
            }
        }
    }, [isOpen, sessionId]);

    // Salvar histórico local
    useEffect(() => {
        if (messages.length > 0 && sessionId) {
            localStorage.setItem(`teamcode-ai-history-${sessionId}`, JSON.stringify(messages));
        }
    }, [messages, sessionId]);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    if (!isOpen) return null;

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': localStorage.getItem('jwtToken') ? `Bearer ${localStorage.getItem('jwtToken')}` : ''
                },
                body: JSON.stringify({
                    message: userMsg.content,
                    context: editorContent // Send current code as context
                })
            });

            if (!res.ok) throw new Error('Falha na comunicação com a IA');

            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro ao processar sua solicitação.' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleClearHistory = () => {
        if (window.confirm("Deseja apagar o histórico de chat desta sessão?")) {
            setMessages([{ role: 'assistant', content: 'Olá! Sou seu assistente de código. Como posso ajudar?' }]);
            if (sessionId) {
                localStorage.removeItem(`teamcode-ai-history-${sessionId}`);
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-3xl h-[80vh] flex flex-col border-2 glass-panel neo-shadow"
                style={{
                    backgroundColor: "var(--panel-bg-color)",
                    borderColor: "var(--panel-border-color)",
                    color: "var(--text-color)"
                }}>

                {/* Header */}
                <div className="p-4 border-b-2 flex justify-between items-center"
                    style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--header-bg-color)" }}>
                    <div className="flex items-center space-x-3">
                        <span className="codicon codicon-robot text-2xl" style={{ color: "var(--primary-color)" }}></span>
                        <h2 className="text-xl font-bold" style={{ color: "var(--primary-color)" }}>AI Assistant</h2>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={handleClearHistory} className="text-sm border px-2 py-1 hover:opacity-70" title="Limpar histórico">
                            <span className="codicon codicon-trash"></span>
                        </button>
                        <button onClick={onClose} className="text-2xl font-bold hover:opacity-70 ml-2">&times;</button>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-4 rounded-lg border-2 ${msg.role === 'user'
                                    ? 'rounded-br-none'
                                    : 'rounded-bl-none'
                                }`}
                                style={{
                                    backgroundColor: msg.role === 'user' ? 'var(--primary-color)' : 'var(--input-bg-color)',
                                    color: msg.role === 'user' ? '#fff' : 'var(--text-color)',
                                    borderColor: "var(--panel-border-color)"
                                }}>
                                {msg.role === 'user' ? (
                                    <p className="whitespace-pre-wrap text-[15px] font-medium">{msg.content}</p>
                                ) : (
                                    <div className="prose prose-sm max-w-none dark:prose-invert">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="p-4 rounded-lg border-2 rounded-bl-none"
                                style={{ backgroundColor: 'var(--input-bg-color)', borderColor: "var(--panel-border-color)" }}>
                                <span className="animate-pulse flex items-center space-x-2">
                                    <span className="codicon codicon-loading codicon-modifier-spin"></span>
                                    <span>Processando...</span>
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t-2" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--header-bg-color)" }}>
                    {activeFile && (
                        <div className="text-xs mb-2 opacity-80 flex items-center space-x-1">
                            <span className="codicon codicon-file"></span>
                            <span>Contexto: <b>{activeFile}</b></span>
                        </div>
                    )}
                    <div className="flex space-x-2">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Pergunte algo sobre seu código (Enter para enviar, Shift+Enter para nova linha)..."
                            className="flex-grow p-3 border-2 focus:outline-none focus:ring-2 resize-none"
                            rows={2}
                            style={{
                                backgroundColor: "var(--input-bg-color)",
                                borderColor: "var(--panel-border-color)",
                                color: "var(--text-color)",
                                "--tw-ring-color": "var(--primary-color)"
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className="px-6 py-2 font-bold border-2 neo-shadow-button disabled:opacity-50 flex items-center justify-center space-x-2 h-auto"
                            style={{
                                backgroundColor: "var(--button-bg-color)",
                                color: "var(--button-text-color)",
                                borderColor: "var(--panel-border-color)"
                            }}
                        >
                            <span className="codicon codicon-send"></span>
                            <span>Enviar</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
