package com.codesync.sessionservice.dto;

import lombok.Data;
import java.util.List;

@Data
public class AIRequest {
    private String sessionId;
    private String message;
    private String context;
    private String mode;
    private List<Attachment> attachments;

    @Data
    public static class Attachment {
        private String name;
        private String mimeType;
        private String data;
    }
}
