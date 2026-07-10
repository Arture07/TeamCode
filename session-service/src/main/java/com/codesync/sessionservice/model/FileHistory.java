package com.codesync.sessionservice.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "file_history")
@Data
public class FileHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_public_id", nullable = false)
    private String sessionPublicId;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Lob
    @Column(name = "content", columnDefinition = "text")
    private String content;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "created_by")
    private String createdBy;
}
