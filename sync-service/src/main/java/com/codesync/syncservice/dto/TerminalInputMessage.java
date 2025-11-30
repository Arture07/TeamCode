package com.codesync.syncservice.dto;

import lombok.Data;

// Mensagem que o frontend envia PARA o backend (o que o utilizador digitou)
@Data
public class TerminalInputMessage {
    private String input;
}
