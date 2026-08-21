package com.codesync.syncservice.dto;

import java.util.Set;

public class UserEventMessage {
    public enum EventType {
        JOIN, LEAVE
    }

    private String userId;
    private String username;
    private EventType type;
    private Set<String> participants;

    public UserEventMessage() {
    }

    public UserEventMessage(String userId, String username, EventType type, Set<String> participants) {
        this.userId = userId;
        this.username = username;
        this.type = type;
        this.participants = participants;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public EventType getType() {
        return type;
    }

    public void setType(EventType type) {
        this.type = type;
    }

    public Set<String> getParticipants() {
        return participants;
    }

    public void setParticipants(Set<String> participants) {
        this.participants = participants;
    }
}