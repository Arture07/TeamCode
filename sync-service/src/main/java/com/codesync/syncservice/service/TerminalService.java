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

@Service
public class TerminalService {

    private static final Logger log = LoggerFactory.getLogger(TerminalService.class);

    private final com.codesync.syncservice.config.RedisRelayConfig.ScalableMessagingService messagingService;
    private final Map<String, PtyProcess> activeProcesses = new ConcurrentHashMap<>();
    private final Map<String, OutputStream> processWriters = new ConcurrentHashMap<>();
    private final ExecutorService processExecutor = Executors.newCachedThreadPool();

    public TerminalService(com.codesync.syncservice.config.RedisRelayConfig.ScalableMessagingService messagingService) {
        this.messagingService = messagingService;
    }

    /**
     * Starts a real PTY-backed bash process for the given session.
     * @param sessionId the session identifier
     * @param cols      initial terminal columns (default 80)
     * @param rows      initial terminal rows (default 24)
     */
    public synchronized void startProcess(String sessionId, int cols, int rows) {
        if (activeProcesses.containsKey(sessionId)) {
            return; // PTY process already running
        }

        try {
            // Ensure the working directory exists
            Path workDir = Paths.get("/tmp", sessionId).toAbsolutePath().normalize();
            if (!Files.exists(workDir)) {
                Files.createDirectories(workDir);
            }

            // Write a .bashrc into the work dir to set the prompt.
            // The 'printf "\033c"' at the end resets the terminal state so the
            // blank line that bash emits on startup with --rcfile is cleared.
            String bashrcContent =
                "export PS1='\\[\\033[1;32m\\]TeamCode\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ '\n" +
                "printf '\\033c'\n";
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
                    "\r\n\u001b[31m[Erro ao iniciar terminal: " + e.getMessage() + "]\u001b[0m\r\n");
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
        OutputStream writer = processWriters.get(sessionId);
        if (writer != null && input != null) {
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
        PtyProcess pty = activeProcesses.get(sessionId);
        if (pty != null && cols > 0 && rows > 0) {
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
