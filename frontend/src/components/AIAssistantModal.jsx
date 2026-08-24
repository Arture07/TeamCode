import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

// Botões de ações rápidas pré-definidos
const QUICK_ACTIONS = [
  { label: '🚀 Criar Mini-Projeto', prompt: 'Crie um mini projeto completo e funcional com index.html, style.css, script.js e package.json pronto para rodar com npm:' },
  { label: '💡 Explique este código', prompt: 'Explique o que este código faz, de forma clara e didática:' },
  { label: '🐛 Corrija os erros', prompt: 'Encontre e corrija todos os erros neste código:' },
  { label: '🧪 Escreva testes', prompt: 'Escreva testes unitários para este código:' },
  { label: '📝 Documente', prompt: 'Adicione documentação JSDoc completa a este código:' },
  { label: '⚡ Otimize', prompt: 'Sugira otimizações de performance para este código:' },
];

function extractCodeBlocks(text) {
  if (!text) return [];
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
  if (!text) return [];
  const regex = /```tool_request\n([\s\S]*?)```/g;
  const requests = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      requests.push(JSON.parse(match[1].trim()));
    } catch (_) {}
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
    return localStorage.getItem('teamcode-ai-mode') || 'agent';
  });
  const [attachments, setAttachments] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [editingMsgIndex, setEditingMsgIndex] = useState(null);
  const [editingMsgText, setEditingMsgText] = useState('');
  const [expandedFiles, setExpandedFiles] = useState({});
  const [copiedCodeIdx, setCopiedCodeIdx] = useState(null);
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

  useEffect(() => {
    if (isOpen && sessionId) {
      const savedChats = localStorage.getItem(`teamcode-ai-chats-${sessionId}`);
      if (savedChats) {
        try {
          const parsedChats = JSON.parse(savedChats);
          setChats(parsedChats);
          if (parsedChats.length > 0) {
            setActiveChatId(parsedChats[0].id);
            setMessages(parsedChats[0].messages);
          } else {
            setActiveChatId(null);
            setMessages([{ role: 'assistant', content: 'Olá! Sou o seu Agente de IA para desenvolvimento colaborativo. Posso criar projetos completos, modificar múltiplos arquivos de uma só vez e executar comandos no terminal. Como posso ajudar?' }]);
          }
        } catch (_) {}
      } else {
        setActiveChatId(null);
        setMessages([{ role: 'assistant', content: 'Olá! Sou o seu Agente de IA para desenvolvimento colaborativo. Posso criar projetos completos, modificar múltiplos arquivos de uma só vez e executar comandos no terminal. Como posso ajudar?' }]);
      }
    }
  }, [isOpen, sessionId]);

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

  useEffect(() => {
    localStorage.setItem('teamcode-ai-mode', mode);
  }, [mode]);

  if (!isOpen) return null;

  const handleSend = async (customInput, historyOverride = null) => {
    const text = customInput ?? input;
    if (!text.trim()) return;

    const context = selectedText?.trim()
      ? `Trecho selecionado:\n\`\`\`\n${selectedText}\n\`\`\``
      : editorContent;

    const baseHistory = historyOverride ?? messages;
    const userMsg = { role: 'user', content: text };
    const newMessages = [...baseHistory, userMsg];
    
    setMessages(newMessages);
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
          history: baseHistory.map(m => ({ role: m.role, content: m.content }))
        })
      });
      setAttachments([]);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Falha na comunicação com a IA');
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: error.message || 'Desculpe, ocorreu um erro ao processar sua solicitação.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditAndRegenerate = (index) => {
    if (!editingMsgText.trim()) return;
    const historyBefore = messages.slice(0, index);
    const newPrompt = editingMsgText.trim();
    setEditingMsgIndex(null);
    setEditingMsgText('');
    handleSend(newPrompt, historyBefore);
  };

  const handleRegenerateLast = () => {
    if (loading || messages.length < 2) return;
    const lastUserIdx = messages.map(m => m.role).lastIndexOf('user');
    if (lastUserIdx !== -1) {
      const lastUserMsg = messages[lastUserIdx].content;
      const historyBefore = messages.slice(0, lastUserIdx);
      handleSend(lastUserMsg, historyBefore);
    }
  };

  const handleCopyCode = (code, idx) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCodeIdx(idx);
      setTimeout(() => setCopiedCodeIdx(null), 2000);
    });
  };

  const toggleExpandFile = (pathKey) => {
    setExpandedFiles(prev => ({ ...prev, [pathKey]: !prev[pathKey] }));
  };

  const handleApproveBatchFiles = async (files) => {
    if (!files || files.length === 0) return;
    try {
      const res = await fetch('/api/ai/execute-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('jwtToken') ? `Bearer ${localStorage.getItem('jwtToken')}` : ''
        },
        body: JSON.stringify({
          name: 'batch_update_files',
          args: { files },
          sessionId
        })
      });
      if (res.ok) {
        files.forEach(f => {
          if (onFileUpdated) {
            onFileUpdated(f.path, f.content);
          }
        });
        handleSend(`Todos os ${files.length} arquivos do projeto foram criados/atualizados com sucesso! Se houver comandos para instalar ou rodar (como npm install / npm start), proponha a execução agora.`);
      }
    } catch (e) {
      handleSend(`Erro ao criar arquivos em lote: ${e.message}`);
    }
  };

  const handleApproveSingleFile = async (path, content) => {
    try {
      const res = await fetch('/api/ai/execute-tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('jwtToken') ? `Bearer ${localStorage.getItem('jwtToken')}` : ''
        },
        body: JSON.stringify({
          name: 'update_file',
          args: { path, content },
          sessionId
        })
      });
      if (res.ok) {
        if (onFileUpdated) {
          onFileUpdated(path, content);
        }
        handleSend(`O arquivo \`${path}\` foi criado/atualizado com sucesso!`);
      }
    } catch (e) {
      handleSend(`Erro ao salvar arquivo \`${path}\`: ${e.message}`);
    }
  };

  const [showHistorySidebar, setShowHistorySidebar] = useState(false);

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
        <div
          className="w-full max-w-5xl h-[94vh] sm:h-[88vh] flex flex-row border-2 rounded-xl shadow-2xl overflow-hidden relative"
          style={{
            backgroundColor: 'var(--panel-bg-color)',
            borderColor: 'var(--panel-border-color)',
            color: 'var(--text-color)'
          }}
        >
          {/* Mobile backdrop for chat history drawer */}
          {showHistorySidebar && (
            <div 
              className="fixed inset-0 bg-black/40 z-10 md:hidden" 
              onClick={() => setShowHistorySidebar(false)} 
            />
          )}

          {/* Sidebar - Chats history (Overlay on mobile, normal on md+) */}
          <div 
            className={`w-64 flex flex-col border-r-2 flex-shrink-0 transition-transform duration-300 md:relative absolute top-0 bottom-0 left-0 z-20 ${showHistorySidebar ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}
            style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--header-bg-color)' }}
          >
            <div className="p-3 border-b-2 flex items-center justify-between gap-2" style={{ borderColor: 'var(--panel-border-color)' }}>
              <button
                onClick={() => {
                  setActiveChatId(null);
                  setMessages([{ role: 'assistant', content: 'Novo chat iniciado! Como posso ajudar você agora?' }]);
                  setShowHistorySidebar(false);
                }}
                className="flex-1 px-3 py-2 font-bold border-2 rounded-lg flex items-center justify-center gap-2 text-xs transition-all hover:brightness-110 shadow-sm"
                style={{ backgroundColor: 'var(--primary-color)', color: '#fff', borderColor: 'var(--panel-border-color)' }}
              >
                <span className="codicon codicon-plus" /> Novo Chat
              </button>
              <button
                onClick={() => setShowHistorySidebar(false)}
                className="md:hidden p-1.5 rounded hover:bg-[var(--input-bg-color)]"
              >
                <span className="codicon codicon-close text-xs" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {chats.map(chat => (
                <div 
                  key={chat.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${chat.id === activeChatId ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10 font-bold' : 'border-transparent opacity-75 hover:opacity-100 hover:bg-[var(--hover-bg-color)]'}`}
                  style={{ color: 'var(--text-color)' }}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setMessages(chat.messages);
                    setShowHistorySidebar(false);
                  }}
                >
                  <span className="truncate text-xs flex-1" title={chat.title}>{chat.title}</span>
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
                          setMessages([{ role: 'assistant', content: 'Olá! Sou o seu Agente de IA.' }]);
                        }
                      }
                    }}
                    className="ml-2 opacity-0 hover:opacity-100 hover:text-red-400 p-1 transition-opacity"
                    title="Excluir chat"
                  >
                    <span className="codicon codicon-trash text-xs" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Main Agent Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div
              className="px-3 sm:px-5 py-2.5 sm:py-3 border-b-2 flex justify-between items-center flex-shrink-0"
              style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--header-bg-color)' }}
            >
              <div className="flex items-center space-x-2 sm:space-x-3 truncate">
                <button
                  onClick={() => setShowHistorySidebar(prev => !prev)}
                  className="md:hidden p-1.5 rounded border flex items-center justify-center"
                  style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--input-bg-color)' }}
                  title="Histórico de Chats"
                >
                  <span className="codicon codicon-history text-sm" />
                </button>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[var(--primary-color)] flex items-center justify-center text-white shadow shrink-0">
                  <span className="codicon codicon-hubot text-base sm:text-lg" />
                </div>
                <div className="truncate">
                  <h2 className="text-sm sm:text-base font-bold flex items-center gap-1.5 truncate" style={{ color: 'var(--text-color)' }}>
                    <span>TeamCode Agent</span>
                    <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hidden sm:inline">Multi-File</span>
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs opacity-80 mt-0.5">
                    <span className="flex items-center gap-1 font-medium">
                      <select 
                        value={mode} 
                        onChange={e => setMode(e.target.value)}
                        className="px-1 py-0.5 border rounded focus:outline-none bg-[var(--input-bg-color)] text-[var(--text-color)] text-[11px] sm:text-xs font-semibold cursor-pointer"
                        style={{ borderColor: 'var(--panel-border-color)' }}
                      >
                        <option value="agent">🤖 Agente</option>
                        <option value="chat">💬 Chat</option>
                      </select>
                    </span>
                    {activeFile && (
                      <span className="opacity-70 flex items-center gap-1 truncate max-w-[120px] sm:max-w-[200px]">
                        <span className="codicon codicon-file text-[10px]" /> {activeFile.split('/').pop()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
                <button
                  onClick={handleRegenerateLast}
                  disabled={loading || messages.length < 2}
                  className="p-1 sm:p-1.5 rounded hover:bg-[var(--hover-bg-color)] text-xs font-medium disabled:opacity-40 flex items-center gap-1 transition-all"
                  title="Regenerar última resposta"
                  style={{ color: 'var(--text-color)' }}
                >
                  <span className="codicon codicon-refresh text-xs" />
                  <span className="hidden sm:inline">Regenerar</span>
                </button>
                <button 
                  onClick={onClose} 
                  className="p-1 sm:p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  title="Fechar (Esc)"
                >
                  <span className="codicon codicon-close text-sm sm:text-base" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div
              className="flex-shrink-0 px-4 py-2 border-b flex flex-wrap gap-1.5 bg-[var(--bg-color)]/50 overflow-x-auto"
              style={{ borderColor: 'var(--panel-border-color)' }}
            >
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    const context = selectedText?.trim()
                      ? `${action.prompt}\n\n\`\`\`\n${selectedText}\n\`\`\``
                      : `${action.prompt}\n\n\`\`\`\n${editorContent || ''}\n\`\`\``;
                    handleSend(context);
                  }}
                  disabled={loading}
                  className="text-xs px-2.5 py-1 border rounded-md hover:bg-[var(--primary-color)] hover:text-white transition-all disabled:opacity-40 whitespace-nowrap shadow-sm font-medium"
                  style={{
                    borderColor: 'var(--panel-border-color)',
                    backgroundColor: 'var(--header-bg-color)',
                    color: 'var(--text-color)',
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* Chat Message Stream */}
            <div className="flex-grow overflow-y-auto p-5 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] p-4 rounded-xl border relative group ${
                      msg.role === 'user' 
                        ? 'bg-[var(--primary-color)] text-white border-[var(--primary-color)]' 
                        : 'bg-[var(--input-bg-color)] border-[var(--panel-border-color)]'
                    }`}
                    style={{ color: msg.role === 'user' ? '#fff' : 'var(--text-color)' }}
                  >
                    {/* User message with inline edit */}
                    {msg.role === 'user' ? (
                      <div>
                        {editingMsgIndex === idx ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingMsgText}
                              onChange={(e) => setEditingMsgText(e.target.value)}
                              rows={3}
                              className="w-full p-2 text-xs rounded text-black bg-white outline-none resize-none font-sans"
                            />
                            <div className="flex justify-end gap-2 text-xs font-bold">
                              <button
                                onClick={() => setEditingMsgIndex(null)}
                                className="px-2 py-1 bg-white/20 rounded hover:bg-white/30"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleEditAndRegenerate(idx)}
                                className="px-2 py-1 bg-white text-[var(--primary-color)] rounded hover:bg-white/90"
                              >
                                Salvar & Regenerar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-4">
                            <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed flex-1">{msg.content}</p>
                            <button
                              onClick={() => {
                                setEditingMsgIndex(idx);
                                setEditingMsgText(msg.content);
                              }}
                              title="Editar mensagem"
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded transition-opacity"
                            >
                              <span className="codicon codicon-edit text-xs" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {/* Assistant message content */}
                        <div className="prose prose-sm max-w-none dark:prose-invert text-xs leading-relaxed">
                          <ReactMarkdown>{msg.content.replace(/```tool_request[\s\S]*?```/g, '') || "Ação proposta pelo Agente:"}</ReactMarkdown>
                        </div>

                        {/* Visual Tool Action Cards */}
                        {extractToolRequests(msg.content).map((req, rIdx) => {
                          const isBatch = req.tool === 'batch_update_files';
                          const isUpdate = req.tool === 'update_file';
                          const isCmd = req.tool === 'run_terminal_command';
                          const isRead = req.tool === 'read_file';

                          return (
                            <div 
                              key={`tool-${rIdx}`} 
                              className="mt-3 border rounded-lg p-3.5 shadow-sm space-y-3 bg-[var(--header-bg-color)]"
                              style={{ borderColor: 'var(--panel-border-color)' }}
                            >
                              {/* Header of Action Card */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 font-bold text-xs">
                                  <span className={`codicon ${
                                    isCmd ? 'codicon-terminal text-emerald-400' :
                                    isRead ? 'codicon-search text-purple-400' :
                                    isUpdate ? 'codicon-file-code text-amber-400' :
                                    'codicon-package text-blue-400'
                                  }`} />
                                  <span>
                                    {isBatch && `📦 Criar/Atualizar ${req.args?.files?.length || 0} arquivos do projeto`}
                                    {isUpdate && `📄 Modificar arquivo: ${req.args?.path || 'arquivo'}`}
                                    {isRead && `🔍 Inspecionar arquivo: ${req.args?.path || 'arquivo'}`}
                                    {isCmd && `▶️ Executar comando no terminal`}
                                    {!isBatch && !isUpdate && !isCmd && !isRead && `⚙️ Ferramenta: ${req.tool || 'Ação do Agente'}`}
                                  </span>
                                </div>
                                {isBatch && req.args?.files?.length > 0 && (
                                  <button
                                    onClick={() => handleApproveBatchFiles(req.args?.files)}
                                    className="px-3 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow transition-all"
                                  >
                                    <span className="codicon codicon-check" /> Aprovar Todos
                                  </button>
                                )}
                              </div>

                              {/* Terminal Command View */}
                              {isCmd && (
                                <div className="space-y-2">
                                  <div className="font-mono text-xs p-2.5 bg-black/80 text-emerald-400 rounded-md border border-black/40 flex items-center justify-between">
                                    <span>$ {req.args?.command || ''}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        if (onExecuteCommand && req.args?.command) {
                                          onExecuteCommand(req.args.command, req.args.terminalId);
                                          handleSend(`Comando \`${req.args.command}\` executado no terminal. Acompanhando o resultado.`);
                                        }
                                      }}
                                      className="px-3 py-1.5 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow transition-all"
                                    >
                                      <span className="codicon codicon-play" /> Executar no Terminal
                                    </button>
                                    <button
                                      onClick={() => handleSend(`Execução do comando \`${req.args?.command || ''}\` foi cancelada.`)}
                                      className="px-3 py-1.5 text-xs font-bold rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                      Recusar
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Read File View */}
                              {isRead && (
                                <div className="space-y-2">
                                  <p className="text-xs opacity-80">O Agente solicitou leitura do arquivo <b>{req.args?.path}</b> para analisar seu conteúdo.</p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={async () => {
                                        try {
                                          const res = await fetch('/api/ai/execute-tool', {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              'Authorization': localStorage.getItem('jwtToken') ? `Bearer ${localStorage.getItem('jwtToken')}` : ''
                                            },
                                            body: JSON.stringify({
                                              name: 'read_file',
                                              args: req.args,
                                              sessionId
                                            })
                                          });
                                          if (res.ok) {
                                            const data = await res.json();
                                            handleSend(`Conteúdo de \`${req.args?.path}\`:\n\`\`\`\n${data.response}\n\`\`\`\nAnalise o arquivo e continue.`);
                                          }
                                        } catch (e) {
                                          handleSend(`Erro ao ler arquivo: ${e.message}`);
                                        }
                                      }}
                                      className="px-3 py-1.5 text-xs font-bold rounded bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1 shadow transition-all"
                                    >
                                      <span className="codicon codicon-search" /> Ler Arquivo
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Single File View */}
                              {isUpdate && (
                                <div className="space-y-2">
                                  <div className="text-xs font-mono p-2 bg-black/60 text-gray-200 rounded max-h-40 overflow-y-auto whitespace-pre">
                                    {req.args?.content}
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleApproveSingleFile(req.args?.path, req.args?.content)}
                                      className="px-3 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow transition-all"
                                    >
                                      <span className="codicon codicon-check" /> Aplicar no Arquivo
                                    </button>
                                    <button
                                      onClick={() => handleSend(`Alteração em \`${req.args?.path}\` foi recusada.`)}
                                      className="px-3 py-1 text-xs font-bold rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                      Recusar
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Multi-Files List */}
                              {isBatch && req.args?.files && (
                                <div className="space-y-1.5">
                                  {req.args.files.map((f, fIdx) => {
                                    const isExpanded = expandedFiles[`${rIdx}_${f.path}`];
                                    return (
                                      <div key={fIdx} className="border border-[var(--panel-border-color)] rounded-md overflow-hidden bg-[var(--bg-color)]">
                                        <div 
                                          onClick={() => toggleExpandFile(`${rIdx}_${f.path}`)}
                                          className="p-2 flex items-center justify-between text-xs cursor-pointer hover:bg-[var(--hover-bg-color)]"
                                        >
                                          <div className="flex items-center gap-2 font-mono">
                                            <span className={`codicon ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'} text-[10px]`} />
                                            <span className="font-bold">{f.path}</span>
                                            {f.description && <span className="opacity-60 text-[11px]">({f.description})</span>}
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleApproveSingleFile(f.path, f.content);
                                            }}
                                            className="px-2 py-0.5 text-[11px] font-bold rounded bg-[var(--hover-bg-color)] hover:bg-emerald-600 hover:text-white border border-[var(--panel-border-color)]"
                                          >
                                            Aplicar este
                                          </button>
                                        </div>
                                        {isExpanded && (
                                          <div className="p-2 bg-black/80 font-mono text-[11px] text-gray-300 max-h-48 overflow-y-auto whitespace-pre border-t border-[var(--panel-border-color)]">
                                            {f.content}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Generic Fallback Tool */}
                              {!isBatch && !isUpdate && !isCmd && !isRead && (
                                <div className="space-y-2 text-xs font-mono p-2 bg-black/60 text-gray-300 rounded overflow-x-auto">
                                  <pre>{JSON.stringify(req.args || {}, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Markdown Code Block Quick Actions */}
                        {extractCodeBlocks(msg.content).length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-[var(--panel-border-color)]/40">
                            {extractCodeBlocks(msg.content).map((code, cIdx) => (
                              <div key={cIdx} className="flex items-center gap-1">
                                {onInsertCode && (
                                  <button
                                    onClick={() => onInsertCode(code)}
                                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 border rounded hover:bg-[var(--primary-color)] hover:text-white font-bold transition-all"
                                    style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--header-bg-color)' }}
                                  >
                                    <span className="codicon codicon-insert text-[11px]" />
                                    <span>Aplicar no Editor</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleCopyCode(code, `${idx}_${cIdx}`)}
                                  className="flex items-center gap-1 text-[11px] px-2 py-1 border rounded hover:bg-[var(--hover-bg-color)] font-medium transition-all"
                                  style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--header-bg-color)' }}
                                >
                                  <span className="codicon codicon-copy text-[11px]" />
                                  <span>{copiedCodeIdx === `${idx}_${cIdx}` ? 'Copiado!' : 'Copiar'}</span>
                                </button>
                              </div>
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
                    className="p-3.5 rounded-xl border flex items-center space-x-2 text-xs shadow-sm"
                    style={{ backgroundColor: 'var(--input-bg-color)', borderColor: 'var(--panel-border-color)' }}
                  >
                    <span className="codicon codicon-loading codicon-modifier-spin text-[var(--primary-color)] text-sm" />
                    <span className="font-semibold animate-pulse">Agente pensando e gerando código...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Prompt Box */}
            <div
              className="p-4 border-t-2 flex-shrink-0 space-y-2 bg-[var(--header-bg-color)]"
              style={{ borderColor: 'var(--panel-border-color)' }}
            >
              {attachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="relative w-14 h-14 border-2 rounded flex items-center justify-center flex-shrink-0 group bg-[var(--input-bg-color)]" style={{ borderColor: 'var(--panel-border-color)' }}>
                      {att.mimeType.startsWith('image/') ? (
                        <img src={att.preview} alt={att.name} className="w-full h-full object-cover rounded" />
                      ) : (
                        <span className="codicon codicon-file text-xl opacity-80" />
                      )}
                      <button 
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex space-x-2 items-end">
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileSelect} />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 border-2 rounded-lg flex items-center justify-center hover:bg-[var(--hover-bg-color)] transition-all"
                  style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--input-bg-color)', color: 'var(--text-color)' }}
                  title="Anexar arquivo ou imagem"
                >
                  <span className="codicon codicon-link text-base" />
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
                  placeholder="Peça para o Agente criar um projeto, corrigir erros, executar comandos (Enter para enviar)..."
                  className="flex-grow p-2.5 border-2 rounded-lg focus:outline-none focus:ring-2 resize-none text-xs leading-relaxed font-sans"
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
                  className="px-5 py-2.5 font-bold border-2 rounded-lg disabled:opacity-40 flex items-center justify-center space-x-2 h-auto text-xs shadow-md transition-all hover:brightness-110"
                  style={{
                    backgroundColor: 'var(--primary-color)',
                    color: '#fff',
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
