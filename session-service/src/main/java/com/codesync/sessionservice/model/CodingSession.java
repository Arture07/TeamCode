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

    @Lob
    @Column(name = "files_json", columnDefinition = "text")
    private String filesJson;

    @PrePersist
    public void prePersist() {
        if (this.publicId == null) {
            this.publicId = UUID.randomUUID().toString();
        }
        if (this.filesJson == null) {
            this.filesJson = "[{\"name\":\"main.js\",\"content\":\"// Bem-vindo ao CodeSync!\"}]";
        }
    }
}
