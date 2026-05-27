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

    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public GitService(com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

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
     * Sincroniza recursivamente o workspace físico em disco (/tmp/{sessionId})
     * com a árvore de ficheiros armazenada no banco de dados do session-service.
     */
    private void syncWorkspaceFromDatabase(String sessionId) {
        try {
            Path sessionDir = getSessionDir(sessionId);
            if (!Files.exists(sessionDir)) {
                Files.createDirectories(sessionDir);
            }

            // Consultar árvore de ficheiros do session-service (serviço interno na mesma rede docker)
            String url = "http://session-service:8080/api/tree/" + sessionId;
            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(5))
                    .GET()
                    .build();

            java.net.http.HttpResponse<String> response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Sincronização abortada: session-service retornou status {}", response.statusCode());
                return;
            }

            Map<String, Object> body = objectMapper.readValue(response.body(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
            Map<String, Object> tree = (Map<String, Object>) body.get("tree");
            if (tree == null) {
                log.warn("Sincronização abortada: árvore de ficheiros vazia");
                return;
            }

            // Mapeia recursivamente todos os arquivos presentes no banco de dados
            Map<String, String> dbFiles = new HashMap<>();
            collectFilesFromTree(tree, "", dbFiles);

            // 1. Gravar/atualizar em disco todos os ficheiros da base de dados
            for (Map.Entry<String, String> entry : dbFiles.entrySet()) {
                String relativePath = entry.getKey();
                String content = entry.getValue();

                Path filePath = sessionDir.resolve(relativePath).normalize();
                if (!filePath.startsWith(sessionDir)) {
                    continue; // Evitar Path Traversal
                }

                // Garantir criação dos diretórios pais
                if (filePath.getParent() != null && !Files.exists(filePath.getParent())) {
                    Files.createDirectories(filePath.getParent());
                }

                byte[] contentBytes = content != null ? content.getBytes(StandardCharsets.UTF_8) : new byte[0];
                boolean shouldWrite = true;

                if (Files.exists(filePath)) {
                    byte[] existingBytes = Files.readAllBytes(filePath);
                    if (Arrays.equals(existingBytes, contentBytes)) {
                        shouldWrite = false; // Não sobrescrever se o conteúdo for idêntico
                    }
                }

                if (shouldWrite) {
                    Files.write(filePath, contentBytes);
                }
            }

            // 2. Apagar ficheiros locais órfãos (que existem no disco mas não no banco), ignorando o Git
            deleteOrphanedFiles(sessionDir, sessionDir, dbFiles.keySet());

        } catch (Exception e) {
            log.error("Erro ao sincronizar repositório Git local com banco de dados para a sessão {}: {}", sessionId, e.getMessage());
        }
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

    private void deleteOrphanedFiles(Path baseDir, Path currentDir, Set<String> dbFilesRelativePaths) {
        try (java.util.stream.Stream<Path> stream = Files.list(currentDir)) {
            List<Path> paths = stream.collect(Collectors.toList());
            for (Path p : paths) {
                if (Files.isDirectory(p)) {
                    if (p.getFileName().toString().equals(".git")) {
                        continue; // Ignorar diretório administrativo do Git
                    }
                    deleteOrphanedFiles(baseDir, p, dbFilesRelativePaths);
                    // Apagar diretórios vazios
                    try (java.util.stream.Stream<Path> emptyCheck = Files.list(p)) {
                        if (emptyCheck.findAny().isEmpty()) {
                            Files.delete(p);
                        }
                    }
                } else {
                    String relativePath = baseDir.relativize(p).toString().replace("\\", "/");
                    if (!dbFilesRelativePaths.contains(relativePath)) {
                        Files.delete(p);
                        log.info("Ficheiro órfão local deletado em sincronia com o banco: {}", relativePath);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Erro ao apagar arquivos órfãos em {}: {}", currentDir, e.getMessage());
        }
    }

    /**
     * Initialize a git repository in the session directory.
     */
    public Map<String, Object> initRepo(String sessionId, String username) {
        syncWorkspaceFromDatabase(sessionId);
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
        syncWorkspaceFromDatabase(sessionId);
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
        syncWorkspaceFromDatabase(sessionId);
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
        syncWorkspaceFromDatabase(sessionId);
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
        syncWorkspaceFromDatabase(sessionId);
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
