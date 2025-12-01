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
                    : new ProcessBuilder("/bin/sh"); // Removido flag -i para evitar prompts e warnings de TTY

            builder.redirectErrorStream(true);
            Process process = builder.start();

            activeProcesses.put(sessionId, process);
            processWriters.put(sessionId, process.getOutputStream());

            processExecutor.submit(() -> {
                try (java.io.InputStream stdout = process.getInputStream()) {
                    byte[] buffer = new byte[1024];
                    int read;
                    while ((read = stdout.read(buffer)) != -1) {
                        String output = new String(buffer, 0, read, java.nio.charset.StandardCharsets.UTF_8);
                        messagingTemplate.convertAndSend("/topic/terminal/" + sessionId, output);
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
        if (writer != null && command != null) {
            try {
                writer.write(command.getBytes());
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
