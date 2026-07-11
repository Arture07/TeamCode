package com.codesync.sessionservice.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "session_file", indexes = {
    @Index(name = "idx_session_file_public_id", columnList = "session_public_id")
})
@Data
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

    @Lob
    @Column(name = "content", columnDefinition = "text")
    private String content;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
