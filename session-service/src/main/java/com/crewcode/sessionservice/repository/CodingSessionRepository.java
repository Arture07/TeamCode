package com.crewcode.sessionservice.repository;

import com.crewcode.sessionservice.model.CodingSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CodingSessionRepository extends JpaRepository<CodingSession, Long> {
    // Método para encontrar uma sessão pelo seu ID público
    Optional<CodingSession> findByPublicId(String publicId);
    
    // Buscar sessões de um usuário específico
    List<CodingSession> findByOwnerUsername(String ownerUsername);

    List<CodingSession> findByOwnerUsernameIgnoreCase(String ownerUsername);

    // Excluir sessões temporárias de visitantes inativas
    void deleteByIsAnonymousTrueAndLastActivityAtBefore(LocalDateTime threshold);

    List<CodingSession> findByIsAnonymousTrueAndLastActivityAtBefore(LocalDateTime threshold);
}