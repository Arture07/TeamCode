package com.codesync.sessionservice.repository;

import com.codesync.sessionservice.model.SessionFile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionFileRepository extends JpaRepository<SessionFile, Long> {
    List<SessionFile> findBySessionPublicId(String sessionPublicId);
    
    Optional<SessionFile> findBySessionPublicIdAndFilePath(String sessionPublicId, String filePath);
    
    void deleteBySessionPublicIdAndFilePathStartingWith(String sessionPublicId, String prefix);
    
    void deleteBySessionPublicId(String sessionPublicId);
}
