package com.codesync.syncservice.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

// Usamos @RestController para criar endpoints HTTP normais.
@RestController
@CrossOrigin(origins = "*") // Permite o acesso a partir do nosso frontend
public class HealthCheckController {

    // Este método simples responde a um pedido GET para o endereço /ping
    @GetMapping("/ping")
    public ResponseEntity<String> ping() {
        // Se conseguirmos aceder a este endpoint, ele responderá com "Pong!".
        return ResponseEntity.ok("Pong from Sync Service!");
    }
}
