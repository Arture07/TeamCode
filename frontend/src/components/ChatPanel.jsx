import React from "react";

const hashStringToColor = (str) => {
  if (!str || str === 'System') return "from-zinc-500 to-zinc-700";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "from-rose-500 to-amber-500",
    "from-violet-600 to-indigo-600",
    "from-emerald-500 to-teal-500",
    "from-blue-500 to-cyan-500",
    "from-pink-500 to-rose-500",
    "from-orange-500 to-amber-500",
    "from-fuchsia-500 to-pink-500",
    "from-purple-500 to-pink-500"
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getInitials = (username) => {
  if (!username || username === 'System') return "??";
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.trim().slice(0, 2).toUpperCase();
};

const renderMessageContent = (content) => {
  if (!content) return "";
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      const codeText = part.slice(1, -1);
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded font-mono text-xs border"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            borderColor: 'var(--panel-border-color)',
            color: 'var(--primary-color)',
            display: 'inline-block',
            wordBreak: 'break-all'
          }}
        >
          {codeText}
        </code>
      );
    }

    const subParts = part.split(urlRegex);
    return subParts.map((subPart, subIndex) => {
      if (urlRegex.test(subPart)) {
        return (
          <a
            key={`${index}-${subIndex}`}
            href={subPart}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:opacity-85 transition-opacity font-semibold break-all"
            style={{ color: 'var(--primary-color)' }}
          >
            {subPart}
          </a>
        );
      }
      return subPart;
    });
  });
};

