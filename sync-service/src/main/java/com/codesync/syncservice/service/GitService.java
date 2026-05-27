package com.codesync.syncservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class GitService {

    private static final Logger log = LoggerFactory.getLogger(GitService.class);

    // Allow-list: only these git subcommands are permitted
    private static final Set<String> ALLOWED_COMMANDS = Set.of(
            "init", "status", "diff", "add", "commit", "log", "config"
    );

    // Validate sessionId to prevent path traversal
    private static final Pattern SESSION_ID_PATTERN = Pattern.compile("^[a-zA-Z0-9_\\-]+$");

    private Path getSessionDir(String sessionId) {
        if (sessionId == null || !SESSION_ID_PATTERN.matcher(sessionId).matches()) {
            throw new IllegalArgumentException("ID de sessão inválido");
        }
        Path sessionDir = Paths.get("/tmp", sessionId).toAbsolutePath().normalize();
        // Verify it's still under /tmp
        if (!sessionDir.startsWith("/tmp")) {
            throw new SecurityException("Path traversal detectado");
        }
        return sessionDir;
    }

    /**
     * Initialize a git repository in the session directory.
     */
    public Map<String, Object> initRepo(String sessionId, String username) {
        Path dir = getSessionDir(sessionId);
        try {
            if (!Files.exists(dir)) {
                Files.createDirectories(dir);
            }
        } catch (Exception e) {
            return Map.of("success", false, "error", "Não foi possível criar diretório: " + e.getMessage());
        }

        // Check if already initialized
        if (Files.exists(dir.resolve(".git"))) {
            return Map.of("success", true, "message", "Repositório já inicializado", "initialized", true);
        }

        String initResult = runGitCommand(dir, "init");
        // Configure user identity for commits
        runGitCommand(dir, "config", "user.name", username != null ? username : "TeamCode User");
        runGitCommand(dir, "config", "user.email", "teamcode@local");

        return Map.of("success", true, "message", initResult, "initialized", true);
    }

    /**
     * Get git status (porcelain format for easy parsing).
     */
    public Map<String, Object> getStatus(String sessionId) {
        Path dir = getSessionDir(sessionId);

        if (!Files.exists(dir.resolve(".git"))) {
            return Map.of("initialized", false, "files", List.of());
        }

        String output = runGitCommand(dir, "status", "--porcelain");
        List<Map<String, String>> files = new ArrayList<>();

        for (String line : output.split("\n")) {
            if (line.trim().isEmpty()) continue;
            String status = line.length() >= 2 ? line.substring(0, 2).trim() : "?";
            String filePath = line.length() > 3 ? line.substring(3).trim() : line.trim();
            String statusLabel = switch (status) {
                case "M" -> "modified";
                case "A" -> "added";
                case "D" -> "deleted";
                case "R" -> "renamed";
                case "??" -> "untracked";
                case "MM" -> "modified";
                case "AM" -> "added";
                default -> status;
            };
            files.add(Map.of("path", filePath, "status", statusLabel, "statusCode", status));
        }

        return Map.of("initialized", true, "files", files);
    }

    /**
     * Get diff output for all files or a specific file.
     */
    public Map<String, Object> getDiff(String sessionId, String filePath, boolean staged) {
        Path dir = getSessionDir(sessionId);

        if (!Files.exists(dir.resolve(".git"))) {
            return Map.of("initialized", false, "diff", "");
        }

        List<String> args = new ArrayList<>();
        args.add("diff");
        if (staged) {
            args.add("--cached");
        }
        if (filePath != null && !filePath.isBlank()) {
            // Validate filePath: must not contain path traversal
            String sanitized = filePath.replace("\\", "/");
            if (sanitized.contains("..")) {
                throw new SecurityException("Path traversal detectado no filePath");
            }
            args.add("--");
            args.add(sanitized);
        }

        String output = runGitCommand(dir, args.toArray(new String[0]));
        return Map.of("initialized", true, "diff", output);
    }

    /**
     * Stage files for commit.
     */
    public Map<String, Object> addFiles(String sessionId, List<String> files) {
        Path dir = getSessionDir(sessionId);

        if (!Files.exists(dir.resolve(".git"))) {
            return Map.of("success", false, "error", "Repositório não inicializado");
        }

        if (files == null || files.isEmpty()) {
            // Stage all
            String output = runGitCommand(dir, "add", "-A");
            return Map.of("success", true, "message", "Todos os ficheiros staged", "output", output);
        }

        // Validate and stage individual files
        for (String file : files) {
            String sanitized = file.replace("\\", "/");
            if (sanitized.contains("..")) {
                return Map.of("success", false, "error", "Path traversal detectado: " + file);
            }
            runGitCommand(dir, "add", "--", sanitized);
        }

        return Map.of("success", true, "message", files.size() + " ficheiro(s) staged");
    }

    /**
     * Create a commit with the given message.
     */
    public Map<String, Object> commit(String sessionId, String message, String username) {
        Path dir = getSessionDir(sessionId);

        if (!Files.exists(dir.resolve(".git"))) {
            return Map.of("success", false, "error", "Repositório não inicializado");
        }

        if (message == null || message.isBlank()) {
            return Map.of("success", false, "error", "Mensagem de commit em falta");
        }

        // Sanitize commit message (prevent command injection via --)
        String safeMessage = message.replaceAll("[\\r\\n]", " ").trim();
        if (safeMessage.length() > 500) {
            safeMessage = safeMessage.substring(0, 500);
        }

        // Update author config before commit
        if (username != null && !username.isBlank()) {
            runGitCommand(dir, "config", "user.name", username);
        }

        String output = runGitCommand(dir, "commit", "-m", safeMessage);
        boolean success = !output.contains("nothing to commit");

        return Map.of("success", success, "message", output);
    }

    /**
     * Get commit log.
     */
    public Map<String, Object> getLog(String sessionId, int limit) {
        Path dir = getSessionDir(sessionId);

        if (!Files.exists(dir.resolve(".git"))) {
            return Map.of("initialized", false, "commits", List.of());
        }

        // Clamp limit
        int safeLimit = Math.min(Math.max(limit, 1), 100);

        String output = runGitCommand(dir, "log",
                "--pretty=format:%H|%h|%an|%ae|%ar|%s",
                "-n", String.valueOf(safeLimit));

        List<Map<String, String>> commits = new ArrayList<>();
        for (String line : output.split("\n")) {
            if (line.trim().isEmpty()) continue;
            String[] parts = line.split("\\|", 6);
            if (parts.length >= 6) {
                commits.add(Map.of(
                        "hash", parts[0],
                        "shortHash", parts[1],
                        "author", parts[2],
                        "email", parts[3],
                        "relativeDate", parts[4],
                        "message", parts[5]
                ));
            }
        }

        return Map.of("initialized", true, "commits", commits);
    }

    /**
     * Executes a git command safely in the session directory.
     * Only allow-listed subcommands are permitted.
     */
    private String runGitCommand(Path workDir, String... args) {
        if (args.length == 0) {
            throw new IllegalArgumentException("Git command args em falta");
        }

        // Verify subcommand is in allow-list
        String subCommand = args[0];
        if (!ALLOWED_COMMANDS.contains(subCommand)) {
            throw new SecurityException("Git subcommand não permitido: " + subCommand);
        }

        List<String> command = new ArrayList<>();
        command.add("git");
        Collections.addAll(command, args);

        try {
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.directory(workDir.toFile());
            pb.redirectErrorStream(true);
            pb.environment().put("GIT_TERMINAL_PROMPT", "0");
            pb.environment().put("LC_ALL", "C.UTF-8");

            Process process = pb.start();

            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }

            boolean finished = process.waitFor(15, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return "Timeout: comando git demorou muito";
            }

            return output.toString().trim();
        } catch (Exception e) {
            log.error("Erro ao executar git {}: {}", subCommand, e.getMessage());
            return "Erro: " + e.getMessage();
        }
    }
}
