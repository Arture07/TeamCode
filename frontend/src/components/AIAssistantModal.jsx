import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

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
    if (!match[0].startsWith('```tool_request')) {
      blocks.push(match[1].trim());
    }
  }
  return blocks;
}

function extractToolRequests(text) {
  const regex = /```tool_request\n([\s\S]*?)```/g;
  const requests = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      requests.push(JSON.parse(match[1].trim()));
    } catch(e) {}
  }
  return requests;
}

export default function AIAssistantModal({
  isOpen,
  onClose,
  activeFile,
  editorContent,
  selectedText,
  sessionId,
  onInsertCode,
  onExecuteCommand,
  onFileUpdated,
}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('teamcode-ai-mode') || 'chat';
  });
  const [attachments, setAttachments] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64Url = ev.target.result;
        const base64Data = base64Url.split(',')[1];
        setAttachments(prev => [...prev, { name: file.name, mimeType: file.type, data: base64Data, preview: base64Url }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = null;
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    Array.from(items).forEach(item => {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const base64Url = ev.target.result;
            const base64Data = base64Url.split(',')[1];
            setAttachments(prev => [...prev, { name: file.name || 'image.png', mimeType: file.type, data: base64Data, preview: base64Url }]);
          };
          reader.readAsDataURL(file);
        }
      }
    });
  };

  // Carregar histórico local
  useEffect(() => {
    if (isOpen && sessionId) {
      const savedChats = localStorage.getItem(`teamcode-ai-chats-${sessionId}`);
      if (savedChats) {
        const parsedChats = JSON.parse(savedChats);
        setChats(parsedChats);
        if (parsedChats.length > 0) {
          setActiveChatId(parsedChats[0].id);
          setMessages(parsedChats[0].messages);
        } else {
          setActiveChatId(null);
          setMessages([{ role: 'assistant', content: 'Olá! Sou seu assistente de código. Como posso ajudar?' }]);
        }
      } else {
        // Fallback to legacy
        const savedHistory = localStorage.getItem(`teamcode-ai-history-${sessionId}`);
        if (savedHistory) {
          const parsedHistory = JSON.parse(savedHistory);
          const legacyChat = { id: Date.now().toString(), title: 'Chat Inicial', messages: parsedHistory, updatedAt: Date.now() };
          setChats([legacyChat]);
          setActiveChatId(legacyChat.id);
          setMessages(legacyChat.messages);
          localStorage.setItem(`teamcode-ai-chats-${sessionId}`, JSON.stringify([legacyChat]));
        } else {
          setActiveChatId(null);
          setMessages([{ role: 'assistant', content: 'Olá! Sou seu assistente de código. Como posso ajudar?' }]);
        }
      }
    }
  }, [isOpen, sessionId]);

  // Salvar histórico local sempre que messages mudar
  useEffect(() => {
    if (messages.length > 0 && sessionId) {
      if (activeChatId) {
          setChats(prev => {
             const newChats = prev.map(c => c.id === activeChatId ? { ...c, messages, updatedAt: Date.now() } : c);
             localStorage.setItem(`teamcode-ai-chats-${sessionId}`, JSON.stringify(newChats));
             return newChats;
          });
      } else if (messages.length > 1) {
          const newId = Date.now().toString();
          const firstUserMsg = messages.find(m => m.role === 'user');
          const title = firstUserMsg ? firstUserMsg.content.substring(0, 25) + (firstUserMsg.content.length > 25 ? '...' : '') : 'Novo Chat';
          const newChat = { id: newId, title, messages, updatedAt: Date.now() };
          setActiveChatId(newId);
          setChats(prev => {
             const newChats = [newChat, ...prev];
             localStorage.setItem(`teamcode-ai-chats-${sessionId}`, JSON.stringify(newChats));
             return newChats;
          });
      }
    }
  }, [messages, sessionId]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Salvar mode local sempre que mudar
  useEffect(() => {
    localStorage.setItem('teamcode-ai-mode', mode);
  }, [mode]);

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
          sessionId,
          mode,
          message: text,
          context,
          attachments: attachments.map(a => ({ name: a.name, mimeType: a.mimeType, data: a.data })),
          history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      setAttachments([]);

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

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4">
        <div
          className="w-full max-w-5xl h-[85vh] flex flex-row border-2 glass-panel neo-shadow"
          style={{
            backgroundColor: 'var(--panel-bg-color)',
            borderColor: 'var(--panel-border-color)',
            color: 'var(--text-color)'
          }}
        >
          {/* Sidebar */}
          <div 
            className="w-64 flex flex-col border-r-2 flex-shrink-0"
            style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--header-bg-color)' }}
          >
            <div className="p-4 border-b-2" style={{ borderColor: 'var(--panel-border-color)' }}>
              <button
                onClick={() => {
                  setActiveChatId(null);
                  setMessages([{ role: 'assistant', content: 'Olá! Sou seu assistente de código. Como posso ajudar?' }]);
                }}
                className="w-full px-4 py-2 font-bold border-2 neo-shadow-button flex items-center justify-center gap-2 text-sm"
                style={{ backgroundColor: 'var(--button-bg-color)', color: 'var(--button-text-color)', borderColor: 'var(--panel-border-color)' }}
              >
                <span className="codicon codicon-plus" /> Novo Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {chats.map(chat => (
                <div 
                  key={chat.id}
                  className={`flex items-center justify-between p-3 border-2 neo-shadow-sm cursor-pointer transition-all ${chat.id === activeChatId ? '' : 'opacity-70 hover:opacity-100'}`}
                  style={{ 
                    backgroundColor: chat.id === activeChatId ? 'var(--primary-color)' : 'var(--input-bg-color)',
                    borderColor: chat.id === activeChatId ? 'var(--panel-border-color)' : 'transparent',
                    color: chat.id === activeChatId ? 'var(--primary-bg-color)' : 'var(--text-color)'
                  }}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setMessages(chat.messages);
                  }}
                >
                  <span className="truncate text-sm font-bold flex-1" title={chat.title}>{chat.title}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const newChats = chats.filter(c => c.id !== chat.id);
                      setChats(newChats);
                      localStorage.setItem(`teamcode-ai-chats-${sessionId}`, JSON.stringify(newChats));
                      if (activeChatId === chat.id) {
                        if (newChats.length > 0) {
                          setActiveChatId(newChats[0].id);
                          setMessages(newChats[0].messages);
                        } else {
                          setActiveChatId(null);
                          setMessages([{ role: 'assistant', content: 'Olá! Sou seu assistente de código. Como posso ajudar?' }]);
                        }
                      }
                    }}
                    className="ml-2 hover:text-red-500 opacity-60 hover:opacity-100 transition-opacity"
                    title="Excluir chat"
                  >
                    <span className="codicon codicon-trash" style={{ fontSize: 14 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
          <div
            className="p-4 border-b-2 flex justify-between items-center flex-shrink-0"
            style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--header-bg-color)' }}
          >
            <div className="flex items-center space-x-3">
              <span className="codicon codicon-robot text-2xl" style={{ color: 'var(--primary-color)' }} />
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--primary-color)' }}>
                  <span className="codicon codicon-hubot" /> AI Assistant
                </h2>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm font-medium">
                    <span>Modo:</span>
                    <select 
                      value={mode} 
                      onChange={e => setMode(e.target.value)}
                      className="px-2 py-1 border-2 focus:outline-none"
                      style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)', color: 'var(--text-color)' }}
                    >
                      <option value="chat">Perguntar</option>
                      <option value="agent">Agente</option>
                    </select>
                  </div>
                </div>
                {selectedText?.trim() && (
                  <p className="text-xs opacity-70 mt-1">
                    <span className="codicon codicon-selection" style={{ fontSize: 10 }} /> Usando seleção do editor
                  </p>
                )}
              </div>
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
                        <ReactMarkdown>{msg.content.replace(/```tool_request[\s\S]*?```/g, '')}</ReactMarkdown>
                      </div>

                      {/* Renderizar Tool Requests (Aprovações do Agente) */}
                      {extractToolRequests(msg.content).map((req, rIdx) => (
                        <div key={`tool-${rIdx}`} className="mt-4 border-2 p-3 rounded-lg" style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--header-bg-color)' }}>
                          <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                            <span className="codicon codicon-warning text-yellow-500" />
                            <span>A IA deseja {req.tool === 'run_terminal_command' ? 'executar um comando no terminal' : 'modificar um arquivo'}:</span>
                          </div>
                          
                          {req.tool === 'run_terminal_command' && (
                            <div className="font-mono text-xs p-2 bg-black/50 text-green-400 rounded mb-3 break-all">
                              $ {req.args.command}
                            </div>
                          )}
                          {req.tool === 'update_file' && (
                            <div className="text-xs mb-3">
                              <p className="font-bold mb-1">Arquivo: {req.args.path}</p>
                              <div className="font-mono p-2 bg-black/50 text-gray-300 rounded max-h-32 overflow-y-auto whitespace-pre">
                                {req.args.content}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                if (req.tool === 'run_terminal_command' && onExecuteCommand) {
                                  onExecuteCommand(req.args.command);
                                  handleSend(`O comando \`${req.args.command}\` foi aprovado e enviado ao terminal. Aguarde o resultado ou continue me auxiliando.`);
                                } else if (req.tool === 'update_file') {
                                  try {
                                    const res = await fetch('/api/ai/execute-tool', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': localStorage.getItem('jwtToken') ? `Bearer ${localStorage.getItem('jwtToken')}` : ''
                                      },
                                      body: JSON.stringify({
                                        name: req.tool,
                                        args: req.args,
                                        sessionId
                                      })
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      if (data.response && data.response.startsWith('Erro')) {
                                        handleSend(`Falha ao executar ferramenta: ${data.response}`);
                                      } else {
                                        handleSend(`O arquivo \`${req.args.path}\` foi atualizado com sucesso!`);
                                        if (onFileUpdated) {
                                          onFileUpdated(req.args.path);
                                        }
                                      }
                                    }
                                  } catch (e) {
                                    console.error(e);
                                    handleSend(`Falha na comunicação com o servidor: ${e.message}`);
                                  }
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-bold border-2 rounded hover:opacity-80 transition-opacity bg-green-500/20 text-green-500 border-green-500/50"
                            >
                              <span className="codicon codicon-check mr-1" /> Aprovar
                            </button>
                            <button
                              onClick={() => {
                                handleSend(`Eu neguei a execução da ferramenta ${req.tool}. Por favor, proponha uma solução alternativa.`);
                              }}
                              className="px-3 py-1.5 text-xs font-bold border-2 rounded hover:opacity-80 transition-opacity bg-red-500/20 text-red-500 border-red-500/50"
                            >
                              <span className="codicon codicon-close mr-1" /> Recusar
                            </button>
                          </div>
                        </div>
                      ))}

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
            
            {attachments.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                {attachments.map((att, idx) => (
                  <div key={idx} className="relative w-16 h-16 border-2 flex items-center justify-center flex-shrink-0 group" style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--input-bg-color)' }}>
                    {att.mimeType.startsWith('image/') ? (
                      <img src={att.preview} alt={att.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="codicon codicon-file text-2xl opacity-80" />
                    )}
                    <button 
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex space-x-2 items-stretch">
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 border-2 flex items-center justify-center neo-shadow-button hover:opacity-80 transition-opacity"
                style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--input-bg-color)', color: 'var(--text-color)' }}
                title="Anexar arquivo ou imagem"
              >
                <span className="codicon codicon-link text-lg" />
              </button>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                onPaste={handlePaste}
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
      </div>
    </>
  );
}
