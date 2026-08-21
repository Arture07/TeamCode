package com.codesync.syncservice.dto;

public class ChatMessage {
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