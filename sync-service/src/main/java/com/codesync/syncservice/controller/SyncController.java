package com.codesync.syncservice.controller;

import com.codesync.syncservice.dto.*;
import com.codesync.syncservice.service.TerminalService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Controller
@SuppressWarnings({ "null", "unchecked" })
public class SyncController {

    private static final Logger log = LoggerFactory.getLogger(SyncController.class);

    // Inactivity timeout threshold: 15 minutes (in milliseconds)
    private static final long INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000L;

    private final com.codesync.syncservice.config.RedisRelayConfig.ScalableMessagingService messagingService;
    private final TerminalService terminalService;

    // sessionParticipants: Map<sessionId, Map<userId, username>>
    private final Map<String, Map<String, String>> sessionParticipants = new ConcurrentHashMap<>();

    // userLastActivity: Map<sessionId:userId, timestampMillis>
    private final Map<String, Long> userLastActivity = new ConcurrentHashMap<>();

    public SyncController(com.codesync.syncservice.config.RedisRelayConfig.ScalableMessagingService messagingService,
            TerminalService terminalService) {
        this.messagingService = messagingService;
        this.terminalService = terminalService;
    }

    private void recordActivity(String sessionId, String userId) {
        if (sessionId != null && userId != null && !userId.isBlank()) {
            userLastActivity.put(sessionId + ":" + userId, System.currentTimeMillis());
        }
    }

    @MessageMapping("/code/{sessionId}")
    public void syncCode(@DestinationVariable String sessionId, @Payload CodeMessage message) {
        if (message != null && message.getUserId() != null) {
            recordActivity(sessionId, message.getUserId());
        }
        messagingService.convertAndSend("/topic/code/" + sessionId, message);
    }

    @MessageMapping("/cursor/{sessionId}")
    public void syncCursor(@DestinationVariable String sessionId, @Payload CursorMessage message) {
        if (message != null && message.getUserId() != null) {
            recordActivity(sessionId, message.getUserId());
        }
        messagingService.convertAndSend("/topic/cursor/" + sessionId, message);
    }

    @MessageMapping("/user.join/{sessionId}")
    public void userJoin(@DestinationVariable String sessionId, @Payload UserEventMessage joinMessage,
            SimpMessageHeaderAccessor headerAccessor) {
        String userId = joinMessage.getUserId();
        String username = joinMessage.getUsername();
        if (userId == null || userId.isBlank()) return;
        if (username == null || username.isBlank()) username = "User";

        sessionParticipants.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>()).put(userId, username);
        recordActivity(sessionId, userId);

        Map<String, Object> attrs = headerAccessor.getSessionAttributes();
        if (attrs != null) {
            attrs.put("sessionId", sessionId);
            attrs.put("userId", userId);
            attrs.put("username", username);
        }

        UserEventMessage eventMessage = new UserEventMessage();
        eventMessage.setType(UserEventMessage.EventType.JOIN);
        eventMessage.setUserId(userId);
        eventMessage.setUsername(username);
        eventMessage.setParticipants(getParticipantNames(sessionId));
        messagingService.convertAndSend("/topic/user/" + sessionId, eventMessage);

