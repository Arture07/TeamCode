package com.crewcode.syncservice.dto;

public class ChatMessage {
    private String userId;
    private String username;
    private String content;
    private String timestamp;

    public ChatMessage() {
    }

    public ChatMessage(String username, String content, String timestamp) {
        this.username = username;
        this.content = content;
        this.timestamp = timestamp;
    }

    public ChatMessage(String userId, String username, String content, String timestamp) {
        this.userId = userId;
        this.username = username;
        this.content = content;
        this.timestamp = timestamp;
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

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }
}