package com.codesync.syncservice.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LineReactionMessage {
    private String userId;
    private String username;
    private String filePath;
    private Integer lineNumber;
    private String emoji;
    private String action; // "add", "remove"
}
