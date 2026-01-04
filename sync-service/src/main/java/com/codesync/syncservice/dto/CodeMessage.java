package com.codesync.syncservice.dto;

import lombok.Data;

// Um objeto simples para representar a mensagem que será trocada.
@Data
public class CodeMessage {
    private String content; // O conteúdo completo do editor
    private String filePath;
    private String userId;
}