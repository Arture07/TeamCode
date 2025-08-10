package com.codesync.syncservice.dto;

import lombok.Data;

@Data
public class CursorMessage {
    private String userId;
    private String username;
    private int lineNumber;    // 1-based
    private int column;        // 1-based
}