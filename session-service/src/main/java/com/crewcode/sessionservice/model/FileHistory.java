package com.crewcode.sessionservice.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "file_history")
public class FileHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_public_id", nullable = false)
    private String sessionPublicId;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "content", columnDefinition = "text")
    private String content;

    @Column(name = "created_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt = new Date();

    @Column(name = "created_by")
    private String createdBy;

    public FileHistory() {
    }

    public FileHistory(Long id, String sessionPublicId, String fileName, String content, Date createdAt, String createdBy) {
        this.id = id;
        this.sessionPublicId = sessionPublicId;
        this.fileName = fileName;
        this.content = content;
        this.createdAt = createdAt != null ? createdAt : new Date();
        this.createdBy = createdBy;
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

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }
}
