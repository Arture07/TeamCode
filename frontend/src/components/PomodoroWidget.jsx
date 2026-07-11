import React, { useState, useEffect, useRef } from "react";

const WORK_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

const PomodoroWidget = ({ sessionId, stompClient, username }) => {
  const [remaining, setRemaining] = useState(WORK_TIME);
  const [phase, setPhase] = useState("work"); // "work" ou "break"
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!stompClient?.connected) return;

    const subscription = stompClient.subscribe(`/topic/pomodoro/${sessionId}`, (message) => {
      const data = JSON.parse(message.body);

      switch (data.action) {
        case "start":
          setIsRunning(true);
          setPhase(data.phase);
          setRemaining(data.remainingSeconds);
          break;
        case "pause":
          setIsRunning(false);
          setRemaining(data.remainingSeconds);
          break;
        case "tick":
        case "sync":
          setPhase(data.phase);
          setRemaining(data.remainingSeconds);
          setIsRunning(data.action === "tick" || isRunning);
          break;
        case "reset":
          setIsRunning(true);
          setPhase("work");
          setRemaining(WORK_TIME);
          break;
        case "skip":
          setIsRunning(true);
          const nextPhase = data.phase === "work" ? "break" : "work";
          setPhase(nextPhase);
          setRemaining(nextPhase === "work" ? WORK_TIME : BREAK_TIME);
          break;
      }
    });

    return () => subscription.unsubscribe();
  }, [stompClient, sessionId, isRunning]);

  // Host logic: only the user who started it broadcasts the ticks
  const [isHost, setIsHost] = useState(false);

  const startTimer = () => {
    setIsHost(true);
    setIsRunning(true);
    sendUpdate("start", phase, remaining);
  };

  const pauseTimer = () => {
    setIsHost(false);
    setIsRunning(false);
    sendUpdate("pause", phase, remaining);
  };

  const resetTimer = () => {
    setIsHost(true);
    setIsRunning(true);
    sendUpdate("reset", "work", WORK_TIME);
  };

  const skipPhase = () => {
    setIsHost(true);
    setIsRunning(true);
    sendUpdate("skip", phase, remaining);
  };

  const sendUpdate = (action, currentPhase, secs) => {
    if (stompClient?.connected) {
      stompClient.publish({
        destination: `/app/pomodoro/${sessionId}`,
        body: JSON.stringify({
          action,
          phase: currentPhase,
          remainingSeconds: secs,
          startedBy: username
        }),
      });
    }
  };

  useEffect(() => {
    if (isRunning && isHost) {
      timerRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            // Play sound? (Optional)
            const nextPhase = phase === "work" ? "break" : "work";
            const nextTime = nextPhase === "work" ? WORK_TIME : BREAK_TIME;

            sendUpdate("start", nextPhase, nextTime);
            return nextTime;
          }
          sendUpdate("tick", phase, prev - 1);
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isRunning, isHost, phase]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="flex items-center space-x-3 bg-gray-800 text-gray-200 px-3 py-1.5 rounded-md text-sm shadow-sm border border-gray-700">
      <div className="flex items-center space-x-2 font-mono font-medium">
        <span>{phase === "work" ? "🍅" : "☕"}</span>
        <span className={`${remaining < 60 ? "text-red-400" : ""}`}>
          {formatTime(remaining)}
        </span>
        <span className="text-xs uppercase text-gray-400 font-sans tracking-wide">
          {phase}
        </span>
      </div>

      <div className="flex items-center space-x-1 border-l border-gray-600 pl-3">
        {!isRunning ? (
          <button onClick={startTimer} className="hover:bg-gray-700 p-1 rounded" title="Iniciar">
            ▶️
          </button>
        ) : (
          <button onClick={pauseTimer} className="hover:bg-gray-700 p-1 rounded" title="Pausar">
            ⏸
          </button>
        )}
        <button onClick={skipPhase} className="hover:bg-gray-700 p-1 rounded" title="Pular Fase">
          ⏭
        </button>
        <button onClick={resetTimer} className="hover:bg-gray-700 p-1 rounded" title="Zerar">
          🔄
        </button>
      </div>
    </div>
  );
};

export default PomodoroWidget;
