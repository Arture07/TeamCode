import React, { useState, useEffect, useRef } from "react";

const PomodoroWidget = ({ sessionId, stompClient, username }) => {
  const [workTime, setWorkTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  const [remaining, setRemaining] = useState(25 * 60);
  const [phase, setPhase] = useState("work"); // "work" ou "break"
  const [isRunning, setIsRunning] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const timerRef = useRef(null);
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    if (!stompClient?.connected) return;

    const subscription = stompClient.subscribe(`/topic/pomodoro/${sessionId}`, (message) => {
      const data = JSON.parse(message.body);
      if (data.workTime) setWorkTime(data.workTime);
      if (data.breakTime) setBreakTime(data.breakTime);

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
          setRemaining(data.workTime * 60);
          break;
        case "skip":
          setIsRunning(true);
          setPhase(data.nextPhase);
          setRemaining(data.nextTime);
          break;
      }
    });

    return () => subscription.unsubscribe();
  }, [stompClient, sessionId, isRunning]);

  const sendUpdate = (action, currentPhase, secs, extraData = {}) => {
    if (stompClient?.connected) {
      stompClient.publish({
        destination: `/app/pomodoro/${sessionId}`,
        body: JSON.stringify({
          action,
          phase: currentPhase,
          remainingSeconds: secs,
          startedBy: username,
          workTime,
          breakTime,
          ...extraData
        }),
      });
    }
  };

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
    setRemaining(workTime * 60);
    sendUpdate("reset", "work", workTime * 60);
  };

  const skipPhase = () => {
    setIsHost(true);
    setIsRunning(true);
    const nextPhase = phase === "work" ? "break" : "work";
    const nextTime = nextPhase === "work" ? workTime * 60 : breakTime * 60;
    setPhase(nextPhase);
    setRemaining(nextTime);
    sendUpdate("skip", phase, remaining, { nextPhase, nextTime });
  };

  useEffect(() => {
    if (isRunning && isHost) {
      timerRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            const nextPhase = phase === "work" ? "break" : "work";
            const nextTime = nextPhase === "work" ? workTime * 60 : breakTime * 60;
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
  }, [isRunning, isHost, phase, workTime, breakTime]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="flex items-center space-x-3 bg-gray-800 text-gray-200 px-3 py-1.5 rounded-md text-sm shadow-sm border border-gray-700">
      <div className="flex items-center space-x-2 font-mono font-medium">
        <span>{phase === "work" ? "🍅" : "☕"}</span>
        <span 
          className={`${remaining < 60 ? "text-red-400" : ""} cursor-pointer`}
          title={!isRunning && phase === "work" ? "Clique para editar o tempo" : ""}
          onClick={() => {
            if (!isRunning && phase === "work") setIsEditing(true);
          }}
        >
          {isEditing && !isRunning && phase === "work" ? (
             <input 
               type="number" 
               value={workTime} 
               onChange={e => {
                 const val = parseInt(e.target.value) || 1;
                 setWorkTime(val);
                 setRemaining(val * 60);
               }} 
               onBlur={() => setIsEditing(false)} 
               onKeyDown={e => e.key === "Enter" && setIsEditing(false)}
               className="w-12 bg-gray-700 text-white text-center rounded outline-none" 
               autoFocus 
             />
          ) : (
             formatTime(remaining)
          )}
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
