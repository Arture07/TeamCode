/**
 * useWebSocket - Encapsulates STOMP/SockJS WebSocket connection lifecycle.
 * 
 * Manages connection, subscriptions, and automatic reconnection.
 * Event handlers are passed in as callbacks to maintain loose coupling.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getAuthHeaders } from '../utils/auth';

/**
 * @param {Object} params
 * @param {string} params.sessionId - Session ID
 * @param {string} params.userId - Current user ID
 * @param {Object} params.handlers - Event handler callbacks
 * @param {Function} params.handlers.onUserEvent - Handler for user join/leave events
 * @param {Function} params.handlers.onChatMessage - Handler for chat messages
 * @param {Function} params.handlers.onFileEvent - Handler for file creation events
 * @param {Function} params.handlers.onCursorEvent - Handler for cursor position events
 * @param {Function} params.handlers.onCodeEvent - Handler for code change events
 * @param {Function} params.handlers.onTreeEvent - Handler for tree structure events
 * @param {Function} params.handlers.onTerminalOutput - Handler for terminal output
 * @param {Function} params.handlers.onStatusChange - Handler for connection status changes
 * @param {Function} params.handlers.onConnect - Called after connection established and subscriptions set
 * @param {React.MutableRefObject} params.terminalApiRef - Ref to terminal API for writing output
 * @returns {{ stompClientRef, publishTreeEvent, sendChatMessage, connectToWebSocket }}
 */
export function useWebSocket({
  sessionId,
  userId,
  handlers,
  terminalApiRef,
}) {
  const stompClientRef = useRef(null);
  // Store handlers in a ref to avoid stale closures
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connectToWebSocket = useCallback(() => {
    const token = localStorage.getItem('jwtToken');
    const h = handlersRef.current;

    const client = new Client({
      webSocketFactory: () =>
        new SockJS(`http://${window.location.host}/ws-connect`),
      reconnectDelay: 5000,
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      onConnect: () => {
        h.onStatusChange?.('Sincronizado!');

        client.subscribe(`/topic/user/${sessionId}`, (msg) => handlersRef.current.onUserEvent?.(msg));
        client.subscribe(`/topic/chat/${sessionId}`, (msg) => handlersRef.current.onChatMessage?.(msg));
        client.subscribe(`/topic/file/${sessionId}`, (msg) => handlersRef.current.onFileEvent?.(msg));
        client.subscribe(`/topic/cursor/${sessionId}`, (msg) => handlersRef.current.onCursorEvent?.(msg));
        client.subscribe(`/topic/code/${sessionId}`, (msg) => handlersRef.current.onCodeEvent?.(msg));
        client.subscribe(`/topic/tree/${sessionId}`, (msg) => handlersRef.current.onTreeEvent?.(msg));
        client.subscribe(`/topic/terminal/${sessionId}`, (message) => {
          let content = message.body;
          try {
            const json = JSON.parse(message.body);
            if (json && typeof json === 'object' && 'output' in json) {
              content = json.output;
            }
          } catch (_) { }
          terminalApiRef.current?.write(content ?? '');
        });

        // Join session
        client.publish({
          destination: `/app/user.join/${sessionId}`,
          body: JSON.stringify({
            userId,
            username: localStorage.getItem('username') || 'User',
            type: 'JOIN',
          }),
        });

        // Start terminal
        try {
          client.publish({ destination: `/app/terminal.start/${sessionId}` });
        } catch (_) { }

        // Notify consumer that connection is ready
        h.onConnect?.(client);
      },
      onStompError: () => handlersRef.current.onStatusChange?.('Erro de conexão.'),
      onWebSocketClose: () => handlersRef.current.onStatusChange?.('Desconectado. Reconectando...'),
    });

    client.activate();
    stompClientRef.current = client;
  }, [sessionId, userId, terminalApiRef]);

  // Publish tree events helper
  const publishTreeEvent = useCallback((type, path, newPath) => {
    try {
      const client = stompClientRef.current;
      if (!client?.connected) return;
      client.publish({
        destination: `/app/tree/${sessionId}`,
        body: JSON.stringify({ type, path, newPath }),
      });
    } catch (_) { }
  }, [sessionId]);

  // Send chat message helper
  const sendChatMessage = useCallback((content) => {
    if (!content?.trim() || !stompClientRef.current?.connected) return;
    stompClientRef.current.publish({
      destination: `/app/chat/${sessionId}`,
      body: JSON.stringify({
        username: localStorage.getItem('username') || 'User',
        content: content.trim(),
      }),
    });
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        stompClientRef.current?.deactivate();
      } catch (_) { }
    };
  }, []);

  return {
    stompClientRef,
    publishTreeEvent,
    sendChatMessage,
    connectToWebSocket,
  };
}
