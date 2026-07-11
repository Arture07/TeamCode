package com.codesync.sessionservice.model;

import jakarta.persistence.*;
import lombok.Data;
import java.util.UUID;

@Entity
@Table(name = "coding_session")
@Data
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

    @PrePersist
    public void prePersist() {
        if (this.publicId == null) {
            this.publicId = UUID.randomUUID().toString();
        }
    }
}
