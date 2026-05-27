package com.codesync.syncservice.controller;

import com.codesync.syncservice.service.GitService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/git")
@CrossOrigin(origins = "*") // CORS handled by nginx in production
public class GitController {

    private final GitService gitService;

    public GitController(GitService gitService) {
        this.gitService = gitService;
    }

    /**
     * Initialize a git repo in the session directory.
     * POST /api/git/{sessionId}/init
     * Body (optional): { "username": "..." }
     */
    @PostMapping("/{sessionId}/init")
    public ResponseEntity<Map<String, Object>> initRepo(
            @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, String> body) {
        String username = (body != null) ? body.get("username") : null;
        try {
            return ResponseEntity.ok(gitService.initRepo(sessionId, username));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Get git status for the session repo.
     * GET /api/git/{sessionId}/status
     */
    @GetMapping("/{sessionId}/status")
    public ResponseEntity<Map<String, Object>> getStatus(@PathVariable String sessionId) {
        try {
            return ResponseEntity.ok(gitService.getStatus(sessionId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("initialized", false, "error", e.getMessage()));
        }
    }

    /**
     * Get diff for the session repo.
     * GET /api/git/{sessionId}/diff?file=path&staged=true
     */
    @GetMapping("/{sessionId}/diff")
    public ResponseEntity<Map<String, Object>> getDiff(
            @PathVariable String sessionId,
            @RequestParam(required = false) String file,
            @RequestParam(defaultValue = "false") boolean staged) {
        try {
            return ResponseEntity.ok(gitService.getDiff(sessionId, file, staged));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("initialized", false, "error", e.getMessage()));
        }
    }

    /**
     * Stage files for commit.
     * POST /api/git/{sessionId}/add
     * Body: { "files": ["path1", "path2"] } or {} for stage all
     */
    @PostMapping("/{sessionId}/add")
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> addFiles(
            @PathVariable String sessionId,
            @RequestBody(required = false) Map<String, Object> body) {
        List<String> files = null;
        if (body != null && body.containsKey("files")) {
            Object filesObj = body.get("files");
            if (filesObj instanceof List) {
                files = (List<String>) filesObj;
            }
        }
        try {
            return ResponseEntity.ok(gitService.addFiles(sessionId, files));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Create a commit.
     * POST /api/git/{sessionId}/commit
     * Body: { "message": "commit message", "username": "optional" }
     */
    @PostMapping("/{sessionId}/commit")
    public ResponseEntity<Map<String, Object>> commit(
            @PathVariable String sessionId,
            @RequestBody Map<String, String> body) {
        String message = body.get("message");
        String username = body.get("username");
        try {
            return ResponseEntity.ok(gitService.commit(sessionId, message, username));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /**
     * Get commit log.
     * GET /api/git/{sessionId}/log?limit=20
     */
    @GetMapping("/{sessionId}/log")
    public ResponseEntity<Map<String, Object>> getLog(
            @PathVariable String sessionId,
            @RequestParam(defaultValue = "20") int limit) {
        try {
            return ResponseEntity.ok(gitService.getLog(sessionId, limit));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("initialized", false, "error", e.getMessage()));
        }
    }
}
