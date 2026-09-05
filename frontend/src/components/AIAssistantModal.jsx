import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from '../contexts/LanguageContext';

// Botões de ações rápidas pré-definidos
const QUICK_ACTIONS = [
  { labelPt: 'Explique este código', labelEn: 'Explain code', promptPt: 'Explique o que este código faz, de forma clara e didática:', promptEn: 'Explain what this code does, clearly and concisely:' },
  { labelPt: 'Corrija os erros', labelEn: 'Fix errors', promptPt: 'Encontre e corrija todos os erros neste código:', promptEn: 'Find and fix all errors in this code:' },
  { labelPt: 'Escreva testes', labelEn: 'Write tests', promptPt: 'Escreva testes unitários para este código:', promptEn: 'Write unit tests for this code:' },
  { labelPt: 'Documente', labelEn: 'Document', promptPt: 'Adicione documentação JSDoc completa a este código:', promptEn: 'Add full JSDoc documentation to this code:' },
  { labelPt: 'Otimize', labelEn: 'Optimize', promptPt: 'Sugira otimizações de performance para este código:', promptEn: 'Suggest performance optimizations for this code:' },
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
    } catch (_) { }
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
  const { t, language } = useTranslation();
  const getStorageKey = (sid) => `crewcode-ai-chats-${sid || 'global'}`;
  const getLegacyStorageKey = (sid) => `codesync-ai-chats-${sid || 'global'}`;
  const getActiveChatKey = (sid) => `crewcode-ai-active-chat-${sid || 'global'}`;
  const getLegacyActiveChatKey = (sid) => `codesync-ai-active-chat-${sid || 'global'}`;

  const DEFAULT_WELCOME_MSG = {
    role: 'assistant',
    content: language === 'en'
      ? 'Hello! I am your AI Agent for collaborative development. I can create full projects, modify multiple files simultaneously, and run terminal commands. How can I help you today?'
      : 'Olá! Sou o seu Agente de IA para desenvolvimento colaborativo. Posso criar projetos completos, modificar múltiplos arquivos de uma só vez e executar comandos no terminal. Como posso ajudar?'
  };

  const [chats, setChats] = useState(() => {
    try {
      const saved = localStorage.getItem(getStorageKey(sessionId)) || localStorage.getItem(getLegacyStorageKey(sessionId));
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  const [activeChatId, setActiveChatId] = useState(() => {
    try {
      const savedId = localStorage.getItem(getActiveChatKey(sessionId)) || localStorage.getItem(getLegacyActiveChatKey(sessionId));
      const savedChats = localStorage.getItem(getStorageKey(sessionId)) || localStorage.getItem(getLegacyStorageKey(sessionId));
      const list = savedChats ? JSON.parse(savedChats) : [];
      if (savedId && list.some(c => c.id === savedId)) return savedId;
      return list.length > 0 ? list[0].id : null;
    } catch (_) {
      return null;
    }
  });

  const [messages, setMessages] = useState(() => {
    try {
      const savedId = localStorage.getItem(getActiveChatKey(sessionId)) || localStorage.getItem(getLegacyActiveChatKey(sessionId));
      const savedChats = localStorage.getItem(getStorageKey(sessionId)) || localStorage.getItem(getLegacyStorageKey(sessionId));
      const list = savedChats ? JSON.parse(savedChats) : [];
      const current = list.find(c => c.id === savedId) || (list.length > 0 ? list[0] : null);
      if (current && Array.isArray(current.messages) && current.messages.length > 0) {
        return current.messages;
      }
    } catch (_) {}
    return [DEFAULT_WELCOME_MSG];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('crewcode-ai-mode') || localStorage.getItem('codesync-ai-mode') || 'agent';
  });
  const [attachments, setAttachments] = useState([]);
  const [editingMsgIndex, setEditingMsgIndex] = useState(null);
  const [editingMsgText, setEditingMsgText] = useState('');
  const [expandedFiles, setExpandedFiles] = useState({});
  const [copiedCodeIdx, setCopiedCodeIdx] = useState(null);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Sync state if sessionId changes
  useEffect(() => {
    try {
      const savedChats = localStorage.getItem(getStorageKey(sessionId));
      const list = savedChats ? JSON.parse(savedChats) : [];
      const savedId = localStorage.getItem(getActiveChatKey(sessionId));
      const targetId = (savedId && list.some(c => c.id === savedId)) ? savedId : (list.length > 0 ? list[0].id : null);

      setChats(list);
      setActiveChatId(targetId);

      const current = list.find(c => c.id === targetId);
      if (current && Array.isArray(current.messages) && current.messages.length > 0) {
        setMessages(current.messages);
      } else {
        setMessages([DEFAULT_WELCOME_MSG]);
      }
    } catch (_) { }
  }, [sessionId]);

  const saveChatState = (newMessages, currentActiveId = activeChatId) => {
    setMessages(newMessages);
    if (!sessionId || !newMessages || newMessages.length === 0) return;

    setChats((prevChats) => {
      let targetId = currentActiveId;
      let updatedChats;

      if (targetId && prevChats.some(c => c.id === targetId)) {
        updatedChats = prevChats.map(c =>
          c.id === targetId ? { ...c, messages: newMessages, updatedAt: Date.now() } : c
        );
      } else {
        // Create new conversation entry
        targetId = Date.now().toString();
        const firstUserMsg = newMessages.find(m => m.role === 'user');
        const title = firstUserMsg
          ? (firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : ''))
          : 'Novo Chat';
        const newChat = { id: targetId, title, messages: newMessages, updatedAt: Date.now() };
        updatedChats = [newChat, ...prevChats];
        setActiveChatId(targetId);
        try {
          localStorage.setItem(getActiveChatKey(sessionId), targetId);
        } catch (_) { }
      }

      try {
        localStorage.setItem(getStorageKey(sessionId), JSON.stringify(updatedChats));
      } catch (_) { }
      return updatedChats;
    });
  };

  const handleSelectChat = (chat) => {
    setActiveChatId(chat.id);
    setMessages(chat.messages || [DEFAULT_WELCOME_MSG]);
    try {
      localStorage.setItem(getActiveChatKey(sessionId), chat.id);
    } catch (_) { }
    setShowHistorySidebar(false);
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([DEFAULT_WELCOME_MSG]);
    try {
      localStorage.removeItem(getActiveChatKey(sessionId));
    } catch (_) { }
    setShowHistorySidebar(false);
  };

  const handleDeleteChat = (chatId) => {
    const newChats = chats.filter(c => c.id !== chatId);
    setChats(newChats);
    try {
      localStorage.setItem(getStorageKey(sessionId), JSON.stringify(newChats));
    } catch (_) { }

    if (activeChatId === chatId) {
      if (newChats.length > 0) {
        setActiveChatId(newChats[0].id);
        setMessages(newChats[0].messages);
        try {
          localStorage.setItem(getActiveChatKey(sessionId), newChats[0].id);
        } catch (_) { }
      } else {
        setActiveChatId(null);
        setMessages([DEFAULT_WELCOME_MSG]);
        try {
          localStorage.removeItem(getActiveChatKey(sessionId));
        } catch (_) { }
      }
    }
  };

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
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    localStorage.setItem('crewcode-ai-mode', mode);
  }, [mode]);

  if (!isOpen) return null;

  const handleSend = async (customInput, historyOverride = null) => {
    const text = customInput ?? input;
    if (!text.trim() && attachments.length === 0) return;

    const currentAttachments = [...attachments];
    const userPrompt = text.trim() || (currentAttachments.length > 0 ? "Analise a(s) imagem(ns) em anexo." : "");

    const context = selectedText?.trim()
      ? `Trecho selecionado:\n\`\`\`\n${selectedText}\n\`\`\``
      : editorContent;

    const baseHistory = historyOverride ?? messages;
    const userMsg = {
      role: 'user',
      content: userPrompt,
      attachments: currentAttachments
    };
    const newMessages = [...baseHistory, userMsg];

    saveChatState(newMessages);
    setInput('');
    setAttachments([]);
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
          message: userPrompt,
          context,
          attachments: currentAttachments.map(a => ({ name: a.name, mimeType: a.mimeType, data: a.data })),
          history: baseHistory.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          const limitMsg = {
            role: 'assistant',
            isLimitWarning: true,
            content: errorData.message || 'Você atingiu o limite de mensagens diárias de IA. Crie uma conta gratuita para continuar aproveitando!'
          };
          saveChatState([...newMessages, limitMsg]);
          return;
        }
        throw new Error(errorData.error || errorData.message || 'Falha na comunicação com a IA');
      }

      const data = await res.json();
      saveChatState([...newMessages, { role: 'assistant', content: data.response }]);
    } catch (error) {
      saveChatState([...newMessages, {
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
                onClick={handleNewChat}
                className="flex-1 px-3 py-2 font-bold border-2 rounded-lg flex items-center justify-center gap-2 text-xs transition-all hover:brightness-110 shadow-sm"
                style={{ backgroundColor: 'var(--primary-color)', color: '#fff', borderColor: 'var(--panel-border-color)' }}
              >
                <span className="codicon codicon-plus" /> {t('ai.newChat')}
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
                  onClick={() => handleSelectChat(chat)}
                >
                  <span className="truncate text-xs flex-1" title={chat.title}>{chat.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteChat(chat.id);
                    }}
                    className="ml-2 opacity-0 hover:opacity-100 hover:text-red-400 p-1 transition-opacity"
                    title={t('ai.deleteChat')}
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
                  title={t('ai.chatHistory')}
                >
                  <span className="codicon codicon-history text-sm" />
                </button>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[var(--primary-color)] flex items-center justify-center text-white shadow shrink-0">
                  <span className="codicon codicon-hubot text-base sm:text-lg" />
                </div>
                <div className="truncate">
                  <h2 className="text-sm sm:text-base font-bold flex items-center gap-1.5 truncate" style={{ color: 'var(--text-color)' }}>
                    <span>{t('ai.agentTitle')}</span>
                    <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hidden sm:inline">{t('ai.agentBadge')}</span>
                    {!localStorage.getItem("jwtToken") && (
                      <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-mono bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold" title={t('ai.visitorQuotaTooltip')}>
                        {t('ai.visitorBadge')}
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs opacity-80 mt-0.5">
                    <span className="flex items-center gap-1 font-medium">
                      <select
                        value={mode}
                        onChange={e => setMode(e.target.value)}
                        className="px-1 py-0.5 border rounded focus:outline-none bg-[var(--input-bg-color)] text-[var(--text-color)] text-[11px] sm:text-xs font-semibold cursor-pointer"
                        style={{ borderColor: 'var(--panel-border-color)' }}
                      >
                        <option value="agent">{t('ai.modeAgent')}</option>
                        <option value="chat">{t('ai.modeChat')}</option>
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
                  title={t('ai.regenerateTooltip')}
                  style={{ color: 'var(--text-color)' }}
                >
                  <span className="codicon codicon-refresh text-xs" />
                  <span className="hidden sm:inline">{t('ai.regenerate')}</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-1 sm:p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  title={t('common.close')}
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
              {QUICK_ACTIONS.map((action) => {
                const label = language === 'en' ? action.labelEn : action.labelPt;
                const prompt = language === 'en' ? action.promptEn : action.promptPt;
                return (
                  <button
                    key={action.labelEn}
                    onClick={() => {
                      const context = selectedText?.trim()
                        ? `${prompt}\n\n\`\`\`\n${selectedText}\n\`\`\``
                        : `${prompt}\n\n\`\`\`\n${editorContent || ''}\n\`\`\``;
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
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Chat Message Stream */}
            <div className="flex-grow overflow-y-auto p-5 space-y-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] p-4 rounded-xl border relative group ${msg.role === 'user'
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
                                {t('common.cancel')}
                              </button>
                              <button
                                onClick={() => handleEditAndRegenerate(idx)}
                                className="px-2 py-1 bg-white text-[var(--primary-color)] rounded hover:bg-white/90"
                              >
                                {t('ai.saveAndRegenerate')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {msg.attachments.map((att, attIdx) => (
                                  <div key={attIdx} className="rounded-lg overflow-hidden border border-white/20 shadow-md">
                                    <img
                                      src={att.preview || `data:${att.mimeType};base64,${att.data}`}
                                      alt={att.name || "Attachment"}
                                      className="max-h-48 max-w-xs object-contain cursor-pointer hover:opacity-90 transition-opacity bg-black/20"
                                      onClick={() => window.open(att.preview || `data:${att.mimeType};base64,${att.data}`, '_blank')}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-start justify-between gap-4">
                              <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed flex-1">{msg.content}</p>
                              <button
                                onClick={() => {
                                  setEditingMsgIndex(idx);
                                  setEditingMsgText(msg.content);
                                }}
                                title={t('ai.editMessage')}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded transition-opacity"
                              >
                                <span className="codicon codicon-edit text-xs" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {msg.isLimitWarning ? (
                          <div className="p-3.5 sm:p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2.5">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm">
                              <span className="codicon codicon-warning text-base text-amber-400" />
                              <span>Limite de Mensagens Atingido</span>
                            </div>
                            <p className="text-xs leading-relaxed opacity-90 text-[var(--text-color)]">{msg.content}</p>
                            <button
                              onClick={() => window.location.href = '/login'}
                              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs rounded-lg shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <span className="codicon codicon-account text-sm" />
                              <span>Criar Conta Gratuita / Fazer Login</span>
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Assistant message content */}
                            <div className="prose prose-sm max-w-none dark:prose-invert text-xs leading-relaxed">
                              <ReactMarkdown>{msg.content.replace(/```tool_request[\s\S]*?```/g, '') || "Ação proposta pelo Agente:"}</ReactMarkdown>
                            </div>
                          </>
                        )}

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
                                  <span className={`codicon ${isCmd ? 'codicon-terminal text-emerald-400' :
                                      isRead ? 'codicon-search text-purple-400' :
                                        isUpdate ? 'codicon-file-code text-amber-400' :
                                          'codicon-package text-blue-400'
                                    }`} />
                                  <span>
                                    {isBatch && `Criar/Atualizar ${req.args?.files?.length || 0} arquivos do projeto`}
                                    {isUpdate && `Modificar arquivo: ${req.args?.path || 'arquivo'}`}
                                    {isRead && `Inspecionar arquivo: ${req.args?.path || 'arquivo'}`}
                                    {isCmd && `Executar comando no terminal`}
                                    {!isBatch && !isUpdate && !isCmd && !isRead && `Ferramenta: ${req.tool || 'Ação do Agente'}`}
                                  </span>
                                </div>
                                {isBatch && req.args?.files?.length > 0 && (
                                  <button
                                    onClick={() => handleApproveBatchFiles(req.args?.files)}
                                    className="px-3 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow transition-all"
                                  >
                                    <span className="codicon codicon-check" /> {t('ai.approveAll')}
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
                                      <span className="codicon codicon-play" /> {t('ai.runInTerminal')}
                                    </button>
                                    <button
                                      onClick={() => handleSend(`Execução do comando \`${req.args?.command || ''}\` foi cancelada.`)}
                                      className="px-3 py-1.5 text-xs font-bold rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                      {t('ai.refuse')}
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
                                    <span>{t('ai.applyInEditor')}</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleCopyCode(code, `${idx}_${cIdx}`)}
                                  className="flex items-center gap-1 text-[11px] px-2 py-1 border rounded hover:bg-[var(--hover-bg-color)] font-medium transition-all"
                                  style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--header-bg-color)' }}
                                >
                                  <span className="codicon codicon-copy text-[11px]" />
                                  <span>{copiedCodeIdx === `${idx}_${cIdx}` ? t('ai.copied') : t('ai.copy')}</span>
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
                    <span className="font-semibold animate-pulse">{t('ai.thinking')}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Prompt Box */}
            <div
              className="p-3 sm:p-4 border-t-2 flex-shrink-0 space-y-2 bg-[var(--header-bg-color)]"
              style={{ borderColor: 'var(--panel-border-color)' }}
            >
              {attachments.length > 0 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1.5 items-center">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="relative w-16 h-16 border-2 rounded-lg flex items-center justify-center flex-shrink-0 group bg-[var(--input-bg-color)] shadow-sm overflow-hidden" style={{ borderColor: 'var(--panel-border-color)' }}>
                      {att.mimeType.startsWith('image/') ? (
                        <img src={att.preview} alt={att.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="codicon codicon-file text-2xl opacity-80" />
                      )}
                      <button
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow transition-all"
                        title={t('ai.removeAttachment')}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <span className="text-xs text-[var(--text-muted-color)] italic">
                    {t('ai.attachmentsReady', { count: attachments.length })}
                  </span>
                </div>
              )}

              <div className="flex space-x-2 items-end">
                <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*,.txt,.js,.jsx,.ts,.tsx,.json,.html,.css,.py,.java,.md" onChange={handleFileSelect} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 border-2 rounded-lg flex items-center justify-center hover:bg-[var(--hover-bg-color)] transition-all h-[46px] w-[46px] shrink-0"
                  style={{ borderColor: 'var(--panel-border-color)', backgroundColor: 'var(--input-bg-color)', color: 'var(--text-color)' }}
                  title={t('ai.attachFile')}
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
                  placeholder={t('ai.inputPlaceholder')}
                  className="flex-grow p-3 border-2 rounded-lg focus:outline-none focus:ring-2 resize-none text-sm sm:text-base leading-relaxed font-sans min-h-[46px]"
                  rows={2}
                  style={{
                    backgroundColor: 'var(--input-bg-color)',
                    borderColor: 'var(--panel-border-color)',
                    color: 'var(--text-color)',
                    '--tw-ring-color': 'var(--primary-color)',
                    fontSize: '15px',
                  }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading || (!input.trim() && attachments.length === 0)}
                  className="px-5 py-3 font-bold border-2 rounded-lg disabled:opacity-40 flex items-center justify-center space-x-2 h-[46px] text-sm shadow-md transition-all hover:brightness-110 shrink-0"
                  style={{
                    backgroundColor: 'var(--primary-color)',
                    color: '#fff',
                    borderColor: 'var(--panel-border-color)',
                  }}
                >
                  <span className="codicon codicon-send text-base" />
                  <span>{t('ai.send')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
