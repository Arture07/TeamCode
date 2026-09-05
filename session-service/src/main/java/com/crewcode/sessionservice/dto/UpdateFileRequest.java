package com.crewcode.sessionservice.dto;

public class UpdateFileRequest {
    private String name;
    private String content;

    public UpdateFileRequest() {
    }

    public UpdateFileRequest(String name, String content) {
        this.name = name;
        this.content = content;
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
}
