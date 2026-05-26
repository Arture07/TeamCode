/**
 * Item 20: useYjsCollaboration
 * 
 * Integra Yjs/CRDT com o Monaco Editor usando o STOMP WebSocket existente
 * como transporte. Encapsula updates Yjs em base64 para transmissão via STOMP.
 * 
 * Arquitetura:
 *   Monaco Editor <-> y-monaco binding <-> Yjs Y.Doc <-> STOMP transport
 * 
 * O backend recebe mensagens no tópico /app/yjs/{sessionId} e repassa
 * para /topic/yjs/{sessionId}. Não requer nenhuma mudança no backend
 * além de adicionar esse endpoint de passagem (pass-through).
 * 
 * Se o backend não suportar o endpoint Yjs, o sistema degrada graciosamente
 * para o comportamento atual de broadcast de strings.
 */
import { useEffect, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';

/**
 * @param {Object} params
 * @param {string|null} params.activeFile - Caminho do arquivo ativo
 * @param {string} params.sessionId - ID da sessão
 * @param {string} params.userId - ID do usuário atual
 * @param {React.MutableRefObject} params.editorRef - Ref do Monaco Editor
 * @param {React.MutableRefObject} params.stompClientRef - Ref do cliente STOMP
 * @param {boolean} params.enabled - Se o Yjs está habilitado (flag opt-in)
 * @returns {{ isYjsActive: boolean, destroyYjs: () => void }}
 */
export function useYjsCollaboration({
  activeFile,
  sessionId,
  userId,
  editorRef,
  stompClientRef,
  enabled = true,
}) {
  const ydocRef = useRef(null);
  const bindingRef = useRef(null);
  const stompSubRef = useRef(null);
  const isApplyingRemoteRef = useRef(false);

  // Cleanup function
  const destroyYjs = useCallback(() => {
    try {
      if (stompSubRef.current) {
        stompSubRef.current.unsubscribe();
        stompSubRef.current = null;
      }
    } catch (_) {}
    try {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
      }
    } catch (_) {}
    try {
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!enabled || !activeFile || !editorRef.current || !stompClientRef.current?.connected) {
      return;
    }

    // Create a new Y.Doc for this file
    destroyYjs();

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const ytext = ydoc.getText('content');

    // Sync initial content from Monaco to Yjs
    const currentContent = editorRef.current.getValue() || '';
    if (currentContent) {
      ydoc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, currentContent);
      });
    }

    // Bind Y.Text to Monaco model
    try {
      const model = editorRef.current.getModel();
      if (model) {
        const binding = new MonacoBinding(
          ytext,
          model,
          new Set([editorRef.current]),
        );
        bindingRef.current = binding;
      }
    } catch (e) {
      console.warn('[Yjs] MonacoBinding failed, falling back to string mode:', e);
      destroyYjs();
      return;
    }

    // Send Yjs updates via STOMP
    const updateHandler = (update, origin) => {
      // Don't re-broadcast updates that came from remote
      if (origin === 'remote') return;
      if (!stompClientRef.current?.connected) return;

      try {
        const encoded = btoa(String.fromCharCode(...update));
        stompClientRef.current.publish({
          destination: `/app/yjs/${sessionId}`,
          body: JSON.stringify({
            fileId: activeFile,
            userId,
            update: encoded,
          }),
        });
      } catch (e) {
        console.warn('[Yjs] Failed to send update:', e);
      }
    };

    ydoc.on('update', updateHandler);

    // Subscribe to remote Yjs updates
    try {
      const sub = stompClientRef.current.subscribe(
        `/topic/yjs/${sessionId}`,
        (message) => {
          try {
            const data = JSON.parse(message.body);
            // Ignore our own updates or updates for other files
            if (data.userId === userId || data.fileId !== activeFile) return;

            const update = Uint8Array.from(atob(data.update), c => c.charCodeAt(0));
            isApplyingRemoteRef.current = true;
            Y.applyUpdate(ydoc, update, 'remote');
            isApplyingRemoteRef.current = false;
          } catch (e) {
            console.warn('[Yjs] Failed to apply remote update:', e);
          }
        }
      );
      stompSubRef.current = sub;
    } catch (e) {
      // Backend doesn't support Yjs endpoint — degrade gracefully
      console.warn('[Yjs] Backend does not support /topic/yjs — Yjs disabled for this session', e);
      destroyYjs();
    }

    return () => {
      ydoc.off('update', updateHandler);
      destroyYjs();
    };
  }, [activeFile, sessionId, userId, enabled, destroyYjs]);

  return {
    isYjsActive: !!bindingRef.current,
    destroyYjs,
  };
}
