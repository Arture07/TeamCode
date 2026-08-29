package com.codesync.syncservice.dto;

import lombok.Data;

@Data
public class CodeMessage {
    private String content; // O conteúdo completo do editor
    private String filePath;
    private String userId;

    public CodeMessage() {}

    public CodeMessage(String content, String filePath, String userId) {
        this.content = content;
        this.filePath = filePath;
        this.userId = userId;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }
}