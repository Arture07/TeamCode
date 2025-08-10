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

    @Column(unique = true, nullable = false)
    private String publicId;

    private String sessionName;

    // NOVO CAMPO: Usamos @Lob para indicar que este campo pode guardar muito texto.
    // Vamos guardar aqui uma lista de ficheiros em formato JSON.
    @Lob
    @Column(columnDefinition = "TEXT")
    private String filesJson;

    @PrePersist
    public void prePersist() {
        if (this.publicId == null) {
            this.publicId = UUID.randomUUID().toString();
        }
        // Garante que uma nova sessão começa com um ficheiro "main.js" vazio.
        if (this.filesJson == null) {
            this.filesJson = "[{\"name\":\"main.js\",\"content\":\"// Bem-vindo ao CodeSync!\"}]";
        }
    }
}