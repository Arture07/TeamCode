package com.codesync.sessionservice.controller;

import com.codesync.sessionservice.model.AIUsageLog;
import com.codesync.sessionservice.model.CodingSession;
import com.codesync.sessionservice.repository.AIUsageLogRepository;
import com.codesync.sessionservice.repository.CodingSessionRepository;
import com.codesync.sessionservice.repository.SessionFileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api/sessions/admin")
public class AdminMetricsController {

    private final AIUsageLogRepository aiUsageLogRepository;
    private final CodingSessionRepository codingSessionRepository;
    private final SessionFileRepository sessionFileRepository;

    public AdminMetricsController(AIUsageLogRepository aiUsageLogRepository,
            CodingSessionRepository codingSessionRepository,
            SessionFileRepository sessionFileRepository) {
        this.aiUsageLogRepository = aiUsageLogRepository;
        this.codingSessionRepository = codingSessionRepository;
        this.sessionFileRepository = sessionFileRepository;
    }

    /**
     * VM & JVM System Infrastructure Metrics.
     */
    @GetMapping("/system-metrics")
    public ResponseEntity<Map<String, Object>> getSystemMetrics() {
        Runtime runtime = Runtime.getRuntime();
        long maxMemory = runtime.maxMemory();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long usedMemory = totalMemory - freeMemory;

        File disk = new File("/");
        long totalDisk = disk.getTotalSpace();
        long freeDisk = disk.getFreeSpace();
        long usableDisk = disk.getUsableSpace();
        long usedDisk = totalDisk - usableDisk;

        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();

        Map<String, Object> jvmMemory = Map.of(
                "maxMb", maxMemory / (1024 * 1024),
                "totalMb", totalMemory / (1024 * 1024),
                "usedMb", usedMemory / (1024 * 1024),
                "freeMb", freeMemory / (1024 * 1024),
                "usedPercent", Math.round(((double) usedMemory / totalMemory) * 100));

        Map<String, Object> diskMetrics = Map.of(
                "totalGb", Math.round(((double) totalDisk / (1024 * 1024 * 1024)) * 10.0) / 10.0,
                "usedGb", Math.round(((double) usedDisk / (1024 * 1024 * 1024)) * 10.0) / 10.0,
                "freeGb", Math.round(((double) freeDisk / (1024 * 1024 * 1024)) * 10.0) / 10.0,
                "usedPercent", totalDisk > 0 ? Math.round(((double) usedDisk / totalDisk) * 100) : 0);

        Map<String, Object> system = Map.of(
                "processors", runtime.availableProcessors(),
                "activeThreads", Thread.activeCount(),
                "uptimeHours", Math.round(((double) uptimeMs / (1000 * 60 * 60)) * 10.0) / 10.0,
                "javaVersion", System.getProperty("java.version", "17"),
                "osName", System.getProperty("os.name", "Linux"));

        Map<String, Object> response = new HashMap<>();
        response.put("jvmMemory", jvmMemory);
        response.put("disk", diskMetrics);
        response.put("system", system);
        response.put("timestamp", Instant.now().toString());

        return ResponseEntity.ok(response);
    }

    /**
     * Google Gemini AI FinOps & Token Consumption Metrics.
     */
    @GetMapping("/ai-metrics")
    public ResponseEntity<Map<String, Object>> getAIMetrics() {
        Long totalTokens = aiUsageLogRepository.sumTotalTokens();
        Long promptTokens = aiUsageLogRepository.sumPromptTokens();
        Long responseTokens = aiUsageLogRepository.sumResponseTokens();

        Instant startOfToday = Instant.now().truncatedTo(ChronoUnit.DAYS);
        Long tokensToday = aiUsageLogRepository.sumTotalTokensSince(startOfToday);

        // Gemini 1.5/2.0 Flash pricing estimate: $0.075 / 1M prompt, $0.30 / 1M
        // response
        double estimatedCostUsd = ((promptTokens * 0.075) / 1_000_000.0) + ((responseTokens * 0.30) / 1_000_000.0);

        List<Object[]> modeCountsRaw = aiUsageLogRepository.countRequestsByMode();
        Map<String, Long> modeCounts = new HashMap<>();
        for (Object[] row : modeCountsRaw) {
            String mode = row[0] != null ? row[0].toString() : "chat";
            Long count = row[1] instanceof Number ? ((Number) row[1]).longValue() : 0L;
            modeCounts.put(mode, count);
        }

        List<AIUsageLog> recentLogs = aiUsageLogRepository.findTop50ByOrderByTimestampDesc();

        Map<String, Object> response = new HashMap<>();
        response.put("totalTokens", totalTokens);
        response.put("promptTokens", promptTokens);
        response.put("responseTokens", responseTokens);
        response.put("tokensToday", tokensToday);
        response.put("estimatedCostUsd", Math.round(estimatedCostUsd * 10000.0) / 10000.0);
        response.put("modeCounts", modeCounts);
        response.put("recentLogs", recentLogs);

        return ResponseEntity.ok(response);
    }

    /**
     * List all active sessions with statistics.
     */
    @GetMapping("/sessions")
    public ResponseEntity<List<Map<String, Object>>> getActiveSessions() {
        List<CodingSession> sessions = codingSessionRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();

        for (CodingSession s : sessions) {
            Map<String, Object> sMap = new HashMap<>();
            sMap.put("id", s.getId());
            sMap.put("publicId", s.getPublicId());
            sMap.put("sessionName", s.getSessionName());
            sMap.put("ownerUsername", s.getOwnerUsername());
            int fileCount = sessionFileRepository.findBySessionPublicId(s.getPublicId()).size();
            sMap.put("filesCount", fileCount);
            result.add(sMap);
        }

        return ResponseEntity.ok(result);
    }

    /**
     * Terminate / delete an abandoned session.
     */
    @DeleteMapping("/sessions/{publicId}")
    public ResponseEntity<?> deleteSession(@PathVariable String publicId) {
        Optional<CodingSession> sessionOpt = codingSessionRepository.findByPublicId(publicId);
        if (sessionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Sessão não encontrada"));
        }

        codingSessionRepository.delete(sessionOpt.get());
        return ResponseEntity.ok(Map.of("message", "Sessão removida com sucesso!"));
    }
}
