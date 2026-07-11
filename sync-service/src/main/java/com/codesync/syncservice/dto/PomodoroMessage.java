package com.codesync.syncservice.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PomodoroMessage {
    private String action; // "start", "pause", "reset", "skip", "tick", "sync"
    private String phase;  // "work", "break"
    private Integer remainingSeconds;
    private String startedBy;
}
