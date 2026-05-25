import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import ConfirmDialog from './ConfirmDialog';

// Botões de ações rápidas pré-definidos
const QUICK_ACTIONS = [
  { label: '💡 Explique este código', prompt: 'Explique o que este código faz, de forma clara e didática:' },
  { label: '🐛 Corrija os erros', prompt: 'Encontre e corrija todos os erros neste código:' },
  { label: '🧪 Escreva testes', prompt: 'Escreva testes unitários para este código:' },
  { label: '📝 Documente (JSDoc)', prompt: 'Adicione documentação JSDoc completa a este código:' },
  { label: '⚡ Otimize', prompt: 'Sugira otimizações de performance para este código:' },
  { label: '🔒 Revise segurança', prompt: 'Analise e aponte vulnerabilidades de segurança neste código:' },
];

// Extrai blocos de código de uma resposta markdown
function extractCodeBlocks(text) {
  const regex = /```(?:\w+)?\n?([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

export default function AIAssistantModal({
  isOpen,
  onClose,
  activeFile,
  editorContent,
  selectedText,
  sessionId,
  onInsertCode,
}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  const handleSend = async (customInput) => {
    const text = customInput ?? input;
    if (!text.trim()) return;

    // Contexto: seleção ou arquivo inteiro
    const context = selectedText?.trim()
      ? `Trecho selecionado:\n\`\`\`\n${selectedText}\n\`\`\``
      : editorContent;

    const userMsg = { role: 'user', content: text };
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
          message: text,
          context,
        })
      });

      if (!res.ok) throw new Error('Falha na comunicação com a IA');

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua solicitação.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    const context = selectedText?.trim()
      ? `${action.prompt}\n\n\`\`\`\n${selectedText}\n\`\`\``
      : `${action.prompt}\n\n\`\`\`\n${editorContent || ''}\n\`\`\``;
    handleSend(context);
  };

  const handleClearHistory = () => setConfirmOpen(true);
  const confirmClear = () => {
    setMessages([{ role: 'assistant', content: 'Olá! Sou seu assistente de código. Como posso ajudar?' }]);
    if (sessionId) localStorage.removeItem(`teamcode-ai-history-${sessionId}`);
    setConfirmOpen(false);
  };

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        title="Limpar histórico"
        message="Deseja apagar o histórico de chat desta sessão? Esta ação não pode ser desfeita."
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        onConfirm={confirmClear}
        onCancel={() => setConfirmOpen(false)}
      />

      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
        <div
          className="w-full max-w-3xl h-[85vh] flex flex-col border-2 glass-panel neo-shadow"
          style={{
            backgroundColor: 'var(--panel-bg-color)',
            borderColor: 'var(--panel-border-color)',
            color: 'var(--text-color)'
          }}
        >
          {/* Header */}
          <div
            className="p-4 border-b-2 flex justify-between items-center flex-shrink-0"
            style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--header-bg-color)' }}
          >
            <div className="flex items-center space-x-3">
              <span className="codicon codicon-robot text-2xl" style={{ color: 'var(--primary-color)' }} />
              <div>
                <h2 className="text-xl font-bold leading-tight" style={{ color: 'var(--primary-color)' }}>
                  AI Assistant
                </h2>
                {selectedText?.trim() && (
                  <p className="text-xs opacity-70">
                    <span className="codicon codicon-selection" style={{ fontSize: 10 }} /> Usando seleção do editor
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleClearHistory}
                className="text-sm border px-2 py-1 hover:opacity-70 flex items-center gap-1"
                title="Limpar histórico"
                style={{ borderColor: 'var(--panel-border-color)' }}
              >
                <span className="codicon codicon-trash" style={{ fontSize: 12 }} />
                <span className="text-xs">Limpar</span>
              </button>
              <button onClick={onClose} className="text-2xl font-bold hover:opacity-70 ml-2">&times;</button>
            </div>
          </div>

          {/* Quick Actions */}
          <div
            className="flex-shrink-0 px-4 py-2 border-b flex flex-wrap gap-2"
            style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--header-bg-color)' }}
          >
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action)}
                disabled={loading}
                className="text-xs px-2 py-1 border rounded-full hover:opacity-80 transition-opacity disabled:opacity-40 whitespace-nowrap"
                style={{
                  borderColor: 'var(--primary-color)',
                  color: 'var(--primary-color)',
                  backgroundColor: 'var(--primary-bg-color)',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Chat Area */}
          <div className="flex-grow overflow-y-auto p-6 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] p-4 rounded-lg border-2 ${msg.role === 'user' ? 'rounded-br-none' : 'rounded-bl-none'}`}
                  style={{
                    backgroundColor: msg.role === 'user' ? 'var(--primary-color)' : 'var(--input-bg-color)',
                    color: msg.role === 'user' ? '#fff' : 'var(--text-color)',
                    borderColor: 'var(--panel-border-color)',
                  }}
                >
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap text-[15px] font-medium">{msg.content}</p>
                  ) : (
                    <div>
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {/* Botão "Inserir no editor" quando há blocos de código */}
                      {onInsertCode && extractCodeBlocks(msg.content).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {extractCodeBlocks(msg.content).map((code, cIdx) => (
                            <button
                              key={cIdx}
                              onClick={() => onInsertCode(code)}
                              className="flex items-center gap-1 text-xs px-3 py-1 border rounded hover:opacity-80 font-bold transition-opacity"
                              style={{
                                borderColor: 'var(--primary-color)',
                                color: 'var(--primary-color)',
                                backgroundColor: 'var(--primary-bg-color)',
                              }}
                            >
                              <span className="codicon codicon-insert" style={{ fontSize: 11 }} />
                              {extractCodeBlocks(msg.content).length > 1 ? `Inserir bloco ${cIdx + 1}` : 'Inserir no editor'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="p-4 rounded-lg border-2 rounded-bl-none"
                  style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)' }}
                >
                  <span className="animate-pulse flex items-center space-x-2">
                    <span className="codicon codicon-loading codicon-modifier-spin" />
                    <span>Processando...</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            className="p-4 border-t-2 flex-shrink-0"
            style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--header-bg-color)' }}
          >
            {activeFile && (
              <div className="text-xs mb-2 opacity-80 flex items-center space-x-1">
                <span className="codicon codicon-file" style={{ fontSize: 11 }} />
                <span>
                  Contexto: <b>{activeFile}</b>
                  {selectedText?.trim() && <span className="ml-2 text-yellow-400">(usando seleção)</span>}
                </span>
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
                  backgroundColor: 'var(--input-bg-color)',
                  borderColor: 'var(--panel-border-color)',
                  color: 'var(--text-color)',
                  '--tw-ring-color': 'var(--primary-color)',
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="px-6 py-2 font-bold border-2 neo-shadow-button disabled:opacity-50 flex items-center justify-center space-x-2 h-auto"
                style={{
                  backgroundColor: 'var(--button-bg-color)',
                  color: 'var(--button-text-color)',
                  borderColor: 'var(--panel-border-color)',
                }}
              >
                <span className="codicon codicon-send" />
                <span>Enviar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