        log.info("User {} ({}) joined session {}. Total participants: {}", username, userId, sessionId, getParticipantNames(sessionId).size());
    }

    @MessageMapping("/user.leave/{sessionId}")
    public void userLeave(@DestinationVariable String sessionId, @Payload UserEventMessage leaveMessage) {
        if (leaveMessage != null && leaveMessage.getUserId() != null) {
            removeUserFromSession(sessionId, leaveMessage.getUserId(), leaveMessage.getUsername(),
                    UserEventMessage.EventType.LEAVE, "Usuário saiu da sessão");
        }
    }

    @MessageMapping("/heartbeat/{sessionId}")
    public void handleHeartbeat(@DestinationVariable String sessionId, @Payload(required = false) Map<String, Object> payload) {
        if (payload != null) {
            String userId = (String) payload.get("userId");
            if (userId != null && !userId.isBlank()) {
                recordActivity(sessionId, userId);
            }
        }
    }

    /**
     * Listener for WebSocket disconnect events (browser close, network drop, tab unload).
     */
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> sessionAttributes = headerAccessor.getSessionAttributes();
        if (sessionAttributes != null) {
            String sessionId = (String) sessionAttributes.get("sessionId");
            String userId = (String) sessionAttributes.get("userId");
            String username = (String) sessionAttributes.get("username");
            if (sessionId != null && userId != null) {
                log.info("WebSocket disconnect detected for user {} ({}) in session {}", username, userId, sessionId);
                removeUserFromSession(sessionId, userId, username, UserEventMessage.EventType.LEAVE, "Conexão encerrada");
            }
        }
    }

    /**
     * Periodic reaper for inactive participants (every 30 seconds).
     * Users inactive for more than 15 minutes are removed from the active session.
     */
    @Scheduled(fixedRate = 30000)
    public void checkInactiveUsers() {
        long now = System.currentTimeMillis();
        for (Map.Entry<String, Map<String, String>> sessionEntry : new ConcurrentHashMap<>(sessionParticipants).entrySet()) {
            String sessionId = sessionEntry.getKey();
            Map<String, String> participants = sessionEntry.getValue();
            if (participants == null) continue;

            for (Map.Entry<String, String> userEntry : new ConcurrentHashMap<>(participants).entrySet()) {
                String userId = userEntry.getKey();
                String username = userEntry.getValue();
                String activityKey = sessionId + ":" + userId;
                Long lastActivity = userLastActivity.get(activityKey);

                if (lastActivity != null && (now - lastActivity) > INACTIVITY_TIMEOUT_MS) {
                    log.warn("User {} ({}) in session {} has been inactive for >15 min. Disconnecting due to inactivity.", username, userId, sessionId);
                    removeUserFromSession(sessionId, userId, username, UserEventMessage.EventType.TIMEOUT, "Desconectado por inatividade (15 min)");
                }
            }
        }
    }

    public synchronized void removeUserFromSession(String sessionId, String userId, String username,
            UserEventMessage.EventType eventType, String reason) {
        Map<String, String> participants = sessionParticipants.get(sessionId);
        if (participants == null) return;

        String removedUsername = participants.remove(userId);
        userLastActivity.remove(sessionId + ":" + userId);

        String finalUsername = username != null ? username : (removedUsername != null ? removedUsername : "User");
        Set<String> remainingParticipants = getParticipantNames(sessionId);

        UserEventMessage eventMessage = new UserEventMessage();
        eventMessage.setType(eventType);
        eventMessage.setUserId(userId);
        eventMessage.setUsername(finalUsername);
        eventMessage.setParticipants(remainingParticipants);
        eventMessage.setReason(reason);

        messagingService.convertAndSend("/topic/user/" + sessionId, eventMessage);
        log.info("Participant {} ({}) removed from session {} [event: {}, reason: {}]. Remaining: {}",
                finalUsername, userId, sessionId, eventType, reason, remainingParticipants.size());

        if (participants.isEmpty()) {
            sessionParticipants.remove(sessionId);
            try {
                terminalService.removeProcess(sessionId);
                log.info("Session {} has no more active participants. Cleared terminal processes.", sessionId);
            } catch (Exception e) {
                log.debug("Failed to remove terminal process for empty session {}: {}", sessionId, e.getMessage());
            }
        }
    }

    @MessageMapping("/chat/{sessionId}")
    public void handleChatMessage(@DestinationVariable String sessionId, @Payload ChatMessage chatMessage) {
        if (chatMessage == null) return;
        String time = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"));
        chatMessage.setTimestamp(time);
        if (chatMessage.getUserId() != null) {
            recordActivity(sessionId, chatMessage.getUserId());
        }
        messagingService.convertAndSend("/topic/chat/" + sessionId, chatMessage);
    }

    @MessageMapping("/file/{sessionId}")
    public void handleFileEvent(@DestinationVariable String sessionId, @Payload FileEventMessage fileEvent) {
        messagingService.convertAndSend("/topic/file/" + sessionId, fileEvent);
    }

    @MessageMapping("/tree/{sessionId}")
    public void handleTreeEvent(@DestinationVariable String sessionId, @Payload TreeEventMessage treeEvent) {
        messagingService.convertAndSend("/topic/tree/" + sessionId, treeEvent);
    }

    @MessageMapping("/pomodoro/{sessionId}")
    public void handlePomodoro(@DestinationVariable String sessionId, @Payload PomodoroMessage pomodoroMessage) {
        messagingService.convertAndSend("/topic/pomodoro/" + sessionId, pomodoroMessage);
    }

    @MessageMapping("/reaction/{sessionId}")
    public void handleReaction(@DestinationVariable String sessionId, @Payload LineReactionMessage reactionMessage) {
        if (reactionMessage != null && reactionMessage.getUserId() != null) {
            recordActivity(sessionId, reactionMessage.getUserId());
        }
        messagingService.convertAndSend("/topic/reaction/" + sessionId, reactionMessage);
    }

    /**
     * Yjs/CRDT pass-through endpoint.
     */
    @MessageMapping("/yjs/{sessionId}")
    public void handleYjsUpdate(@DestinationVariable String sessionId, @Payload YjsMessage message) {
        if (message != null && message.getUserId() != null) {
            recordActivity(sessionId, message.getUserId());
        }
        messagingService.convertAndSend("/topic/yjs/" + sessionId, message);
    }

    @MessageMapping("/save/{sessionId}")
    public void saveFile(@DestinationVariable String sessionId, @Payload Map<String, String> payload) {
        String fileName = payload.get("fileName");
        String content = payload.get("content");
        String userId = payload.get("userId");
        if (userId != null) {
            recordActivity(sessionId, userId);
        }

        if (fileName == null || content == null)
            return;

        try {
            java.nio.file.Path sessionDir = java.nio.file.Paths.get("/tmp", sessionId).toAbsolutePath().normalize();
            if (!java.nio.file.Files.exists(sessionDir)) {
                java.nio.file.Files.createDirectories(sessionDir);
            }

            java.nio.file.Path filePath = resolveSafePath(sessionDir, fileName);
            if (filePath == null) return;

            if (filePath.getParent() != null && !java.nio.file.Files.exists(filePath.getParent())) {
                java.nio.file.Files.createDirectories(filePath.getParent());
            }

            java.nio.file.Files.write(
                    filePath,
                    content.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.TRUNCATE_EXISTING,
                    java.nio.file.StandardOpenOption.WRITE);

            try {
                java.util.Set<java.nio.file.attribute.PosixFilePermission> perms = java.nio.file.Files
                        .getPosixFilePermissions(filePath);
                perms.add(java.nio.file.attribute.PosixFilePermission.OTHERS_READ);
                java.nio.file.Files.setPosixFilePermissions(filePath, perms);
            } catch (UnsupportedOperationException ignored) {
            }

        } catch (Exception e) {
            log.error("Error saving file for session {}: {}", sessionId, e.getMessage());
        }
    }

    private java.nio.file.Path resolveSafePath(java.nio.file.Path sessionDir, String relativePath) {
        if (relativePath == null) return null;
        String clean = relativePath.trim().replace('\\', '/');
        while (clean.startsWith("/")) {
            clean = clean.substring(1);
        }
        while (clean.startsWith("./")) {
            clean = clean.substring(2);
        }
        java.nio.file.Path resolved = sessionDir.resolve(clean).normalize();
        if (!resolved.startsWith(sessionDir)) {
            throw new SecurityException("Invalid file path: " + relativePath);
        }
        return resolved;
    }

    @MessageMapping("/execute/{sessionId}")
    public void executeCode(@DestinationVariable String sessionId, @Payload Map<String, String> payload) {
        String command = payload.get("command");
        String fileName = payload.get("fileName");
        String content = payload.get("content");
        String userId = payload.get("userId");
        if (userId != null) {
            recordActivity(sessionId, userId);
        }

        if (command == null || command.isBlank())
            return;

        if (!terminalService.isAlive(sessionId)) {
            terminalService.startProcess(sessionId);
            try {
                Thread.sleep(300);
            } catch (InterruptedException ignored) {
            }
        }

        if (fileName != null && content != null) {
            try {
                java.nio.file.Path sessionDir = java.nio.file.Paths.get("/tmp", sessionId).toAbsolutePath().normalize();
                if (!java.nio.file.Files.exists(sessionDir)) {
                    java.nio.file.Files.createDirectories(sessionDir);
                }
                java.nio.file.Path filePath = resolveSafePath(sessionDir, fileName);
                if (filePath != null) {
                    if (filePath.getParent() != null && !java.nio.file.Files.exists(filePath.getParent())) {
                        java.nio.file.Files.createDirectories(filePath.getParent());
                    }
                    java.nio.file.Files.write(
                            filePath,
                            content.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                            java.nio.file.StandardOpenOption.CREATE,
                            java.nio.file.StandardOpenOption.TRUNCATE_EXISTING,
                            java.nio.file.StandardOpenOption.WRITE);
                }
            } catch (Exception e) {
                terminalService.handleInput(sessionId, "echo 'Erro ao salvar arquivo: " + e.getMessage() + "'\n");
                return;
            }
        }

        terminalService.handleInput(sessionId, command + "\n");
    }

    public Set<String> getParticipantNames(String sessionId) {
        return sessionParticipants.getOrDefault(sessionId, new ConcurrentHashMap<>())
                .values()
                .stream()
                .collect(Collectors.toSet());
    }

    public Map<String, Map<String, String>> getSessionParticipants() {
        return Collections.unmodifiableMap(sessionParticipants);
    }

    public Map<String, Long> getUserLastActivity() {
        return Collections.unmodifiableMap(userLastActivity);
    }

    @MessageMapping("/terminal.start/{sessionId}")
    public void startTerminalSingle(@DestinationVariable String sessionId,
            @Payload(required = false) Map<String, Object> payload) {
        startTerminalMulti(sessionId, "main", payload);
    }

    @MessageMapping("/terminal.start/{sessionId}/{terminalId}")
    public void startTerminalMulti(@DestinationVariable String sessionId,
            @DestinationVariable String terminalId,
            @Payload(required = false) Map<String, Object> payload) {
        int cols = 80;
        int rows = 24;
        if (payload != null) {
            Object c = payload.get("cols");
            Object r = payload.get("rows");
            if (c instanceof Number)
                cols = ((Number) c).intValue();
            if (r instanceof Number)
                rows = ((Number) r).intValue();
        }
        String tId = (terminalId != null && !terminalId.trim().isEmpty()) ? terminalId : "main";
        terminalService.startProcess(sessionId, tId, cols, rows);
    }

    @MessageMapping("/terminal.resize/{sessionId}")
    public void resizeTerminalSingle(@DestinationVariable String sessionId, @Payload Map<String, Object> payload) {
        resizeTerminalMulti(sessionId, "main", payload);
    }

    @MessageMapping("/terminal.resize/{sessionId}/{terminalId}")
    public void resizeTerminalMulti(@DestinationVariable String sessionId,
            @DestinationVariable String terminalId,
            @Payload Map<String, Object> payload) {
        if (payload == null)
            return;
        Object c = payload.get("cols");
        Object r = payload.get("rows");
        int cols = (c instanceof Number) ? ((Number) c).intValue() : 80;
        int rows = (r instanceof Number) ? ((Number) r).intValue() : 24;
        String tId = (terminalId != null && !terminalId.trim().isEmpty()) ? terminalId : "main";
        terminalService.resizeTerminal(sessionId, tId, cols, rows);
    }

    @MessageMapping("/terminal.in/{sessionId}")
    public void terminalInputSingle(@DestinationVariable String sessionId,
            @Payload TerminalInputMessage message) {
        terminalInputMulti(sessionId, "main", message);
    }

    @MessageMapping("/terminal.in/{sessionId}/{terminalId}")
    public void terminalInputMulti(@DestinationVariable String sessionId,
            @DestinationVariable String terminalId,
            @Payload TerminalInputMessage message) {
        String tId = (terminalId != null && !terminalId.trim().isEmpty()) ? terminalId : "main";
        if (!terminalService.isAlive(sessionId, tId)) {
            terminalService.startProcess(sessionId, tId, 80, 24);
        }
        terminalService.handleInput(sessionId, tId, message.getInput());
    }

    @MessageMapping("/terminal.close/{sessionId}/{terminalId}")
    public void closeTerminal(@DestinationVariable String sessionId,
            @DestinationVariable String terminalId) {
        terminalService.removeProcess(sessionId, terminalId);
    }
}

