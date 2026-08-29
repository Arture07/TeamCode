package com.codesync.sessionservice.controller;

import com.codesync.sessionservice.dto.AIRequest;
import com.codesync.sessionservice.dto.AIResponse;
import com.codesync.sessionservice.service.AIRateLimiterService;
import com.codesync.sessionservice.service.AIRateLimiterService.RateLimitResult;
import com.codesync.sessionservice.service.AIService;
import com.codesync.sessionservice.util.JwtTokenHelper;
import com.codesync.sessionservice.util.JwtTokenHelper.UserTokenInfo;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AIController {

    @Autowired
    private AIService aiService;

    @Autowired
    private AIRateLimiterService rateLimiterService;

    @Autowired
    private JwtTokenHelper jwtTokenHelper;

    private String extractClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    @PostMapping("/chat")
    public ResponseEntity<?> chat(
            @RequestBody AIRequest request,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest servletRequest) {

        UserTokenInfo userInfo = jwtTokenHelper.parseToken(authHeader);
        String clientIp = extractClientIp(servletRequest);

        RateLimitResult rateResult = rateLimiterService.checkAndConsume(
                clientIp,
                userInfo.getUsername(),
                userInfo.isValid(),
                userInfo.isAdmin()
        );

        if (!rateResult.isAllowed()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                    "error", "RATE_LIMIT_EXCEEDED",
                    "message", rateResult.getMessage(),
                    "upgradeUrl", "/login",
                    "limit", rateResult.getLimit(),
                    "remaining", 0
            ));
        }

        String response = aiService.getAIResponse(request);
        return ResponseEntity.ok(new AIResponse(response));
    }

    @PostMapping("/autocomplete")
    public ResponseEntity<?> autocomplete(
            @RequestBody AIRequest request,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest servletRequest) {

        UserTokenInfo userInfo = jwtTokenHelper.parseToken(authHeader);
        String clientIp = extractClientIp(servletRequest);

        RateLimitResult rateResult = rateLimiterService.checkAndConsume(
                clientIp,
                userInfo.getUsername(),
                userInfo.isValid(),
                userInfo.isAdmin()
        );

        if (!rateResult.isAllowed()) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(Map.of(
                    "error", "RATE_LIMIT_EXCEEDED",
                    "message", rateResult.getMessage(),
                    "upgradeUrl", "/login",
                    "limit", rateResult.getLimit(),
                    "remaining", 0
            ));
        }

        String response = aiService.getAutocompleteResponse(request);
        return ResponseEntity.ok(new AIResponse(response));
    }

    @PostMapping("/execute-tool")
    public ResponseEntity<AIResponse> executeTool(@RequestBody java.util.Map<String, Object> body) {
        String name = (String) body.get("name");
        @SuppressWarnings("unchecked")
        java.util.Map<String, Object> args = (java.util.Map<String, Object>) body.get("args");
        String sessionId = (String) body.get("sessionId");
        
        String response = aiService.executeTool(name, args, sessionId);
        return ResponseEntity.ok(new AIResponse(response));
    }
}
