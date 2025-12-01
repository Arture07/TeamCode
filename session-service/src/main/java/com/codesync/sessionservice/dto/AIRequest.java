package com.codesync.sessionservice.dto;

import lombok.Data;

@Data
public class AIRequest {
    private String message;
    private String context; // Optional: code context
}
