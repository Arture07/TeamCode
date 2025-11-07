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
    public void userJoin(@DestinationVariable String sessionId, @Payload UserEventMessage joinMessage, SimpMessageHeaderAccessor headerAccessor) {
        String userId = joinMessage.getUserId();
        String username = joinMessage.getUsername();
        sessionParticipants.computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>()).put(userId, username);
        if (headerAccessor.getSessionAttributes() != null) {
            headerAccessor.getSessionAttributes().put("sessionId", sessionId);
            headerAccessor.getSessionAttributes().put("userId", userId);
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

    @MessageMapping("/execute/{sessionId}")
    public void executeCode(@DestinationVariable String sessionId, @Payload Map<String, String> payload) {
        String command = payload.get("command");
        String fileName = payload.get("fileName");
        String content = payload.get("content");
        
        if (command == null || command.isBlank()) return;
        
        // If file content provided, create temp file first
        if (fileName != null && content != null) {
            try {
                // Create/overwrite file in /tmp directory
                java.nio.file.Path filePath = java.nio.file.Paths.get("/tmp", fileName);
                // Use CREATE, TRUNCATE_EXISTING, WRITE to always overwrite
                java.nio.file.Files.write(
                    filePath, 
                    content.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.TRUNCATE_EXISTING,
                    java.nio.file.StandardOpenOption.WRITE
                );
                
                // Change to /tmp directory and then execute
                terminalService.handleInput(sessionId, "cd /tmp\n");
                Thread.sleep(100); // Small delay to ensure cd completes
                terminalService.handleInput(sessionId, command + "\n");
            } catch (Exception e) {
                // If file creation fails, send error to terminal
                terminalService.handleInput(sessionId, "echo 'Error creating file: " + e.getMessage() + "'\n");
            }
        } else {
            // No file content, just execute command directly
            terminalService.handleInput(sessionId, command + "\n");
        }
    }

    private Set<String> getParticipantNames(String sessionId) {
        return sessionParticipants.getOrDefault(sessionId, new ConcurrentHashMap<>())
                .values()
                .stream()
                .collect(Collectors.toSet());
    }

    @MessageMapping("/terminal.start/{sessionId}")
    public void startTerminal(@DestinationVariable String sessionId) {
        terminalService.startProcess(sessionId);
    }

    @MessageMapping("/terminal.in/{sessionId}")
    public void terminalInput(@DestinationVariable String sessionId, @Payload TerminalInputMessage message) {
        terminalService.handleInput(sessionId, message.getData());
    }
}
