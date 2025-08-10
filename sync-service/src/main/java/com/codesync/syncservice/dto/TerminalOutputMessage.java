package com.codesync.syncservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

// Mensagem que o backend envia PARA o frontend (o output do terminal)
@Data
@AllArgsConstructor
public class TerminalOutputMessage {
    private String data;
}