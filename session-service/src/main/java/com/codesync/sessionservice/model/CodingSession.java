package com.codesync.sessionservice.model;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "coding_session")
public class CodingSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", unique = true, nullable = false, updatable = false)
    private String publicId;

    @Column(name = "session_name")
    private String sessionName;

    @Column(name = "owner_username")
    private String ownerUsername;

    @Lob
    @Column(name = "files_json", columnDefinition = "text")
    @Deprecated // Migrado para tabela session_file
    private String filesJson;

    @Column(name = "password_hash")
    private String passwordHash;

    @Transient
    private String rawPassword; // Used for incoming requests

    public CodingSession() {
    }

    public CodingSession(Long id, String publicId, String sessionName, String ownerUsername, String filesJson, String passwordHash, String rawPassword) {
        this.id = id;
        this.publicId = publicId;
        this.sessionName = sessionName;
        this.ownerUsername = ownerUsername;
        this.filesJson = filesJson;
        this.passwordHash = passwordHash;
        this.rawPassword = rawPassword;
    }

    @PrePersist
    public void prePersist() {
        if (this.publicId == null) {
            this.publicId = UUID.randomUUID().toString();
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPublicId() {
        return publicId;
    }

    public void setPublicId(String publicId) {
        this.publicId = publicId;
    }

    public String getSessionName() {
        return sessionName;
    }

    public void setSessionName(String sessionName) {
        this.sessionName = sessionName;
    }

    public String getOwnerUsername() {
        return ownerUsername;
    }

    public void setOwnerUsername(String ownerUsername) {
        this.ownerUsername = ownerUsername;
    }

    public String getFilesJson() {
        return filesJson;
    }

    public void setFilesJson(String filesJson) {
        this.filesJson = filesJson;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getRawPassword() {
        return rawPassword;
    }

    public void setRawPassword(String rawPassword) {
        this.rawPassword = rawPassword;
    }
}
