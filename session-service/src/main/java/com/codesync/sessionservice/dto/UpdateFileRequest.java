package com.codesync.sessionservice.dto;

import lombok.Data;

@Data
public class UpdateFileRequest {
    private String name;
    private String content;
}
