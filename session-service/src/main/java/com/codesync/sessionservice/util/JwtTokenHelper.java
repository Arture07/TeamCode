package com.codesync.sessionservice.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Component
public class JwtTokenHelper {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenHelper.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    public static class UserTokenInfo {
        private final String username;
        private final String role;
        private final boolean valid;

        public UserTokenInfo(String username, String role, boolean valid) {
            this.username = username;
            this.role = role;
            this.valid = valid;
        }

        public String getUsername() {
            return username;
        }

        public String getRole() {
            return role;
        }

        public boolean isValid() {
            return valid;
        }

        public boolean isAdmin() {
            return "ROLE_SUPER_ADMIN".equalsIgnoreCase(role) || "ROLE_ADMIN".equalsIgnoreCase(role);
        }
    }

    public UserTokenInfo parseToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return new UserTokenInfo(null, null, false);
        }

        String token = authHeader.substring(7).trim();
        String[] parts = token.split("\\.");
        if (parts.length < 2) {
            return new UserTokenInfo(null, null, false);
        }

        try {
            byte[] decoded = Base64.getUrlDecoder().decode(parts[1]);
            String payloadJson = new String(decoded, StandardCharsets.UTF_8);
            JsonNode node = objectMapper.readTree(payloadJson);

            // Check expiration if present
            if (node.has("exp")) {
                long exp = node.get("exp").asLong();
                long nowSeconds = System.currentTimeMillis() / 1000;
                if (exp < nowSeconds) {
                    log.debug("Token expired: {} < {}", exp, nowSeconds);
                    return new UserTokenInfo(null, null, false);
                }
            }

            String username = node.has("sub") ? node.get("sub").asText() : (node.has("username") ? node.get("username").asText() : null);
            String role = node.has("role") ? node.get("role").asText() : null;

            if (username != null && !username.isBlank()) {
                return new UserTokenInfo(username, role, true);
            }
        } catch (Exception e) {
            log.debug("Failed to parse JWT token: {}", e.getMessage());
        }

        return new UserTokenInfo(null, null, false);
    }
}
