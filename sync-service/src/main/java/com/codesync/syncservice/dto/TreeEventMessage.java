package com.codesync.syncservice.dto;

import lombok.Data;

@Data
public class TreeEventMessage {
    public enum EventType { CREATED, UPDATED, DELETED, MOVED, RENAMED, DUPLICATED, REFRESH }
    private EventType type;
    private String path;       // affected path
    private String newPath;    // for move/rename/duplicate
}
