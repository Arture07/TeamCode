package com.codesync.syncservice.dto;

import lombok.Data;

@Data
public class FileEventMessage {

    public enum EventType {
        CREATED, UPDATED
    }

    private EventType type;
    private String name;
    private String content;
}