function ChatPanel({
  rightAsideRef,
  showChat,
  setShowChat,
  panelSizes,
  showParticipantsList,
  setShowParticipantsList,
  participants,
  messagesRef,
  messages,
  chatHeight,
  chatMessagesEndRef,
  onChatMouseDown,
  chatTextareaRef,
  chatInput,
  setChatInput,
  handleSendChatMessage,
  handleInsertText,
  isOverlay = false,
}) {
  return (
    <aside
      ref={rightAsideRef}
      className={`h-full flex flex-col editor-page-panel chat-panel flex-shrink-0 transition-all duration-300 ease-in-out ${isOverlay ? 'fixed top-0 bottom-0 right-0 z-40 w-[85vw] sm:w-80 md:w-96 shadow-2xl' : ''}`}
      style={isOverlay ? {
        transform: showChat ? "translateX(0)" : "translateX(105%)",
        opacity: showChat ? 1 : 0,
        visibility: showChat ? "visible" : "hidden",
        backgroundColor: "var(--panel-bg-color)",
        borderColor: "var(--panel-border-color)",
        borderLeftWidth: "2px",
      } : {
        flexBasis: showChat ? `${panelSizes.right}%` : "0%",
        width: showChat ? "auto" : "0px",
        minWidth: showChat ? "220px" : "0px",
        maxWidth: "50%",
        opacity: showChat ? 1 : 0,
        visibility: showChat ? "visible" : "hidden",
        overflow: "hidden",
        backgroundColor: "var(--panel-bg-color)",
        borderColor: "var(--panel-border-color)",
        borderLeftWidth: showChat ? "2px" : "0px",
      }}
    >
      <div
        className="p-3 border-b-2 flex flex-col"
        style={{ borderColor: "var(--panel-border-color)" }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="font-bold text-base flex items-center gap-2"
            style={{ color: "var(--primary-color)" }}
          >
            <span className="codicon codicon-comment-discussion" />
            Chat da Sessão
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowParticipantsList(!showParticipantsList)}
              className="px-2 py-0.5 text-xs rounded border font-semibold flex items-center gap-1 hover:opacity-85 transition-opacity"
              style={{
                borderColor: "var(--panel-border-color)",
                backgroundColor: "var(--input-bg-color)",
                color: "var(--text-color)",
                boxShadow: "1px 1px 0px var(--panel-border-color)"
              }}
            >
              <span className="codicon codicon-organization small" />
              <span>{participants.length}</span>
              <span className={`codicon ${showParticipantsList ? 'codicon-chevron-up' : 'codicon-chevron-down'} small`} style={{ fontSize: 11 }} />
            </button>
            {isOverlay && setShowChat && (
              <button
                onClick={() => setShowChat(false)}
                className="p-1 rounded hover:bg-[var(--input-bg-color)] text-[var(--text-muted-color)] hover:text-[var(--text-color)]"
                title="Fechar Chat"
              >
                <span className="codicon codicon-close" style={{ fontSize: 14 }} />
              </button>
            )}
          </div>
        </div>

        {showParticipantsList && (
          <div
            className="mt-2.5 p-2 rounded border border-dashed flex flex-col gap-1.5 max-h-36 overflow-y-auto"
            style={{
              borderColor: "var(--panel-border-color)",
              backgroundColor: "rgba(0,0,0,0.05)"
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted-color)" }}>
              Conectados ({participants.length})
            </div>
            {participants.length === 0 ? (
              <div className="text-xs italic" style={{ color: "var(--text-muted-color)" }}>Apenas você na sessão</div>
            ) : (
              participants.map((p, pIdx) => {
                const pName = typeof p === 'string' ? p : (p?.username || p?.userId || "User");
                const pInitials = getInitials(pName);
                const pGradient = hashStringToColor(pName);
                const isMe = pName === localStorage.getItem("username");
                return (
                  <div key={pIdx} className="flex items-center justify-between text-sm py-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-5.5 h-5.5 rounded-full bg-gradient-to-tr ${pGradient} flex items-center justify-center text-[10px] font-bold text-white border border-black/10 flex-shrink-0`}
                        style={{ width: '22px', height: '22px' }}
                      >
                        {pInitials}
                      </div>
                      <span className="font-semibold truncate max-w-[110px]" style={{ color: "var(--text-color)" }}>
                        {pName} {isMe && "(Você)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px]" style={{ color: "var(--text-muted-color)" }}>online</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div
        ref={messagesRef}
        className="p-3 overflow-y-auto space-y-3 chat-container flex-1"
        style={{ height: `${chatHeight}px` }}
      >
        {(messages || []).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <span className="codicon codicon-comment text-3xl opacity-30 mb-2" />
            <p className="text-sm" style={{ color: "var(--text-muted-color)" }}>
              Nenhuma mensagem ainda.<br />Envie um oi para iniciar a conversa!
            </p>
          </div>
        ) : (
          (messages || []).map((msg, idx) => {
            const isSystem = msg.isSystem;
            const currentUser = localStorage.getItem("username") || "User";
            const isMe = msg.username === currentUser;
            const displayTime = msg.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (isSystem) {
              return (
                <div key={idx} className="flex justify-center my-2 animate-fade-in">
                  <div
                    className="px-2.5 py-1 rounded-full border text-xs font-semibold flex items-center gap-1.5"
                    style={{
                      backgroundColor: "var(--input-bg-color)",
                      borderColor: "var(--panel-border-color)",
                      opacity: 0.85
                    }}
                  >
                    <span className="codicon codicon-info text-blue-400" />
                    <span className="italic" style={{ color: "var(--text-muted-color)" }}>
                      {msg.content}
                    </span>
                    <span className="text-[10px] opacity-75" style={{ color: "var(--text-muted-color)" }}>
                      ({displayTime})
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div key={idx} className={`flex items-start gap-2 my-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && (
                  <div
                    className={`w-7.5 h-7.5 rounded-full bg-gradient-to-tr ${hashStringToColor(msg.username)} flex items-center justify-center text-xs font-bold text-white shadow-sm border border-black/10 flex-shrink-0`}
                    style={{ width: '30px', height: '30px' }}
                    title={msg.username}
                  >
                    {getInitials(msg.username)}
                  </div>
                )}

                <div className={`flex flex-col max-w-[82%] ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
                    {!isMe && (
                      <span className="text-xs font-bold" style={{ color: "var(--primary-color)" }}>
                        {msg.username}
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: "var(--text-muted-color)" }}>
                      {displayTime}
                    </span>
                  </div>

                  <div
                    className="border-2 p-3 rounded-xl text-[15px] leading-relaxed shadow-sm animate-fade-in"
                    style={{
                      backgroundColor: isMe ? "var(--primary-bg-color)" : "var(--input-bg-color)",
                      borderColor: "var(--panel-border-color)",
                      borderTopRightRadius: isMe ? '2px' : '10px',
                      borderTopLeftRadius: isMe ? '10px' : '2px',
                      color: "var(--text-color)",
                      boxShadow: "1.5px 1.5px 0px var(--panel-border-color)",
                      wordBreak: "break-word"
                    }}
                  >
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatMessagesEndRef} />
      </div>

      <div
        className="chat-resize-handle"
        onMouseDown={onChatMouseDown}
        title="Ajustar altura do chat"
      />

      <div
        className="p-3 border-t-2 chat-input flex flex-col"
        style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--panel-bg-color)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleInsertText("`")}
              title="Inserir Código Inline"
              className="px-1.5 py-0.5 rounded border text-xs font-mono hover:opacity-85 active:scale-95 transition-all flex items-center justify-center gap-0.5"
              style={{
                borderColor: "var(--panel-border-color)",
                backgroundColor: "var(--input-bg-color)",
                color: "var(--text-color)",
                boxShadow: "0.5px 0.5px 0px var(--panel-border-color)"
              }}
            >
              <span>`</span>
              <span className="text-[10px] opacity-75 font-sans">código</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {['💻', '🚀', '🔥', '👍', '🎉'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleInsertText(emoji)}
                className="hover:scale-125 hover:rotate-3 active:scale-90 transition-all duration-100 text-sm select-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <textarea
            ref={chatTextareaRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              !e.shiftKey &&
              (e.preventDefault(), handleSendChatMessage())
            }
            placeholder="Mensagem..."
            className="flex-1 p-2 border-2 resize-none focus:outline-none rounded-lg text-[14.5px]"
            style={{
              backgroundColor: "var(--input-bg-color)",
              borderColor: "var(--panel-border-color)",
              color: "var(--text-color)",
              fontSize: "14.5px",
              lineHeight: "1.4"
            }}
            rows="2"
          />

          <button
            onClick={handleSendChatMessage}
            disabled={!chatInput.trim()}
            className="px-2.5 py-1.5 border-2 rounded-lg font-bold transition-all duration-150 flex flex-col items-center justify-center gap-0.5 self-stretch"
            style={{
              backgroundColor: chatInput.trim() ? "var(--primary-color)" : "rgba(0,0,0,0.03)",
              borderColor: "var(--panel-border-color)",
              color: chatInput.trim() ? "#fff" : "var(--text-muted-color)",
              opacity: chatInput.trim() ? 1 : 0.6,
              cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
              boxShadow: chatInput.trim() ? "1.5px 1.5px 0px var(--panel-border-color)" : "none",
              transform: chatInput.trim() ? "translate(0, 0)" : "none",
            }}
          >
            <span className="codicon codicon-send text-sm" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Enviar</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default ChatPanel;
