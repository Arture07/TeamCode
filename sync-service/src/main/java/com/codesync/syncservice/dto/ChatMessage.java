// Ficheiro: ChatMessage.java
// Pacote: com.codesync.syncservice.dto
package com.codesync.syncservice.dto;

import lombok.Data;

@Data
public class ChatMessage {
    private String username; // O nome do utilizador que enviou a mensagem
    private String content;  // O conteúdo da mensagem
    private String timestamp;// A hora em que a mensagem foi enviada
}