package com.crewcode.userservice.controller;

import com.crewcode.userservice.service.OAuthService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users/oauth")
public class OAuthController {

    private static final Logger log = LoggerFactory.getLogger(OAuthController.class);
    private final OAuthService oAuthService;

    public OAuthController(OAuthService oAuthService) {
        this.oAuthService = oAuthService;
    }

    /**
     * GitHub OAuth callback: receives authorization code, returns JWT.
     * Frontend sends: { "code": "github_auth_code" }
     */
    @PostMapping("/github")
    public ResponseEntity<?> githubLogin(@RequestBody Map<String, String> payload) {
        String code = payload.get("code");
        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Código de autorização GitHub em falta"));
        }
        try {
            String jwt = oAuthService.authenticateWithGitHub(code);
            return ResponseEntity.ok(Map.of("token", jwt));
        } catch (IllegalStateException e) {
            // OAuth not configured
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("GitHub OAuth failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Falha na autenticação com GitHub"));
        }
    }

    /**
     * Google OAuth callback: receives id_token, returns JWT.
     * Frontend sends: { "credential": "google_id_token" }
     */
    @PostMapping("/google")
    public ResponseEntity<?> googleLogin(@RequestBody Map<String, String> payload) {
        String idToken = payload.get("credential");
        if (idToken == null || idToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Token Google em falta"));
        }
        try {
            String jwt = oAuthService.authenticateWithGoogle(idToken);
            return ResponseEntity.ok(Map.of("token", jwt));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Google OAuth failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Falha na autenticação com Google"));
        }
    }

    /**
     * Get OAuth client IDs config.
     * GET /api/users/oauth/config
     */
    @GetMapping("/config")
    public ResponseEntity<Map<String, String>> getConfig() {
        return ResponseEntity.ok(Map.of(
                "githubClientId", oAuthService.getGithubClientId(),
                "googleClientId", oAuthService.getGoogleClientId()
        ));
    }
}
