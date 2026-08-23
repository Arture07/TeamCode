package com.codesync.syncservice.service;

import com.pty4j.PtyProcess;
import com.pty4j.PtyProcessBuilder;
import com.pty4j.WinSize;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

@Service
public class TerminalService {

    private static final Logger log = LoggerFactory.getLogger(TerminalService.class);

    // Security: validate sessionId to prevent path traversal
    private static final Pattern SESSION_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9_\\-]{1,64}$");

    // Security: maximum number of concurrent terminal sessions
    private static final int MAX_CONCURRENT_TERMINALS = 20;

    private final com.codesync.syncservice.config.RedisRelayConfig.ScalableMessagingService messagingService;
    private final Map<String, PtyProcess> activeProcesses = new ConcurrentHashMap<>();
    private final Map<String, OutputStream> processWriters = new ConcurrentHashMap<>();
    private final ExecutorService processExecutor = Executors.newCachedThreadPool();

    public TerminalService(com.codesync.syncservice.config.RedisRelayConfig.ScalableMessagingService messagingService) {
        this.messagingService = messagingService;
    }

    /**
     * Validates the sessionId to prevent path traversal and injection attacks.
     */
    private void validateSessionId(String sessionId) {
        if (sessionId == null || !SESSION_ID_PATTERN.matcher(sessionId).matches()) {
            throw new IllegalArgumentException("ID de sessão inválido");
        }
    }

    /**
     * Starts a real PTY-backed bash process for the given session.
     * @param sessionId the session identifier
     * @param cols      initial terminal columns (default 80)
     * @param rows      initial terminal rows (default 24)
     */
    public synchronized void startProcess(String sessionId, int cols, int rows) {
        // Security: validate sessionId
        validateSessionId(sessionId);

        if (activeProcesses.containsKey(sessionId)) {
            PtyProcess existing = activeProcesses.get(sessionId);
            if (existing != null && existing.isAlive()) {
                if (cols > 0 && rows > 0) {
                    try {
                        existing.setWinSize(new WinSize(cols, rows));
                    } catch (Exception ignored) {}
                }
                handleInput(sessionId, "\n");
                return; // PTY process already running, prompt re-triggered
            } else {
                removeProcess(sessionId);
            }
        }

        // Security: limit concurrent terminals
        if (activeProcesses.size() >= MAX_CONCURRENT_TERMINALS) {
            log.warn("Maximum concurrent terminals reached ({}). Rejecting session {}.", MAX_CONCURRENT_TERMINALS, sessionId);
            messagingService.convertAndSend("/topic/terminal/" + sessionId,
                    "\r\n\u001b[31m[Erro: Limite máximo de terminais simultâneos atingido]\u001b[0m\r\n");
            return;
        }

        try {
            // Ensure the working directory exists and is under /tmp
            Path workDir = Paths.get("/tmp", sessionId).toAbsolutePath().normalize();
            if (!workDir.startsWith("/tmp")) {
                throw new SecurityException("Path traversal detectado no sessionId");
            }
            if (!Files.exists(workDir)) {
                Files.createDirectories(workDir);
            }

            // Write a .bashrc into the work dir to set the prompt.
            String bashrcContent =
                "export PS1='\\[\\033[1;32m\\]TeamCode\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ '\n" +
                "# Security: restrict dangerous commands\n" +
                "alias rm='rm --preserve-root'\n" +
                "readonly TMOUT=3600\n"; // Auto-logout after 1 hour of inactivity

            java.nio.file.Files.write(
                    workDir.resolve(".bashrc"),
                    bashrcContent.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);

            // Build the PTY environment
            Map<String, String> env = new HashMap<>(System.getenv());
            env.put("TERM", "xterm-256color");
            env.put("LANG", "en_US.UTF-8");
            env.put("HOME", workDir.toString()); // HOME points to work dir so .bashrc is loaded
            // Security: restricted PATH — only standard binaries
            env.put("PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin");

            // Launch bash in interactive mode loading our .bashrc
            String[] command = {"/bin/bash", "--rcfile", workDir.resolve(".bashrc").toString(), "-i"};

            PtyProcess pty = new PtyProcessBuilder()
                    .setCommand(command)
                    .setEnvironment(env)
                    .setDirectory(workDir.toString())
                    .setInitialColumns(cols > 0 ? cols : 80)
                    .setInitialRows(rows > 0 ? rows : 24)
                    .setConsole(false)
                    .start();

            activeProcesses.put(sessionId, pty);
            processWriters.put(sessionId, pty.getOutputStream());

            // Background thread: stream PTY output to WebSocket topic
            processExecutor.submit(() -> {
                try (InputStream stdout = pty.getInputStream()) {
                    byte[] buffer = new byte[4096];
                    int read;
                    while ((read = stdout.read(buffer)) != -1) {
                        String output = new String(buffer, 0, read, StandardCharsets.UTF_8);
                        messagingService.convertAndSend("/topic/terminal/" + sessionId, output);
                    }
                } catch (IOException e) {
                    // Process exited — normal flow
                } finally {
                    removeProcess(sessionId);
                    // Notify frontend the process ended
                    messagingService.convertAndSend("/topic/terminal/" + sessionId, "\r\n\u001b[0m\u001b[1;33m[Terminal encerrado]\u001b[0m\r\n");
                }
            });

            log.info("PTY started for session {} ({}x{})", sessionId, cols, rows);

        } catch (IOException e) {
            log.error("Failed to start PTY for session {}: {}", sessionId, e.getMessage());
            messagingService.convertAndSend("/topic/terminal/" + sessionId,
                    "\r\n\u001b[31m[Erro ao iniciar terminal]\u001b[0m\r\n");
        }
    }

    /**
     * Backwards-compat overload with default terminal size.
     */
    public void startProcess(String sessionId) {
        startProcess(sessionId, 80, 24);
    }

    /**
     * Sends raw input bytes to the PTY process (keystrokes, Ctrl+C, etc.)
     */
    public void handleInput(String sessionId, String input) {
        validateSessionId(sessionId);
        OutputStream writer = processWriters.get(sessionId);
        if (writer != null && input != null) {
            // Security: limit input size to prevent memory exhaustion
            if (input.length() > 8192) {
                log.warn("Input too large for session {} ({} chars), truncating", sessionId, input.length());
                input = input.substring(0, 8192);
            }
            try {
                writer.write(input.getBytes(StandardCharsets.UTF_8));
                writer.flush();
            } catch (IOException e) {
                log.warn("Failed to write to PTY for session {}: {}", sessionId, e.getMessage());
                removeProcess(sessionId);
            }
        }
    }

    /**
     * Notifies the PTY of a terminal resize event (SIGWINCH).
     * @param sessionId the session
     * @param cols      new column count
     * @param rows      new row count
     */
    public void resizeTerminal(String sessionId, int cols, int rows) {
        validateSessionId(sessionId);
        PtyProcess pty = activeProcesses.get(sessionId);
        // Security: limit resize to reasonable values
        if (pty != null && cols > 0 && cols <= 500 && rows > 0 && rows <= 200) {
            try {
                pty.setWinSize(new WinSize(cols, rows));
                log.debug("Resized PTY for session {} to {}x{}", sessionId, cols, rows);
            } catch (Exception e) {
                log.warn("Failed to resize PTY for session {}: {}", sessionId, e.getMessage());
            }
        }
    }

    /**
     * Terminates and cleans up the PTY process for the given session.
     */
    public void removeProcess(String sessionId) {
        PtyProcess pty = activeProcesses.remove(sessionId);
        processWriters.remove(sessionId);
        if (pty != null && pty.isAlive()) {
            pty.destroyForcibly();
        }
    }

    /**
     * Returns true if a PTY process is currently alive for this session.
     */
    public boolean isAlive(String sessionId) {
        PtyProcess pty = activeProcesses.get(sessionId);
        return pty != null && pty.isAlive();
    }
}
