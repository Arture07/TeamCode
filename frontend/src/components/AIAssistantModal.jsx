import React, { useState, useRef, useEffect } from 'react';

export default function AIAssistantModal({ isOpen, onClose, activeFile, editorContent }) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Olá! Sou seu assistente de código. Como posso ajudar?' }
    ]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

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

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl h-[600px] flex flex-col border-2 glass-panel neo-shadow"
                 style={{ 
                     backgroundColor: "var(--panel-bg-color)", 
                     borderColor: "var(--panel-border-color)",
                     color: "var(--text-color)"
                 }}>
                
                {/* Header */}
                <div className="p-4 border-b-2 flex justify-between items-center"
                     style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--header-bg-color)" }}>
                    <div className="flex items-center space-x-2">
                        <span className="codicon codicon-robot text-xl"></span>
                        <h2 className="text-xl font-bold" style={{ color: "var(--primary-color)" }}>AI Assistant</h2>
                    </div>
                    <button onClick={onClose} className="text-xl font-bold hover:opacity-70">&times;</button>
                </div>

                {/* Chat Area */}
                <div className="flex-grow overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg border-2 ${
                                msg.role === 'user' 
                                    ? 'rounded-br-none' 
                                    : 'rounded-bl-none'
                            }`}
                            style={{
                                backgroundColor: msg.role === 'user' ? 'var(--primary-color)' : 'var(--input-bg-color)',
                                color: msg.role === 'user' ? '#fff' : 'var(--text-color)',
                                borderColor: "var(--panel-border-color)"
                            }}>
                                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="p-3 rounded-lg border-2 rounded-bl-none"
                                 style={{ backgroundColor: 'var(--input-bg-color)', borderColor: "var(--panel-border-color)" }}>
                                <span className="animate-pulse">Digitando...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t-2" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--header-bg-color)" }}>
                    {activeFile && (
                        <div className="text-xs mb-2 opacity-70">
                            Contexto: {activeFile}
                        </div>
                    )}
                    <div className="flex space-x-2">
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Pergunte algo sobre seu código..."
                            className="flex-grow p-3 border-2 focus:outline-none focus:ring-2"
                            style={{ 
                                backgroundColor: "var(--input-bg-color)", 
                                borderColor: "var(--panel-border-color)", 
                                color: "var(--text-color)",
                                "--tw-ring-color": "var(--primary-color)"
                            }}
                        />
                        <button 
                            onClick={handleSend}
                            disabled={loading}
                            className="px-6 py-2 font-bold border-2 neo-shadow-button disabled:opacity-50"
                            style={{ 
                                backgroundColor: "var(--button-bg-color)", 
                                color: "var(--button-text-color)", 
                                borderColor: "var(--panel-border-color)" 
                            }}
                        >
                            Enviar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
