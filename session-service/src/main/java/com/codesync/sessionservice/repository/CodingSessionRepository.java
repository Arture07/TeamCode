package com.codesync.sessionservice.repository;

import com.codesync.sessionservice.model.CodingSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CodingSessionRepository extends JpaRepository<CodingSession, Long> {
    // Método para encontrar uma sessão pelo seu ID público
    Optional<CodingSession> findByPublicId(String publicId);
}