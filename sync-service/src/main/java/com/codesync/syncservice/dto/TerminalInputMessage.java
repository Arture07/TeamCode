package com.codesync.syncservice.dto;

public class TerminalInputMessage {
    private String input;

    public TerminalInputMessage() {
    }

    public TerminalInputMessage(String input) {
        this.input = input;
    }

    public String getInput() {
        return input;
    }

    public void setInput(String input) {
        this.input = input;
    }
}
