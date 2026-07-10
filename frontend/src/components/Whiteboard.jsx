import React, { useState, useEffect, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';

export default function Whiteboard({ stompClient, sessionId, myUserId }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const isUpdatingRef = useRef(false);
  const elementsRef = useRef([]);

  useEffect(() => {
    if (!stompClient || !stompClient.connected) return;

    const subscription = stompClient.subscribe(`/topic/whiteboard/${sessionId}`, (message) => {
      try {
        const data = JSON.parse(message.body);
        if (data.userId === myUserId) return; // ignore our own updates
        
        if (data.type === 'SYNC' && excalidrawAPI) {
          isUpdatingRef.current = true;
          excalidrawAPI.updateScene({ elements: data.elements });
          elementsRef.current = data.elements;
          setTimeout(() => { isUpdatingRef.current = false; }, 100);
        }
      } catch (e) {
        console.error("Whiteboard sync error", e);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [stompClient, sessionId, myUserId, excalidrawAPI]);

  const onChange = (elements, appState) => {
    if (isUpdatingRef.current) return;
    
    // Check if elements really changed to avoid loops
    if (JSON.stringify(elements) !== JSON.stringify(elementsRef.current)) {
      elementsRef.current = elements;
      if (stompClient && stompClient.connected) {
        stompClient.publish({
          destination: `/topic/whiteboard/${sessionId}`,
          body: JSON.stringify({
            type: 'SYNC',
            userId: myUserId,
            elements: elements
          })
        });
      }
    }
  };

  return (
    <div className="w-full h-full relative" style={{ height: 'calc(100vh - 40px)' }}>
      <Excalidraw 
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={onChange}
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: true,
            clearCanvas: true,
            loadScene: false,
            export: { saveFileToDisk: true },
            theme: true
          }
        }}
      />
    </div>
  );
}
