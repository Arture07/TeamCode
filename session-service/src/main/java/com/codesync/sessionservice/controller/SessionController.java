package com.codesync.sessionservice.controller;

import com.codesync.sessionservice.dto.FileData;
import com.codesync.sessionservice.model.CodingSession;
import com.codesync.sessionservice.service.SessionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "*")
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping
    public ResponseEntity<CodingSession> createSession(@RequestBody CodingSession session) {
        CodingSession savedSession = sessionService.createSession(session);
        return new ResponseEntity<>(savedSession, HttpStatus.CREATED);
    }

    @GetMapping("/{publicId}")
    public ResponseEntity<?> getSessionByPublicId(@PathVariable String publicId) {
        try {
            return sessionService.getSessionByPublicId(publicId)
                    .map(sessionData -> new ResponseEntity<>(sessionData, HttpStatus.OK))
                    .orElse(new ResponseEntity<>(HttpStatus.NOT_FOUND));
        } catch (RuntimeException e) {
            return new ResponseEntity<>(e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/{publicId}/files")
    public ResponseEntity<?> createFile(@PathVariable String publicId, @RequestBody FileData newFile) {
        try {
            FileData createdFile = sessionService.createFileForSession(publicId, newFile);
            return new ResponseEntity<>(createdFile, HttpStatus.CREATED);
        } catch (RuntimeException e) {
            if (e.getMessage().contains("já existe")) {
                return new ResponseEntity<>(e.getMessage(), HttpStatus.CONFLICT);
            }
            if (e.getMessage().contains("não encontrada")) {
                return new ResponseEntity<>(e.getMessage(), HttpStatus.NOT_FOUND);
            }
            return new ResponseEntity<>(e.getMessage(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PutMapping("/{publicId}/files")
    public ResponseEntity<?> updateFile(
            @PathVariable String publicId,
            @RequestBody FileData updated) {
        try {
            sessionService.updateFileContent(publicId, updated);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

}
