package com.codesync.sessionservice.repository;

import com.codesync.sessionservice.model.FileHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FileHistoryRepository extends JpaRepository<FileHistory, Long> {
    List<FileHistory> findBySessionPublicIdAndFileNameOrderByCreatedAtDesc(String sessionPublicId, String fileName);
}
