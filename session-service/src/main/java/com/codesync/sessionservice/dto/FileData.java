package com.codesync.sessionservice.dto;

public class FileData {
    private String name;
    private String content;
    private boolean folder = false;

    public FileData() {
    }

    public FileData(String name, String content) {
        this.name = name;
        this.content = content;
        this.folder = false;
    }

    public FileData(String name, String content, boolean folder) {
        this.name = name;
        this.content = content;
        this.folder = folder;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public boolean isFolder() {
        return folder;
    }

    public void setFolder(boolean folder) {
        this.folder = folder;
    }
}
