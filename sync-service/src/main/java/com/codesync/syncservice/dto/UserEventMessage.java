package com.codesync.syncservice.dto;

import lombok.Data;
import java.util.Set;

@Data
public class UserEventMessage {
    public enum EventType {
        JOIN, LEAVE
    }
    private String userId;
    private String username;
    private EventType type;
    private Set<String> participants; // A lista atualizada de participantes na sala
}