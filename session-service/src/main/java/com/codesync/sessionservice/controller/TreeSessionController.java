package com.codesync.sessionservice.controller;

import com.codesync.sessionservice.dto.TreeNode;
import com.codesync.sessionservice.service.TreeSessionService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping(path = "/api/tree", produces = MediaType.APPLICATION_JSON_VALUE)
@CrossOrigin(origins = "*")
public class TreeSessionController {

    private final TreeSessionService treeService;

    public TreeSessionController(TreeSessionService treeService) {
        this.treeService = treeService;
    }

    @GetMapping("/{publicId}")
    public ResponseEntity<?> getTree(@PathVariable String publicId) throws Exception {
        TreeNode root = treeService.getTree(publicId);
        return ResponseEntity.ok(Map.of("publicId", publicId, "tree", root));
    }

    @PostMapping(path = "/{publicId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@PathVariable String publicId, @RequestBody Map<String,Object> body) throws Exception {
        String path = (String) body.get("path");
        String type = (String) body.getOrDefault("type","file");
        String content = (String) body.getOrDefault("content", "");
        try {
            treeService.createNode(publicId, path, type, content);
            return ResponseEntity.status(201).build();
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    @PutMapping(path = "/{publicId}/content", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateContent(@PathVariable String publicId, @RequestBody Map<String,Object> body) throws Exception {
        String path = (String) body.get("path");
        String content = (String) body.get("content");
        try {
            treeService.updateFileContent(publicId, path, content);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    @DeleteMapping(path = "/{publicId}")
    public ResponseEntity<?> delete(@PathVariable String publicId, @RequestParam String path) throws Exception {
        try {
            treeService.deleteNode(publicId, path);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping(path = "/{publicId}/move", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> move(@PathVariable String publicId, @RequestBody Map<String,String> body) throws Exception {
        String from = body.get("from");
        String to = body.get("to");
        try {
            treeService.moveNode(publicId, from, to);
            return ResponseEntity.ok().build();
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping(path = "/{publicId}/rename", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> rename(@PathVariable String publicId, @RequestBody Map<String,String> body) throws Exception {
        String path = body.get("path");
        String newName = body.get("newName");
        try {
            treeService.renameNode(publicId, path, newName);
            return ResponseEntity.ok().build();
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }

    @PostMapping(path = "/{publicId}/duplicate", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> duplicate(@PathVariable String publicId, @RequestBody Map<String,String> body) throws Exception {
        String path = body.get("path");
        String targetName = body.get("targetName");
        try {
            String newPath = treeService.duplicateNode(publicId, path, targetName);
            return ResponseEntity.ok(Map.of("newPath", newPath));
        } catch (IllegalStateException | IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (NoSuchElementException ex) {
            return ResponseEntity.status(404).body(Map.of("error", ex.getMessage()));
        }
    }
}

