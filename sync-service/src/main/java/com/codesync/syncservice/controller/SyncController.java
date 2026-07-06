package com.codesync.syncservice.controller;

import com.codesync.syncservice.dto.*;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import com.codesync.syncservice.dto.TerminalInputMessage;
import com.codesync.syncservice.service.TerminalService;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Controller
@SuppressWarnings("null")
public class SyncController {

    private final SimpMessagingTemplate messagingTemplate;
    private final TerminalService terminalService; // Injetar o serviço de terminal
    private final Map<String, Map<String, String>> sessionParticipants = new ConcurrentHashMap<>();

    public SyncController(SimpMessagingTemplate messagingTemplate, TerminalService terminalService) {
        this.messagingTemplate = messagingTemplate;
        this.terminalService = terminalService;
    }

    @MessageMapping("/code/{sessionId}")
    public void syncCode(@DestinationVariable String sessionId, @Payload CodeMessage message) {
        messagingTemplate.convertAndSend("/topic/code/" + sessionId, message);
    }

    @MessageMapping("/cursor/{sessionId}")
    public void syncCursor(@DestinationVariable String sessionId, @Payload CursorMessage message) {
        messagingTemplate.convertAndSend("/topic/cursor/" + sessionId, message);
    }

    @MessageMapping("/user.join/{sessionId}")
    public void userJoin(@DestinationVariable String sessionId, @Payload UserEventMessage joinMessage,
            SimpMessageHeaderAccessor headerAccessor) {
        String userId = joinMessage.getUserId();
        String username = joinMessage.getUsername();
        sessionParticipants.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>()).put(userId, username);
        java.util.Map<String, Object> attrs = headerAccessor.getSessionAttributes();
        if (attrs != null) {
            attrs.put("sessionId", sessionId);
            attrs.put("userId", userId);
        }
        UserEventMessage eventMessage = new UserEventMessage();
        eventMessage.setType(UserEventMessage.EventType.JOIN);
        eventMessage.setUserId(userId);
        eventMessage.setUsername(username);
        eventMessage.setParticipants(getParticipantNames(sessionId));
        messagingTemplate.convertAndSend("/topic/user/" + sessionId, eventMessage);
    }

    @MessageMapping("/chat/{sessionId}")
    public void handleChatMessage(@DestinationVariable String sessionId, @Payload ChatMessage chatMessage) {
        String time = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"));
        chatMessage.setTimestamp(time);
        messagingTemplate.convertAndSend("/topic/chat/" + sessionId, chatMessage);
    }

    @MessageMapping("/file/{sessionId}")
    public void handleFileEvent(@DestinationVariable String sessionId, @Payload FileEventMessage fileEvent) {
        messagingTemplate.convertAndSend("/topic/file/" + sessionId, fileEvent);
    }

    @MessageMapping("/tree/{sessionId}")
    public void handleTreeEvent(@DestinationVariable String sessionId, @Payload TreeEventMessage treeEvent) {
        messagingTemplate.convertAndSend("/topic/tree/" + sessionId, treeEvent);
    }

    /**
     * Yjs/CRDT pass-through endpoint.
     * Receives a Yjs binary delta (Base64-encoded) from any client and broadcasts
     * it to all other participants in the session.
     * This is intentionally stateless — the CRDT logic lives entirely in the
     * frontend.
     * The server acts purely as a relay, keeping the backend simple and decoupled.
     */
    @MessageMapping("/yjs/{sessionId}")
    public void handleYjsUpdate(@DestinationVariable String sessionId, @Payload YjsMessage message) {
        // Pass-through: broadcast the Yjs delta to all subscribers in this session
        messagingTemplate.convertAndSend("/topic/yjs/" + sessionId, message);
    }

    @MessageMapping("/save/{sessionId}")
    public void saveFile(@DestinationVariable String sessionId, @Payload Map<String, String> payload) {
        String fileName = payload.get("fileName");
        String content = payload.get("content");

        if (fileName == null || content == null)
            return;

        try {
            // Create session-specific directory in /tmp
            java.nio.file.Path sessionDir = java.nio.file.Paths.get("/tmp", sessionId).toAbsolutePath().normalize();
            if (!java.nio.file.Files.exists(sessionDir)) {
                java.nio.file.Files.createDirectories(sessionDir);
            }

            // Create/overwrite file in session directory
            // SECURITY FIX: Prevent Path Traversal
            java.nio.file.Path filePath = sessionDir.resolve(fileName).normalize();
            if (!filePath.startsWith(sessionDir)) {
                throw new SecurityException("Invalid file path: " + fileName);
            }

            // Ensure parent directories exist
            if (filePath.getParent() != null && !java.nio.file.Files.exists(filePath.getParent())) {
                java.nio.file.Files.createDirectories(filePath.getParent());
            }

            // Use CREATE, TRUNCATE_EXISTING, WRITE to always overwrite
            java.nio.file.Files.write(
                    filePath,
                    content.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.TRUNCATE_EXISTING,
                    java.nio.file.StandardOpenOption.WRITE);

            // Ensure file is readable by others (for Nginx)
            try {
                java.util.Set<java.nio.file.attribute.PosixFilePermission> perms = java.nio.file.Files
                        .getPosixFilePermissions(filePath);
                perms.add(java.nio.file.attribute.PosixFilePermission.OTHERS_READ);
                java.nio.file.Files.setPosixFilePermissions(filePath, perms);
            } catch (UnsupportedOperationException e) {
                // Ignore if filesystem doesn't support POSIX permissions (e.g. Windows host
                // mount sometimes)
            }

        } catch (Exception e) {
            // Log error or notify user via terminal/toast if possible
            System.err.println("Error saving file: " + e.getMessage());
        }
    }

    /**
     * Executes code by writing the run command directly into the live PTY terminal.
     * If file content is provided, first writes the file to the session workspace,
     * then sends the run command to the terminal (no process restart).
     */
    @MessageMapping("/execute/{sessionId}")
    public void executeCode(@DestinationVariable String sessionId, @Payload Map<String, String> payload) {
        String command = payload.get("command");
        String fileName = payload.get("fileName");
        String content = payload.get("content");

        if (command == null || command.isBlank())
            return;

        // Ensure the PTY is alive; start if not
        if (!terminalService.isAlive(sessionId)) {
            terminalService.startProcess(sessionId);
            // Small delay so bash is ready
            try {
                Thread.sleep(300);
            } catch (InterruptedException ignored) {
            }
        }

        // If file content provided, write it to disk before running
        if (fileName != null && content != null) {
            try {
                java.nio.file.Path sessionDir = java.nio.file.Paths.get("/tmp", sessionId).toAbsolutePath().normalize();
                if (!java.nio.file.Files.exists(sessionDir)) {
                    java.nio.file.Files.createDirectories(sessionDir);
                }
                java.nio.file.Path filePath = sessionDir.resolve(fileName).normalize();
                if (!filePath.startsWith(sessionDir)) {
                    throw new SecurityException("Invalid file path: " + fileName);
                }
                if (filePath.getParent() != null && !java.nio.file.Files.exists(filePath.getParent())) {
                    java.nio.file.Files.createDirectories(filePath.getParent());
                }
                java.nio.file.Files.write(
                        filePath,
                        content.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                        java.nio.file.StandardOpenOption.CREATE,
                        java.nio.file.StandardOpenOption.TRUNCATE_EXISTING,
                        java.nio.file.StandardOpenOption.WRITE);
            } catch (Exception e) {
                terminalService.handleInput(sessionId, "echo 'Erro ao salvar arquivo: " + e.getMessage() + "'\n");
                return;
            }
        }

        // Send the command directly into the PTY (user sees it as if typed)
        terminalService.handleInput(sessionId, command + "\n");
    }

    private Set<String> getParticipantNames(String sessionId) {
        return sessionParticipants.getOrDefault(sessionId, new ConcurrentHashMap<>())
                .values()
                .stream()
                .collect(Collectors.toSet());
    }

    /**
     * Starts a PTY terminal for the session.
     * The frontend should send {cols, rows} so the PTY is sized correctly from the
     * start.
     */
    @MessageMapping("/terminal.start/{sessionId}")
    public void startTerminal(@DestinationVariable String sessionId,
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
        terminalService.startProcess(sessionId, cols, rows);
    }

    /**
     * Handles terminal resize events from the frontend.
     * Sends SIGWINCH to the PTY so programs like vim/top reflow correctly.
     */
    @MessageMapping("/terminal.resize/{sessionId}")
    public void resizeTerminal(@DestinationVariable String sessionId, @Payload Map<String, Object> payload) {
        if (payload == null)
            return;
        Object c = payload.get("cols");
        Object r = payload.get("rows");
        int cols = (c instanceof Number) ? ((Number) c).intValue() : 80;
        int rows = (r instanceof Number) ? ((Number) r).intValue() : 24;
        terminalService.resizeTerminal(sessionId, cols, rows);
    }

    /**
     * Forwards raw keyboard input from the frontend to the PTY process.
     */
    @MessageMapping("/terminal.in/{sessionId}")
    public void terminalInput(@DestinationVariable String sessionId, @Payload TerminalInputMessage message) {
        // Auto-start PTY if it died or wasn't started yet
        if (!terminalService.isAlive(sessionId)) {
            terminalService.startProcess(sessionId);
        }
        terminalService.handleInput(sessionId, message.getInput());
    }
}
