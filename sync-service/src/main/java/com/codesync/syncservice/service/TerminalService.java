package com.codesync.syncservice.service;

import com.pty4j.PtyProcess;
import com.pty4j.PtyProcessBuilder;
import com.pty4j.WinSize;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private final Map<String, StringBuilder> outputBuffers = new ConcurrentHashMap<>();
    private final ExecutorService processExecutor = Executors.newCachedThreadPool();
    private final ObjectMapper objectMapper = new ObjectMapper();

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
    private String makeKey(String sessionId, String terminalId) {
        String tId = (terminalId == null || terminalId.trim().isEmpty()) ? "main" : terminalId.trim();
        return sessionId + ":" + tId;
    }

    private String makeTopic(String sessionId, String terminalId) {
        String tId = (terminalId == null || terminalId.trim().isEmpty()) ? "main" : terminalId.trim();
        if ("main".equalsIgnoreCase(tId) || "1".equals(tId)) {
            return "/topic/terminal/" + sessionId;
        }
        return "/topic/terminal/" + sessionId + "/" + tId;
    }

    /**
     * Starts a real PTY-backed bash process for the given session and terminal ID.
     */
    public synchronized void startProcess(String sessionId, String terminalId, int cols, int rows) {
        validateSessionId(sessionId);
        String key = makeKey(sessionId, terminalId);
        String topic = makeTopic(sessionId, terminalId);

        if (activeProcesses.containsKey(key)) {
            PtyProcess existing = activeProcesses.get(key);
            if (existing != null && existing.isAlive()) {
                if (cols > 0 && rows > 0) {
                    try {
                        existing.setWinSize(new WinSize(cols, rows));
                    } catch (Exception ignored) {}
                }
                // Replay recent output buffer so new/reloaded subscribers see the prompt & history
                StringBuilder cached = outputBuffers.get(key);
                if (cached != null && cached.length() > 0) {
                    synchronized (cached) {
                        messagingService.convertAndSend(topic, cached.toString());
                    }
                } else {
                    handleInput(sessionId, terminalId, "\r");
                }
                return; // PTY process already running
            } else {
                removeProcess(sessionId, terminalId);
            }
        }

        // Security: limit concurrent terminals
        if (activeProcesses.size() >= MAX_CONCURRENT_TERMINALS) {
            log.warn("Maximum concurrent terminals reached ({}). Rejecting session {}:{}.", MAX_CONCURRENT_TERMINALS, sessionId, terminalId);
            messagingService.convertAndSend(topic,
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

            // Synchronize workspace files from session-service database tree
            syncWorkspaceFromDatabase(sessionId, workDir);

            String javaHome = System.getenv("JAVA_HOME");
            if (javaHome == null || javaHome.isBlank()) {
                javaHome = "/opt/java/openjdk";
            }

            // Write .inputrc for readline tab-completion and case-insensitivity
            String inputrcContent =
                "set completion-ignore-case on\n" +
                "set show-all-if-ambiguous on\n" +
                "set show-all-if-unmodified on\n" +
                "\"\\t\": menu-complete\n" +
                "\"\\e[Z\": menu-complete-backward\n" +
                "set colored-stats on\n" +
                "set mark-directories on\n" +
                "set mark-symlinked-directories on\n";

            java.nio.file.Files.write(
                    workDir.resolve(".inputrc"),
                    inputrcContent.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);

            // Write a .bashrc into the work dir to set prompt, environment, sandbox security and tab/path enhancements
            String bashrcContent =
                "export WORKSPACE_ROOT=\"" + workDir.toString() + "\"\n" +
                "export HOME=\"$WORKSPACE_ROOT\"\n" +
                "export JAVA_HOME=\"" + javaHome + "\"\n" +
                "export PATH=\"$JAVA_HOME/bin:/usr/local/bin:/usr/bin:/bin\"\n" +
                "export PS1='\\[\\033[1;32m\\]CodeSync\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ '\n" +
                "readonly TMOUT=3600\n\n" +
                "# Security: restrict dangerous commands and privilege escalation\n" +
                "alias rm='rm --preserve-root'\n" +
                "alias kill='echo \"[Acesso Negado] Comando kill desativado no ambiente compartilhado.\"\n'\n" +
                "alias pkill='echo \"[Acesso Negado] Comando pkill desativado no ambiente compartilhado.\"\n'\n" +
                "alias killall='echo \"[Acesso Negado] Comando killall desativado no ambiente compartilhado.\"\n'\n" +
                "alias reboot='echo \"[Acesso Negado] Operação de sistema não permitida.\"\n'\n" +
                "alias shutdown='echo \"[Acesso Negado] Operação de sistema não permitida.\"\n'\n" +
                "alias su='echo \"[Acesso Negado] Troca de usuário não permitida.\"\n'\n" +
                "alias sudo='echo \"[Acesso Negado] Acesso administrativo não permitido.\"\n'\n\n" +
                "# Readline & Auto-completion Enhancements\n" +
                "bind 'set completion-ignore-case on' 2>/dev/null\n" +
                "bind 'set show-all-if-ambiguous on' 2>/dev/null\n" +
                "bind 'set show-all-if-unmodified on' 2>/dev/null\n" +
                "bind 'TAB:menu-complete' 2>/dev/null\n" +
                "bind '\"\\e[Z\":menu-complete-backward' 2>/dev/null\n" +
                "bind 'set colored-stats on' 2>/dev/null\n" +
                "bind 'set mark-directories on' 2>/dev/null\n" +
                "bind 'set mark-symlinked-directories on' 2>/dev/null\n\n" +
                "# Sandboxed cd navigation: disallows leaving the project workspace ($WORKSPACE_ROOT)\n" +
                "_tc_fix_path() {\n" +
                "    local a=\"$1\"\n" +
                "    a=\"${a//\\\\//}\"\n" +
                "    if [ -e \"$a\" ]; then echo \"$a\"; return; fi\n" +
                "    if [[ \"$a\" =~ ^\\.[a-zA-Z0-9_-]+ ]]; then\n" +
                "        local raw=\"${a#.}\"\n" +
                "        for d in */; do\n" +
                "            d=\"${d%/}\"\n" +
                "            if [ -n \"$d\" ] && [[ \"$raw\" == \"$d\"* ]]; then\n" +
                "                local rest=\"${raw#$d}\"\n" +
                "                if [ -e \"$d/$rest\" ]; then echo \"$d/$rest\"; return; fi\n" +
                "            fi\n" +
                "        done\n" +
                "        if [ -e \"$raw\" ]; then echo \"$raw\"; return; elif [ -e \"./$raw\" ]; then echo \"./$raw\"; return; fi\n" +
                "    fi\n" +
                "    echo \"$a\"\n" +
                "}\n" +
                "pip() { local args=(); for a in \"$@\"; do args+=(\"$(_tc_fix_path \"$a\")\"); done; command pip \"${args[@]}\"; }\n" +
                "pip3() { local args=(); for a in \"$@\"; do args+=(\"$(_tc_fix_path \"$a\")\"); done; command pip3 \"${args[@]}\"; }\n" +
                "python() { local args=(); for a in \"$@\"; do args+=(\"$(_tc_fix_path \"$a\")\"); done; command python \"${args[@]}\"; }\n" +
                "python3() { local args=(); for a in \"$@\"; do args+=(\"$(_tc_fix_path \"$a\")\"); done; command python3 \"${args[@]}\"; }\n" +
                "node() { local args=(); for a in \"$@\"; do args+=(\"$(_tc_fix_path \"$a\")\"); done; command node \"${args[@]}\"; }\n" +
                "cat() { local args=(); for a in \"$@\"; do args+=(\"$(_tc_fix_path \"$a\")\"); done; command cat \"${args[@]}\"; }\n\n" +
                "cd() {\n" +
                "    if [ $# -eq 0 ] || [ \"$1\" = \"~\" ]; then\n" +
                "        builtin cd \"$WORKSPACE_ROOT\"\n" +
                "        return 0\n" +
                "    fi\n" +
                "    local target=\"$(_tc_fix_path \"$1\")\"\n" +
                "    local canonical\n" +
                "    canonical=$(realpath -m \"$target\" 2>/dev/null || readlink -m \"$target\" 2>/dev/null)\n" +
                "    if [ -z \"$canonical\" ]; then\n" +
                "        canonical=\"$target\"\n" +
                "    fi\n" +
                "    if [[ \"$canonical\" == \"$WORKSPACE_ROOT\" ]] || [[ \"$canonical\" == \"$WORKSPACE_ROOT/\"* ]]; then\n" +
                "        builtin cd \"$target\"\n" +
                "    else\n" +
                "        echo -e \"\\033[1;33m[Aviso de Segurança]\\033[0m Acesso restrito: você só pode navegar dentro da pasta do seu projeto (~).\"\n" +
                "        return 1\n" +
                "    fi\n" +
                "}\n";

            java.nio.file.Files.write(
                    workDir.resolve(".bashrc"),
                    bashrcContent.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    java.nio.file.StandardOpenOption.CREATE,
                    java.nio.file.StandardOpenOption.TRUNCATE_EXISTING);

            // Build a clean, isolated environment (NEVER leak host/container secrets like DB passwords, JWT_SECRET, etc.)
            Map<String, String> env = new HashMap<>();
            env.put("TERM", "xterm-256color");
            env.put("LANG", "en_US.UTF-8");
            env.put("LC_ALL", "en_US.UTF-8");
            env.put("HOME", workDir.toString());
            env.put("PWD", workDir.toString());
            env.put("WORKSPACE_ROOT", workDir.toString());
            env.put("USER", "codesync");
            env.put("LOGNAME", "codesync");
            env.put("INPUTRC", workDir.resolve(".inputrc").toString());
            env.put("JAVA_HOME", javaHome);
            env.put("PYTHONUNBUFFERED", "1");
            env.put("PATH", javaHome + "/bin:/usr/local/bin:/usr/bin:/bin");

            String[] command = {"/bin/bash", "--rcfile", workDir.resolve(".bashrc").toString(), "-i"};

            PtyProcess pty = new PtyProcessBuilder()
                    .setCommand(command)
                    .setEnvironment(env)
                    .setDirectory(workDir.toString())
                    .setInitialColumns(cols > 0 ? cols : 80)
                    .setInitialRows(rows > 0 ? rows : 24)
                    .setConsole(false)
                    .start();

            activeProcesses.put(key, pty);
            processWriters.put(key, pty.getOutputStream());

            // Background thread: stream PTY output to WebSocket topic
            processExecutor.submit(() -> {
                try (InputStream stdout = pty.getInputStream()) {
                    byte[] buffer = new byte[4096];
                    int read;
                    while ((read = stdout.read(buffer)) != -1) {
                        String output = new String(buffer, 0, read, StandardCharsets.UTF_8);
                        StringBuilder sb = outputBuffers.computeIfAbsent(key, k -> new StringBuilder());
                        synchronized (sb) {
                            sb.append(output);
                            if (sb.length() > 32768) {
                                sb.delete(0, sb.length() - 24576);
                            }
                        }
                        messagingService.convertAndSend(topic, output);
                    }
                } catch (IOException e) {
                    // Process exited — normal flow
                } finally {
                    removeProcess(sessionId, terminalId);
                    messagingService.convertAndSend(topic, "\r\n\u001b[0m\u001b[1;33m[Terminal encerrado]\u001b[0m\r\n");
                }
            });

            log.info("PTY started for session {}:{} ({}x{})", sessionId, terminalId, cols, rows);

        } catch (IOException e) {
            log.error("Failed to start PTY for session {}:{}: {}", sessionId, terminalId, e.getMessage());
            messagingService.convertAndSend(topic,
                    "\r\n\u001b[31m[Erro ao iniciar terminal]\u001b[0m\r\n");
        }
    }

    public synchronized void restartProcess(String sessionId, String terminalId, int cols, int rows) {
        validateSessionId(sessionId);
        String key = makeKey(sessionId, terminalId);
        String topic = makeTopic(sessionId, terminalId);
        removeProcess(sessionId, terminalId);
        outputBuffers.remove(key);
        messagingService.convertAndSend(topic, "\r\n\u001b[2J\u001b[H\u001b[1;36m[Reiniciando Terminal...]\u001b[0m\r\n");
        startProcess(sessionId, terminalId, cols, rows);
    }

    public void startProcess(String sessionId, int cols, int rows) {
        startProcess(sessionId, "main", cols, rows);
    }

    public void startProcess(String sessionId) {
        startProcess(sessionId, "main", 80, 24);
    }

    public void handleInput(String sessionId, String terminalId, String input) {
        validateSessionId(sessionId);
        String key = makeKey(sessionId, terminalId);
        OutputStream writer = processWriters.get(key);
        if (writer != null && input != null) {
            if (input.length() > 8192) {
                log.warn("Input too large for session {} ({} chars), truncating", key, input.length());
                input = input.substring(0, 8192);
            }
            try {
                writer.write(input.getBytes(StandardCharsets.UTF_8));
                writer.flush();
            } catch (IOException e) {
                log.warn("Failed to write to PTY for session {}: {}", key, e.getMessage());
                removeProcess(sessionId, terminalId);
            }
        }
    }

    public void handleInput(String sessionId, String input) {
        handleInput(sessionId, "main", input);
    }

    public void resizeTerminal(String sessionId, String terminalId, int cols, int rows) {
        validateSessionId(sessionId);
        String key = makeKey(sessionId, terminalId);
        PtyProcess pty = activeProcesses.get(key);
        if (pty != null && cols > 0 && cols <= 500 && rows > 0 && rows <= 200) {
            try {
                pty.setWinSize(new WinSize(cols, rows));
                log.debug("Resized PTY for session {} to {}x{}", key, cols, rows);
            } catch (Exception e) {
                log.warn("Failed to resize PTY for session {}: {}", key, e.getMessage());
            }
        }
    }

    public void resizeTerminal(String sessionId, int cols, int rows) {
        resizeTerminal(sessionId, "main", cols, rows);
    }

    public void removeProcess(String sessionId, String terminalId) {
        String key = makeKey(sessionId, terminalId);
        PtyProcess pty = activeProcesses.remove(key);
        processWriters.remove(key);
        outputBuffers.remove(key);
        if (pty != null && pty.isAlive()) {
            pty.destroyForcibly();
        }
    }

    public void removeProcess(String sessionId) {
        // Remove all terminals matching sessionId:*
        String prefix = sessionId + ":";
        for (String k : new HashSet<>(activeProcesses.keySet())) {
            if (k.equals(sessionId) || k.startsWith(prefix)) {
                PtyProcess pty = activeProcesses.remove(k);
                processWriters.remove(k);
                outputBuffers.remove(k);
                if (pty != null && pty.isAlive()) {
                    pty.destroyForcibly();
                }
            }
        }
    }

    public boolean isAlive(String sessionId, String terminalId) {
        PtyProcess pty = activeProcesses.get(makeKey(sessionId, terminalId));
        return pty != null && pty.isAlive();
    }

    public boolean isAlive(String sessionId) {
        return isAlive(sessionId, "main");
    }

    @SuppressWarnings("unchecked")
    private void syncWorkspaceFromDatabase(String sessionId, Path sessionDir) {
        try {
            String url = "http://session-service:8080/api/tree/" + sessionId;
            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(3))
                    .GET()
                    .build();

            java.net.http.HttpResponse<String> response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                Map<String, Object> body = objectMapper.readValue(response.body(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
                Map<String, Object> tree = (Map<String, Object>) body.get("tree");
                if (tree != null) {
                    Map<String, String> dbFiles = new HashMap<>();
                    collectFilesFromTree(tree, "", dbFiles);
                    for (Map.Entry<String, String> entry : dbFiles.entrySet()) {
                        String relativePath = entry.getKey();
                        String content = entry.getValue();
                        Path filePath = resolveSafePath(sessionDir, relativePath);
                        if (filePath == null) {
                            continue;
                        }
                        if (filePath.getParent() != null && !Files.exists(filePath.getParent())) {
                            Files.createDirectories(filePath.getParent());
                        }
                        byte[] contentBytes = content != null ? content.getBytes(StandardCharsets.UTF_8) : new byte[0];
                        Files.write(filePath, contentBytes);
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Auto-sync workspace from database (non-fatal): {}", e.getMessage());
        }
    }

    private Path resolveSafePath(Path sessionDir, String relativePath) {
        if (relativePath == null) return null;
        String clean = relativePath.trim().replace('\\', '/');
        while (clean.startsWith("/")) {
            clean = clean.substring(1);
        }
        while (clean.startsWith("./")) {
            clean = clean.substring(2);
        }
        Path resolved = sessionDir.resolve(clean).normalize();
        if (!resolved.startsWith(sessionDir)) {
            return null;
        }
        return resolved;
    }

    @SuppressWarnings("unchecked")
    private void collectFilesFromTree(Map<String, Object> node, String currentPath, Map<String, String> filesMap) {
        String type = (String) node.get("type");
        String name = (String) node.get("name");
        String nextPath = currentPath;
        if (name != null && !name.isEmpty()) {
            nextPath = currentPath.isEmpty() ? name : currentPath + "/" + name;
        }
        if ("folder".equals(type)) {
            List<Map<String, Object>> children = (List<Map<String, Object>>) node.get("children");
            if (children != null) {
                for (Map<String, Object> child : children) {
                    collectFilesFromTree(child, nextPath, filesMap);
                }
            }
        } else if ("file".equals(type)) {
            String content = (String) node.get("content");
            filesMap.put(nextPath, content != null ? content : "");
        }
    }
}
