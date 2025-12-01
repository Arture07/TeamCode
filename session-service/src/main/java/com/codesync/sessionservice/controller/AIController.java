package com.codesync.sessionservice.controller;

import com.codesync.sessionservice.dto.AIRequest;
import com.codesync.sessionservice.dto.AIResponse;
import com.codesync.sessionservice.service.AIService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class AIController {

    @Autowired
    private AIService aiService;

    @PostMapping("/chat")
    public ResponseEntity<AIResponse> chat(@RequestBody AIRequest request) {
        String response = aiService.getAIResponse(request.getMessage(), request.getContext());
        return ResponseEntity.ok(new AIResponse(response));
    }
}
