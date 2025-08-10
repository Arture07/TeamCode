package com.codesync.userservice.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import java.util.Base64;

@Component
public class JwtUtil {

    @Value("${JWT_SECRET:}")
    private String secretFromEnv;

    private Key signingKey;

    @PostConstruct
    private void init() {
        if (secretFromEnv == null || secretFromEnv.isBlank()) {
            throw new IllegalStateException("JWT secret não definido. Defina a variável de ambiente JWT_SECRET.");
        }

        byte[] keyBytes;
        try {
            // tenta decodificar como Base64 (se for)
            keyBytes = Base64.getDecoder().decode(secretFromEnv);
        } catch (IllegalArgumentException e) {
            // fallback: usa bytes UTF-8 diretos
            keyBytes = secretFromEnv.getBytes(StandardCharsets.UTF_8);
        }

        this.signingKey = new SecretKeySpec(keyBytes, SignatureAlgorithm.HS256.getJcaName());
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder().setSigningKey(signingKey).build().parseClaimsJws(token).getBody();
    }

    private Boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public String generateToken(org.springframework.security.core.userdetails.UserDetails userDetails) {
        Map<String, Object> claims = new HashMap<>();
        return createToken(claims, userDetails.getUsername());
    }

    private String createToken(Map<String, Object> claims, String subject) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setClaims(claims).setSubject(subject)
                .setIssuedAt(new Date(now))
                .setExpiration(new Date(now + 1000L * 60 * 60 * 10)) // 10 horas
                .signWith(signingKey, SignatureAlgorithm.HS256)
                .compact();
    }

    public Boolean validateToken(String token, org.springframework.security.core.userdetails.UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
    }
}