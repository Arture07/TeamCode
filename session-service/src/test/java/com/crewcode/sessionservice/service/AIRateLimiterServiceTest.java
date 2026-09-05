package com.crewcode.sessionservice.service;

import com.crewcode.sessionservice.service.AIRateLimiterService.RateLimitResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class AIRateLimiterServiceTest {

    private AIRateLimiterService rateLimiterService;

    @BeforeEach
    void setUp() {
        rateLimiterService = new AIRateLimiterService();
    }

    @Test
    @DisplayName("Guest user is limited to 10 requests per day per IP")
    void testGuestDailyLimit() {
        String ip = "192.168.1.100";

        for (int i = 1; i <= 10; i++) {
            RateLimitResult result = rateLimiterService.checkAndConsume(ip, null, false, false);
            assertTrue(result.isAllowed(), "Request " + i + " should be allowed");
            assertEquals(10, result.getLimit());
            assertEquals(10 - i, result.getRemaining());
        }

        // 11th request must be rejected with 429
        RateLimitResult blocked = rateLimiterService.checkAndConsume(ip, null, false, false);
        assertFalse(blocked.isAllowed(), "11th request from guest must be blocked");
        assertEquals(0, blocked.getRemaining());
        assertTrue(blocked.getMessage().contains("10 mensagens"), "Message should mention guest limit");
    }

    @Test
    @DisplayName("Registered user is allowed up to 200 requests per day")
    void testRegisteredUserLimit() {
        String username = "artur_developer";

        for (int i = 1; i <= 200; i++) {
            RateLimitResult result = rateLimiterService.checkAndConsume("192.168.1.50", username, true, false);
            assertTrue(result.isAllowed(), "User request " + i + " should be allowed");
        }

        // 201st request must be rejected
        RateLimitResult blocked = rateLimiterService.checkAndConsume("192.168.1.50", username, true, false);
        assertFalse(blocked.isAllowed(), "201st request from registered user must be blocked");
        assertEquals(0, blocked.getRemaining());
        assertTrue(blocked.getMessage().contains("200"), "Message should mention registered limit of 200");
    }

    @Test
    @DisplayName("Admin users have unlimited AI requests")
    void testAdminUnlimited() {
        String admin = "superadmin";

        for (int i = 1; i <= 300; i++) {
            RateLimitResult result = rateLimiterService.checkAndConsume("127.0.0.1", admin, true, true);
            assertTrue(result.isAllowed(), "Admin request " + i + " should always be allowed");
            assertEquals(Integer.MAX_VALUE, result.getRemaining());
        }
    }
}
