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
            "init", "status", "diff", "add", "commit", "log", "config",
            "clone", "pull", "push", "checkout", "branch", "remote"
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
    @SuppressWarnings("unchecked")
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
     * Sincroniza recursivamente o workspace físico em disco com o banco do session-service.
     */
    private void syncWorkspaceToDatabase(String sessionId) {
        try {
            Path sessionDir = getSessionDir(sessionId);
            if (!Files.exists(sessionDir)) {
                log.warn("Workspace para sessão {} não existe em disco", sessionId);
                return;
            }

            // Constrói recursivamente a árvore (TreeNode root) a partir do disco, ignorando .git
            com.codesync.syncservice.dto.TreeNode rootNode = buildTreeFromDisk(sessionDir, "root");

            // Envia PUT request para o session-service
            String url = "http://session-service:8080/api/tree/" + sessionId;
            String jsonBody = objectMapper.writeValueAsString(rootNode);

            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .timeout(java.time.Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .PUT(java.net.http.HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                    .build();

            java.net.http.HttpResponse<String> response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.error("Erro ao sincronizar workspace em disco para o banco. Session service status: {}", response.statusCode());
            } else {
                log.info("Sincronização reversa (disco -> banco) concluída com sucesso para a sessão {}", sessionId);
            }
        } catch (Exception e) {
            log.error("Erro catastrófico em syncWorkspaceToDatabase para sessão {}: {}", sessionId, e.getMessage(), e);
        }
    }

    private com.codesync.syncservice.dto.TreeNode buildTreeFromDisk(Path diskPath, String name) {
        if (Files.isDirectory(diskPath)) {
            com.codesync.syncservice.dto.TreeNode node = com.codesync.syncservice.dto.TreeNode.folder(name);
            try (java.util.stream.Stream<Path> list = Files.list(diskPath)) {
                List<Path> paths = list.collect(Collectors.toList());
                for (Path p : paths) {
                    String childName = p.getFileName().toString();
                    if (".git".equals(childName)) {
                        continue; // Ignorar pasta administrativa .git
                    }
                    com.codesync.syncservice.dto.TreeNode childNode = buildTreeFromDisk(p, childName);
                    if (childNode != null) {
                        node.getChildren().add(childNode);
                    }
                }
            } catch (Exception e) {
                log.error("Erro ao listar diretório {}: {}", diskPath, e.getMessage());
            }
            return node;
        } else {
            try {
                String content = Files.readString(diskPath, StandardCharsets.UTF_8);
                return com.codesync.syncservice.dto.TreeNode.file(name, content);
            } catch (Exception e) {
                log.warn("Erro ao ler ficheiro {}, assumindo vazio: {}", diskPath, e.getMessage());
                return com.codesync.syncservice.dto.TreeNode.file(name, "");
            }
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
     * Limpa a pasta da sessão e efetua um git clone do remote especificado.
     */
    public Map<String, Object> cloneRepo(String sessionId, String cloneUrl, String token) {
        if (cloneUrl == null || cloneUrl.isBlank()) {
            return Map.of("success", false, "error", "URL de clone vazia");
        }

        Path dir = getSessionDir(sessionId);
        try {
            if (Files.exists(dir)) {
                // Limpar todos os arquivos da pasta para poder clonar sem erros
                clearDirectory(dir);
            } else {
                Files.createDirectories(dir);
            }
        } catch (Exception e) {
            return Map.of("success", false, "error", "Não foi possível preparar pasta: " + e.getMessage());
        }

        // Injeta o token se disponível
        String authenticatedUrl = injectTokenIntoUrl(cloneUrl, token);

        // Clona na pasta física
        String cloneResult = runGitCommand(dir, "clone", authenticatedUrl, ".");
        if (cloneResult.contains("Fatal") || cloneResult.contains("fatal:") || cloneResult.contains("Erro")) {
            return Map.of("success", false, "error", "Falha ao clonar: " + cloneResult);
        }

        // Configura a identidade local do git
        runGitCommand(dir, "config", "user.name", "TeamCode User");
        runGitCommand(dir, "config", "user.email", "teamcode@local");

        // Sincroniza a árvore recém-clonada para o banco de dados
        syncWorkspaceToDatabase(sessionId);

        return Map.of("success", true, "message", "Repositório clonado com sucesso", "treeUpdated", true);
    }

    private void clearDirectory(Path path) {
        try (java.util.stream.Stream<Path> stream = Files.walk(path)) {
            stream.sorted(Comparator.reverseOrder())
                  .filter(p -> !p.equals(path))
                  .forEach(p -> {
                      try {
                          Files.delete(p);
                      } catch (Exception e) {
                          // ignore
                      }
                  });
        } catch (Exception e) {
            log.error("Erro ao limpar pasta: {}", e.getMessage());
        }
    }

    private String injectTokenIntoUrl(String url, String token) {
        if (token == null || token.isBlank()) return url;
        String trimmedToken = token.trim();
        if (url.startsWith("https://")) {
            if (url.contains("github.com")) {
                return "https://x-access-token:" + trimmedToken + "@" + url.substring(8);
            } else if (url.contains("gitlab.com")) {
                return "https://oauth2:" + trimmedToken + "@" + url.substring(8);
            }
            return "https://" + trimmedToken + "@" + url.substring(8);
        } else if (url.startsWith("http://")) {
            return "http://" + trimmedToken + "@" + url.substring(7);
        }
        return url;
    }

    /**
     * Executa um git pull com token temporário e sincroniza os arquivos para o banco.
     */
    public Map<String, Object> pullRepo(String sessionId, String token) {
        Path dir = getSessionDir(sessionId);
        if (!Files.exists(dir.resolve(".git"))) {
            return Map.of("success", false, "error", "Repositório não inicializado");
        }

        // Ler a URL do remote atual
        String originalRemoteUrl = runGitCommand(dir, "remote", "get-url", "origin").trim();
        boolean hasToken = (token != null && !token.isBlank());
        
        if (hasToken && !originalRemoteUrl.startsWith("Erro")) {
            // Setar URL temporária com o token
            String tempRemoteUrl = injectTokenIntoUrl(originalRemoteUrl, token);
            runGitCommand(dir, "remote", "set-url", "origin", tempRemoteUrl);
        }

        String pullResult = runGitCommand(dir, "pull");

        if (hasToken && !originalRemoteUrl.startsWith("Erro")) {
            // Restaurar URL original limpa
            runGitCommand(dir, "remote", "set-url", "origin", originalRemoteUrl);
        }

        if (pullResult.contains("fatal:") || pullResult.contains("Fatal") || pullResult.contains("Erro")) {
            return Map.of("success", false, "error", "Falha ao sincronizar (Pull): " + pullResult);
        }

        // Sincroniza a nova árvore com o banco
        syncWorkspaceToDatabase(sessionId);

        return Map.of("success", true, "output", pullResult, "treeUpdated", true);
    }

    /**
     * Executa um git push com token temporário.
     */
    public Map<String, Object> pushRepo(String sessionId, String branch, String token) {
        Path dir = getSessionDir(sessionId);
        if (!Files.exists(dir.resolve(".git"))) {
            return Map.of("success", false, "error", "Repositório não inicializado");
        }

        String targetBranch = (branch != null && !branch.isBlank()) ? branch.trim() : "main";

        // Ler a URL do remote atual
        String originalRemoteUrl = runGitCommand(dir, "remote", "get-url", "origin").trim();
        boolean hasToken = (token != null && !token.isBlank());

        if (hasToken && !originalRemoteUrl.startsWith("Erro")) {
            // Setar URL temporária com o token
            String tempRemoteUrl = injectTokenIntoUrl(originalRemoteUrl, token);
            runGitCommand(dir, "remote", "set-url", "origin", tempRemoteUrl);
        }

        String pushResult = runGitCommand(dir, "push", "origin", targetBranch);

        if (hasToken && !originalRemoteUrl.startsWith("Erro")) {
            // Restaurar URL original limpa
            runGitCommand(dir, "remote", "set-url", "origin", originalRemoteUrl);
        }

        if (pushResult.contains("fatal:") || pushResult.contains("Fatal") || pushResult.contains("Erro")) {
            return Map.of("success", false, "error", "Falha ao enviar (Push): " + pushResult);
        }

        return Map.of("success", true, "output", pushResult);
    }

    /**
     * Alterna ou cria branches locais no Git, sincronizando a mudança com o banco.
     */
    public Map<String, Object> checkoutBranch(String sessionId, String branchName, boolean create) {
        Path dir = getSessionDir(sessionId);
        if (!Files.exists(dir.resolve(".git"))) {
            return Map.of("success", false, "error", "Repositório não inicializado");
        }

        if (branchName == null || branchName.isBlank()) {
            return Map.of("success", false, "error", "Nome da branch vazio");
        }

        String checkoutResult;
        if (create) {
            checkoutResult = runGitCommand(dir, "checkout", "-b", branchName.trim());
        } else {
            checkoutResult = runGitCommand(dir, "checkout", branchName.trim());
        }

        if (checkoutResult.contains("fatal:") || checkoutResult.contains("Fatal") || checkoutResult.contains("Erro")) {
            return Map.of("success", false, "error", "Falha no checkout: " + checkoutResult);
        }

        // Sincroniza a nova árvore com o banco
        syncWorkspaceToDatabase(sessionId);

        return Map.of("success", true, "message", "Checkout concluído: " + checkoutResult, "treeUpdated", true);
    }

    /**
     * Retorna a branch atual e a lista de todas as branches disponíveis.
     */
    public Map<String, Object> listBranches(String sessionId) {
        Path dir = getSessionDir(sessionId);
        if (!Files.exists(dir.resolve(".git"))) {
            return Map.of("initialized", false, "branches", List.of(), "currentBranch", "");
        }

        // Obter branch atual
        String currentOutput = runGitCommand(dir, "branch", "--show-current").trim();
        if (currentOutput.startsWith("Erro")) {
            currentOutput = "main"; // fallback
        }

        // Obter todas as branches
        String output = runGitCommand(dir, "branch", "-a").trim();
        List<String> branches = new ArrayList<>();
        
        for (String line : output.split("\n")) {
            if (line.trim().isEmpty()) continue;
            // Remover o asterisco indicador de branch ativo e espaços
            String clean = line.replace("*", "").trim();
            if (!branches.contains(clean)) {
                branches.add(clean);
            }
        }

        if (branches.isEmpty()) {
            branches.add(currentOutput);
        }

        return Map.of(
                "initialized", true,
                "currentBranch", currentOutput,
                "branches", branches
        );
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
