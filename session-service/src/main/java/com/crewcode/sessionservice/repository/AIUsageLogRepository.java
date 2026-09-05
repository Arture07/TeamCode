package com.crewcode.sessionservice.repository;

import com.crewcode.sessionservice.model.AIUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AIUsageLogRepository extends JpaRepository<AIUsageLog, Long> {

    List<AIUsageLog> findBySessionId(String sessionId);

    List<AIUsageLog> findByTimestampAfter(Instant after);

    @Query("SELECT COALESCE(SUM(l.totalTokens), 0) FROM AIUsageLog l")
    Long sumTotalTokens();

    @Query("SELECT COALESCE(SUM(l.promptTokens), 0) FROM AIUsageLog l")
    Long sumPromptTokens();

    @Query("SELECT COALESCE(SUM(l.responseTokens), 0) FROM AIUsageLog l")
    Long sumResponseTokens();

    @Query("SELECT COALESCE(SUM(l.totalTokens), 0) FROM AIUsageLog l WHERE l.timestamp >= :since")
    Long sumTotalTokensSince(Instant since);

    @Query("SELECT l.mode, COUNT(l) FROM AIUsageLog l GROUP BY l.mode")
    List<Object[]> countRequestsByMode();

    List<AIUsageLog> findTop50ByOrderByTimestampDesc();
}
