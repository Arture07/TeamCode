package com.codesync.userservice.service;

import com.codesync.userservice.model.User;
import com.codesync.userservice.repository.UserRepository;
import com.codesync.userservice.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;

@Service
public class OAuthService {

    private static final Logger log = LoggerFactory.getLogger(OAuthService.class);

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${GITHUB_CLIENT_ID:}")
    private String githubClientId;

    @Value("${GITHUB_CLIENT_SECRET:}")
    private String githubClientSecret;

    @Value("${GOOGLE_CLIENT_ID:}")
    private String googleClientId;

    @Value("${GOOGLE_CLIENT_SECRET:}")
    private String googleClientSecret;

    public OAuthService(UserRepository userRepository, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
    }

    /**
     * Handles GitHub OAuth: exchanges code for access_token, fetches profile, creates/finds user, returns JWT.
     */
    public String authenticateWithGitHub(String code) {
        if (githubClientId.isBlank() || githubClientSecret.isBlank()) {
            throw new IllegalStateException("GitHub OAuth não está configurado. Defina GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET.");
        }

        // 1. Exchange code for access_token
        String tokenUrl = "https://github.com/login/oauth/access_token";
        HttpHeaders tokenHeaders = new HttpHeaders();
        tokenHeaders.setContentType(MediaType.APPLICATION_JSON);
        tokenHeaders.setAccept(java.util.List.of(MediaType.APPLICATION_JSON));

        Map<String, String> tokenBody = Map.of(
                "client_id", githubClientId,
                "client_secret", githubClientSecret,
                "code", code
        );

        ResponseEntity<Map> tokenResponse = restTemplate.exchange(
                tokenUrl, HttpMethod.POST,
                new HttpEntity<>(tokenBody, tokenHeaders),
                Map.class
        );

        Map<?, ?> tokenData = tokenResponse.getBody();
        if (tokenData == null || !tokenData.containsKey("access_token")) {
            String errorDesc = tokenData != null ? String.valueOf(tokenData.get("error_description")) : "null response";
            throw new RuntimeException("Falha ao obter access_token do GitHub: " + errorDesc);
        }

        String accessToken = (String) tokenData.get("access_token");

        // 2. Fetch user profile from GitHub API
        HttpHeaders profileHeaders = new HttpHeaders();
        profileHeaders.setBearerAuth(accessToken);
        profileHeaders.setAccept(java.util.List.of(MediaType.APPLICATION_JSON));

        ResponseEntity<Map> profileResponse = restTemplate.exchange(
                "https://api.github.com/user", HttpMethod.GET,
                new HttpEntity<>(profileHeaders),
                Map.class
        );

        Map<?, ?> profile = profileResponse.getBody();
        if (profile == null || profile.get("id") == null) {
            throw new RuntimeException("Falha ao obter perfil do GitHub");
        }

        String providerId = String.valueOf(profile.get("id"));
        String username = (String) profile.get("login");
        String avatarUrl = (String) profile.get("avatar_url");
        // GitHub may not return email publicly — try dedicated endpoint
        String email = (String) profile.get("email");
        if (email == null || email.isBlank()) {
            email = fetchGitHubPrimaryEmail(accessToken);
        }
        if (email == null || email.isBlank()) {
            email = username + "@github.oauth"; // fallback
        }

        // 3. Find or create user
        User user = findOrCreateOAuthUser("GITHUB", providerId, username, email, avatarUrl);

        // 4. Generate JWT
        return jwtUtil.generateTokenForUsername(user.getUsername());
    }

    /**
     * Handles Google OAuth: validates id_token via Google's tokeninfo endpoint, creates/finds user, returns JWT.
     */
    public String authenticateWithGoogle(String idToken) {
        if (googleClientId.isBlank()) {
            throw new IllegalStateException("Google OAuth não está configurado. Defina GOOGLE_CLIENT_ID.");
        }

        // Validate id_token with Google
        String tokenInfoUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken;
        ResponseEntity<Map> response;
        try {
            response = restTemplate.getForEntity(tokenInfoUrl, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Token Google inválido: " + e.getMessage());
        }

        Map<?, ?> payload = response.getBody();
        if (payload == null || payload.get("sub") == null) {
            throw new RuntimeException("Token Google inválido ou expirado");
        }

        // Verify audience matches our client
        String aud = (String) payload.get("aud");
        if (!googleClientId.equals(aud)) {
            throw new RuntimeException("Token Google com audience inválido");
        }

        String providerId = (String) payload.get("sub");
        String email = (String) payload.get("email");
        String name = (String) payload.get("name");
        String avatarUrl = (String) payload.get("picture");

        // Use email prefix as username if name is null
        String username = (name != null && !name.isBlank()) ? name.replaceAll("\\s+", "_") : email.split("@")[0];

        // Find or create user
        User user = findOrCreateOAuthUser("GOOGLE", providerId, username, email, avatarUrl);

        return jwtUtil.generateTokenForUsername(user.getUsername());
    }

    private User findOrCreateOAuthUser(String provider, String providerId, String username, String email, String avatarUrl) {
        // First try: find by provider + providerId
        Optional<User> existing = userRepository.findByProviderAndProviderId(provider, providerId);
        if (existing.isPresent()) {
            User user = existing.get();
            // Update avatar if changed
            if (avatarUrl != null && !avatarUrl.equals(user.getAvatarUrl())) {
                user.setAvatarUrl(avatarUrl);
                userRepository.save(user);
            }
            return user;
        }

        // Second try: find by email (link accounts)
        Optional<User> byEmail = userRepository.findByEmail(email);
        if (byEmail.isPresent()) {
            User user = byEmail.get();
            // Link OAuth to existing account
            user.setProvider(provider);
            user.setProviderId(providerId);
            if (avatarUrl != null) user.setAvatarUrl(avatarUrl);
            userRepository.save(user);
            log.info("OAuth account linked: {} ({}) → existing user '{}'", provider, providerId, user.getUsername());
            return user;
        }

        // Ensure username is unique
        String finalUsername = username;
        int suffix = 1;
        while (userRepository.findByUsername(finalUsername).isPresent()) {
            finalUsername = username + "_" + suffix++;
        }

        // Create new OAuth user (no password)
        User newUser = new User();
        newUser.setUsername(finalUsername);
        newUser.setEmail(email);
        newUser.setPassword(null); // OAuth users don't have a local password
        newUser.setProvider(provider);
        newUser.setProviderId(providerId);
        newUser.setAvatarUrl(avatarUrl);

        userRepository.save(newUser);
        log.info("New OAuth user created: {} ({}) as '{}'", provider, providerId, finalUsername);
        return newUser;
    }

    /**
     * Fetches the primary email from GitHub's /user/emails endpoint.
     */
    private String fetchGitHubPrimaryEmail(String accessToken) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(java.util.List.of(MediaType.APPLICATION_JSON));

            ResponseEntity<java.util.List> response = restTemplate.exchange(
                    "https://api.github.com/user/emails", HttpMethod.GET,
                    new HttpEntity<>(headers),
                    java.util.List.class
            );

            java.util.List<?> emails = response.getBody();
            if (emails != null) {
                for (Object entry : emails) {
                    if (entry instanceof Map) {
                        Map<?, ?> emailEntry = (Map<?, ?>) entry;
                        if (Boolean.TRUE.equals(emailEntry.get("primary"))) {
                            return (String) emailEntry.get("email");
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Não foi possível obter email do GitHub: {}", e.getMessage());
        }
        return null;
    }
}
