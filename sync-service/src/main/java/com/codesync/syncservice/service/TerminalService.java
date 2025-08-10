package com.codesync.syncservice.service;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Service
public class TerminalService {

    private final SimpMessagingTemplate messagingTemplate;
    private final Map<String, Process> activeProcesses = new ConcurrentHashMap<>();
    private final Map<String, OutputStream> processWriters = new ConcurrentHashMap<>();
    private final ExecutorService processExecutor = Executors.newCachedThreadPool();

    public TerminalService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void startProcess(String sessionId) {
        if (activeProcesses.containsKey(sessionId)) {
            return; // Processo já existe
        }
        try {
            String os = System.getProperty("os.name").toLowerCase();
            ProcessBuilder builder = os.contains("win")
                    ? new ProcessBuilder("cmd.exe")
                    : new ProcessBuilder("/bin/sh", "-i");

            builder.redirectErrorStream(true);
            Process process = builder.start();

            activeProcesses.put(sessionId, process);
            processWriters.put(sessionId, process.getOutputStream());

            processExecutor.submit(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        messagingTemplate.convertAndSend("/topic/terminal/" + sessionId, line + "\r\n");
                    }
                } catch (IOException e) {
                    // Silencioso
                } finally {
                    removeProcess(sessionId);
                }
            });
        } catch (IOException e) {
            e.printStackTrace();
            removeProcess(sessionId);
        }
    }

    public void handleInput(String sessionId, String command) {
        OutputStream writer = processWriters.get(sessionId);
        if (writer != null) {
            try {
                writer.write((command + "\n").getBytes());
                writer.flush();
            } catch (IOException e) {
                e.printStackTrace();
                removeProcess(sessionId);
            }
        }
    }

    public void removeProcess(String sessionId) {
        Process process = activeProcesses.remove(sessionId);
        processWriters.remove(sessionId);
        if (process != null && process.isAlive()) {
            process.destroyForcibly();
        }
    }
}
