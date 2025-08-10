// Ficheiro: FileData.java
// Pacote: com.codesync.sessionservice.dto
package com.codesync.sessionservice.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

// Esta classe representa um único ficheiro com o seu nome e conteúdo.
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FileData {
    private String name;
    private String content;
}
