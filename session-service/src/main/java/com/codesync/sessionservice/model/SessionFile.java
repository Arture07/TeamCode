package com.codesync.sessionservice.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "session_file", indexes = {
    @Index(name = "idx_session_file_public_id", columnList = "session_public_id")
})
public class SessionFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_public_id", nullable = false)
    private String sessionPublicId;

    @Column(name = "file_path", nullable = false, length = 1000)
    private String filePath;

    @Column(name = "file_type", nullable = false)
    private String type; // "file" ou "folder"

    @Column(name = "content", columnDefinition = "text")
    private String content;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    public SessionFile() {
    }

    public SessionFile(Long id, String sessionPublicId, String filePath, String type, String content, LocalDateTime updatedAt) {
        this.id = id;
        this.sessionPublicId = sessionPublicId;
        this.filePath = filePath;
        this.type = type;
        this.content = content;
        this.updatedAt = updatedAt != null ? updatedAt : LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSessionPublicId() {
        return sessionPublicId;
    }

    public void setSessionPublicId(String sessionPublicId) {
        this.sessionPublicId = sessionPublicId;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
