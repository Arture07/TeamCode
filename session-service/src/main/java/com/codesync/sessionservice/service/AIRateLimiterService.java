package com.codesync.sessionservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class AIRateLimiterService {

    private static final Logger log = LoggerFactory.getLogger(AIRateLimiterService.class);

    public static final int GUEST_DAILY_LIMIT = 10;
    public static final int REGISTERED_DAILY_LIMIT = 200;

    private static class UsageBucket {
        final LocalDate date;
        final AtomicInteger count;

        UsageBucket(LocalDate date) {
            this.date = date;
            this.count = new AtomicInteger(0);
        }
    }

    private final Map<String, UsageBucket> usageMap = new ConcurrentHashMap<>();

    public static class RateLimitResult {
        private final boolean allowed;
        private final int limit;
        private final int remaining;
        private final String message;

        public RateLimitResult(boolean allowed, int limit, int remaining, String message) {
            this.allowed = allowed;
            this.limit = limit;
            this.remaining = remaining;
            this.message = message;
        }

        public boolean isAllowed() {
            return allowed;
        }

        public int getLimit() {
            return limit;
        }

        public int getRemaining() {
            return remaining;
        }

        public String getMessage() {
            return message;
        }
    }

    public RateLimitResult checkAndConsume(String clientIp, String username, boolean isAuthenticated, boolean isAdmin) {
        if (isAdmin) {
            return new RateLimitResult(true, Integer.MAX_VALUE, Integer.MAX_VALUE, null);
        }

        LocalDate today = LocalDate.now();
        String key;
        int limit;

        if (isAuthenticated && username != null && !username.isBlank() && !"Guest".equalsIgnoreCase(username)) {
            key = "user:" + username.toLowerCase().trim();
            limit = REGISTERED_DAILY_LIMIT;
        } else {
            String ip = (clientIp != null && !clientIp.isBlank()) ? clientIp.trim() : "anonymous";
            key = "ip:" + ip;
            limit = GUEST_DAILY_LIMIT;
        }

        UsageBucket bucket = usageMap.compute(key, (k, existing) -> {
            if (existing == null || !existing.date.equals(today)) {
                return new UsageBucket(today);
            }
            return existing;
        });

        int current = bucket.count.incrementAndGet();

        if (current > limit) {
            String msg = !isAuthenticated
                    ? "Você atingiu o limite de " + GUEST_DAILY_LIMIT + " mensagens diárias gratuitas de IA para visitantes. Crie uma conta gratuita para continuar!"
                    : "Você atingiu sua cota diária de " + REGISTERED_DAILY_LIMIT + " interações de IA. A cota será renovada à meia-noite.";
            log.warn("Rate limit exceeded for {}: {}/{}", key, current, limit);
            return new RateLimitResult(false, limit, 0, msg);
        }

        int remaining = Math.max(0, limit - current);
        return new RateLimitResult(true, limit, remaining, null);
    }

    @Scheduled(cron = "0 0 2 * * *") // Daily cleanup at 02:00 AM
    public void cleanupOldBuckets() {
        LocalDate today = LocalDate.now();
        usageMap.entrySet().removeIf(entry -> !entry.getValue().date.equals(today));
        log.info("Cleaned up expired AI rate limit buckets.");
    }
}
