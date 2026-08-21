package com.codesync.sessionservice.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "ai_usage_log")
public class AIUsageLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Column(length = 50)
    private String username;

    @Column(length = 50)
    private String model;

    @Column(length = 30)
    private String mode; // chat, agent, explain

    @Column(name = "prompt_tokens")
    private Integer promptTokens = 0;

    @Column(name = "response_tokens")
    private Integer responseTokens = 0;

    @Column(name = "total_tokens")
    private Integer totalTokens = 0;

    @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
    @Column(nullable = false, updatable = false)
    private Instant timestamp = Instant.now();

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = Instant.now();
        }
    }

    public AIUsageLog() {
    }

    public AIUsageLog(String sessionId, String username, String model, String mode, Integer promptTokens,
            Integer responseTokens, Integer totalTokens) {
        this.sessionId = sessionId;
        this.username = username != null ? username : "anonymous";
        this.model = model;
        this.mode = mode != null ? mode : "chat";
        this.promptTokens = promptTokens != null ? promptTokens : 0;
        this.responseTokens = responseTokens != null ? responseTokens : 0;
        this.totalTokens = totalTokens != null ? totalTokens : 0;
        this.timestamp = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public Integer getPromptTokens() {
        return promptTokens;
    }

    public void setPromptTokens(Integer promptTokens) {
        this.promptTokens = promptTokens;
    }

    public Integer getResponseTokens() {
        return responseTokens;
    }

    public void setResponseTokens(Integer responseTokens) {
        this.responseTokens = responseTokens;
    }

    public Integer getTotalTokens() {
        return totalTokens;
    }

    public void setTotalTokens(Integer totalTokens) {
        this.totalTokens = totalTokens;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }
}
