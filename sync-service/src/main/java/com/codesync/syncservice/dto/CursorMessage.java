package com.codesync.syncservice.dto;

import lombok.Data;

@Data
public class CursorMessage {
    private String userId;
    private String username;
    private String filePath;   // The file being edited
    private int lineNumber;    // 1-based
    private int column;        // 1-based

    public CursorMessage() {}

    public CursorMessage(String userId, String username, String filePath, int lineNumber, int column) {
        this.userId = userId;
        this.username = username;
        this.filePath = filePath;
        this.lineNumber = lineNumber;
        this.column = column;
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

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public int getLineNumber() {
        return lineNumber;
    }

    public void setLineNumber(int lineNumber) {
        this.lineNumber = lineNumber;
    }

    public int getColumn() {
        return column;
    }

    public void setColumn(int column) {
        this.column = column;
    }
}