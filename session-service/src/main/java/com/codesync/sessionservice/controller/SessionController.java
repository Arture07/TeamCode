package com.codesync.sessionservice.controller;

import com.codesync.sessionservice.dto.FileData;
import com.codesync.sessionservice.dto.UpdateFileRequest;
import com.codesync.sessionservice.model.CodingSession;
import com.codesync.sessionservice.service.SessionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping(path = "/api/sessions", produces = MediaType.APPLICATION_JSON_VALUE)
@CrossOrigin(origins = "*")
public class SessionController {

    private static final Logger logger = LoggerFactory.getLogger(SessionController.class);
    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    // ----------- SESSÕES -----------

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CodingSession> createSession(@Valid @RequestBody CodingSession session) {
        logger.info("Creating session: {}", session.getSessionName());
        CodingSession saved = sessionService.createSession(session);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/{publicId}")
    public ResponseEntity<Map<String, Object>> getSessionByPublicId(@PathVariable String publicId) {
        return sessionService.getSessionByPublicId(publicId)
                .map(ResponseEntity::ok)
                .orElseThrow(() -> new java.util.NoSuchElementException("Sessão não encontrada"));
    }

    // ----------- ARQUIVOS -----------

    @PostMapping(path = "/{publicId}/files", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> createFile(@PathVariable String publicId, @Valid @RequestBody FileData newFile) {
        logger.info("Creating file '{}' in session {}", newFile.getName(), publicId);
        validateFileName(newFile.getName());
        FileData created = sessionService.createFileForSession(publicId, newFile);

        String encoded = URLEncoder.encode(created.getName(), StandardCharsets.UTF_8);
        URI location = URI.create(String.format("/api/sessions/%s/files/%s", publicId, encoded));

        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(location);
        return new ResponseEntity<>(created, headers, HttpStatus.CREATED);
    }

    @PutMapping(path = "/{publicId}/files/content", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateFileContent(@PathVariable String publicId, @Valid @RequestBody UpdateFileRequest request)
            throws JsonProcessingException {
        logger.debug("Updating file content '{}' in session {}", request.getName(), publicId);
        validateFileName(request.getName());
        sessionService.updateFileContent(publicId, request);
        return ResponseEntity.ok().build();
    }

    @PutMapping(path = "/{publicId}/files/{fileName}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateFileByName(
            @PathVariable String publicId,
            @PathVariable String fileName,
            @RequestBody Map<String, Object> body) throws JsonProcessingException {

        logger.debug("Updating file by name '{}' in session {}", fileName, publicId);
        validateFileName(fileName);

        if (body == null || !body.containsKey("content")) {
            return ResponseEntity.badRequest().body("Missing 'content' field in request body.");
        }

        String content = String.valueOf(body.get("content"));

        UpdateFileRequest req = new UpdateFileRequest();
        req.setName(fileName);
        req.setContent(content);

        sessionService.updateFileContent(publicId, req);
        return ResponseEntity.ok().build();
    }

    @PutMapping(path = "/{publicId}/files", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> legacyUpdateFile(
            @PathVariable String publicId,
            @Valid @RequestBody FileData body) throws JsonProcessingException {

        logger.debug("Legacy PUT /files for '{}' in session {}", body.getName(), publicId);
        validateFileName(body.getName());

        UpdateFileRequest req = new UpdateFileRequest();
        req.setName(body.getName());
        req.setContent(body.getContent());

        sessionService.updateFileContent(publicId, req);
        return ResponseEntity.ok().build();
    }

    // ----------- UTIL -----------

    private void validateFileName(String name) {
        if (!StringUtils.hasText(name)) {
            throw new IllegalArgumentException("File name cannot be empty");
        }
        if (name.contains("..") || name.startsWith("/") || name.contains("\\") || name.contains("%2F")) {
            throw new IllegalArgumentException("Invalid file name");
        }
    }
}
