package com.codesync.syncservice.dto;

public class TreeEventMessage {
    public enum EventType { CREATED, UPDATED, DELETED, MOVED, RENAMED, DUPLICATED, REFRESH }

    private EventType type;
    private String path;       // affected path
    private String newPath;    // for move/rename/duplicate

    public TreeEventMessage() {
    }

    public TreeEventMessage(EventType type, String path, String newPath) {
        this.type = type;
        this.path = path;
        this.newPath = newPath;
    }

    public EventType getType() {
        return type;
    }

    public void setType(EventType type) {
        this.type = type;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getNewPath() {
        return newPath;
    }

    public void setNewPath(String newPath) {
        this.newPath = newPath;
    }
}
