package com.crewcode.sessionservice.dto;

public class AIResponse {
    private String response;

    public AIResponse() {
    }

    public AIResponse(String response) {
        this.response = response;
    }

    public String getResponse() {
        return response;
    }

    public void setResponse(String response) {
        this.response = response;
    }
}
