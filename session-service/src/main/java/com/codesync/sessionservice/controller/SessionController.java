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

    /**
     * Cria nova sessão
     */
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
                .orElseGet(() -> ResponseEntity
                        .status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Sessão não encontrada")));
    }


    @PostMapping(path = "/{publicId}/files", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> createFile(@PathVariable String publicId, @Valid @RequestBody FileData newFile) {
        logger.info("Creating file '{}' in session {}", newFile.getName(), publicId);
        validateFileName(newFile.getName());
        FileData created = sessionService.createFileForSession(publicId, newFile);
        // Location para novo recurso (endpoint per-file recomendado)
        String encoded = URLEncoder.encode(created.getName(), StandardCharsets.UTF_8);
        URI location = URI.create(String.format("/api/sessions/%s/files/%s", publicId, encoded));
        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(location);
        return new ResponseEntity<>(created, headers, HttpStatus.CREATED);
    }

    @PutMapping(path = "/{publicId}/files/meta", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateFileMeta(
            @PathVariable String publicId,
            @Valid @RequestBody FileData updated) {
        try {
            // chama serviço (verifique que o serviço tem essa assinatura)
            sessionService.updateFileContent(publicId, updated);
            return ResponseEntity.ok().build(); // 200 sem body
        } catch (RuntimeException e) {
            if (e.getMessage() != null && e.getMessage().contains("não encontrada")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Erro interno no servidor.");
        }
    }

    @PutMapping(path = "/{publicId}/files/content", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateFileContent(@PathVariable String publicId, @Valid @RequestBody UpdateFileRequest request)
            throws JsonProcessingException {
        logger.debug("Updating file content (content endpoint) '{}' in session {}", request.getName(), publicId);
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
            logger.warn("Bad request: missing 'content' field for file {} in session {}", fileName, publicId);
            return ResponseEntity.badRequest().body("Missing 'content' field in request body.");
        }

        String content = String.valueOf(body.get("content"));

        UpdateFileRequest req = new UpdateFileRequest();
        req.setName(fileName);
        req.setContent(content);

        sessionService.updateFileContent(publicId, req);
        return ResponseEntity.ok().build();
    }

    // ---------- util ----------
    private void validateFileName(String name) {
        if (!StringUtils.hasText(name)) {
            throw new IllegalArgumentException("File name cannot be empty");
        }
        // reject path traversal / absolute paths
        if (name.contains("..") || name.startsWith("/") || name.contains("\\") || name.contains("%2F")) {
            throw new IllegalArgumentException("Invalid file name");
        }
        // optionally more validations: length, allowed chars, etc.
    }
}
