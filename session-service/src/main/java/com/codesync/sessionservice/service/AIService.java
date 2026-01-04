package com.codesync.sessionservice.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AIService {

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.model:gemini-1.5-pro}")
    private String modelName;

    private static final String BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

    public String getAIResponse(String message, String context) {
        if (apiKey == null || apiKey.isEmpty() || apiKey.contains("GEMINI_API_KEY")) {
            return "⚠️ **Configuração Necessária**\n\nPara usar a IA Real (" + modelName + "), você precisa configurar a chave de API.\n\n1. Obtenha uma chave em: https://aistudio.google.com/\n2. Adicione `GEMINI_API_KEY=sua_chave` no arquivo `docker-compose.yml` (serviço session-service) ou crie um arquivo `.env`.\n3. Reinicie os containers.";
        }

        try {
            RestTemplate restTemplate = new RestTemplate();

            // Construct the prompt
            String prompt = "Atue como um Engenheiro de Software Sênior e especialista em várias linguagens de programação.\n" +
                    "Você está integrado ao 'TeamCode', um editor de código colaborativo em tempo real.\n" +
                    "Suas diretrizes principais são:\n" +
                    "1. **Idioma:** Responda sempre em Português do Brasil (PT-BR).\n" +
                    "2. **Qualidade de Código:** Forneça soluções eficientes, seguras e seguindo as melhores práticas (Clean Code).\n" +
                    "3. **Formatação:** Use blocos de código Markdown com a linguagem especificada (ex: ```java, ```python).\n" +
                    "4. **Objetividade:** Vá direto ao ponto. Explique o 'porquê' apenas se for crucial ou solicitado.\n" +
                    "5. **Contexto:** Analise profundamente o código fornecido no contexto antes de responder. Se a pergunta for sobre o código, refira-se a linhas ou funções específicas.\n" +
                    "6. **Correções:** Se encontrar erros, explique a causa raiz e forneça a versão corrigida completa ou o diff necessário.\n" +
                    "7. **Segurança:** Nunca sugira código vulnerável (ex: SQL Injection, hardcoded secrets).\n\n";
            
            if (context != null && !context.trim().isEmpty()) {
                prompt += "--- CONTEXTO DO ARQUIVO ATUAL ---\n" + context + "\n--- FIM DO CONTEXTO ---\n\n";
            }
            
            prompt += "PERGUNTA DO USUÁRIO: " + message;

            // Request Body Structure for Gemini
            // { "contents": [{ "parts": [{ "text": "..." }] }] }
            Map<String, Object> part = new HashMap<>();
            part.put("text", prompt);

            Map<String, Object> content = new HashMap<>();
            content.put("parts", Collections.singletonList(part));

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("contents", Collections.singletonList(content));

            // Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            // Execute Request
            // Dynamic URL based on model version
            String url = BASE_URL + modelName + ":generateContent?key=" + apiKey;
            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);

            // Parse Response
            // { "candidates": [{ "content": { "parts": [{ "text": "..." }] } }] }
            if (response.getBody() != null) {
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.getBody().get("candidates");
                if (candidates != null && !candidates.isEmpty()) {
                    Map<String, Object> firstCandidate = candidates.get(0);
                    Map<String, Object> contentMap = (Map<String, Object>) firstCandidate.get("content");
                    if (contentMap != null) {
                        List<Map<String, Object>> parts = (List<Map<String, Object>>) contentMap.get("parts");
                        if (parts != null && !parts.isEmpty()) {
                            return (String) parts.get(0).get("text");
                        }
                    }
                }
            }

            return "Não recebi uma resposta válida da IA.";

        } catch (Exception e) {
            e.printStackTrace();
            return "Erro ao comunicar com o Gemini: " + e.getMessage();
        }
    }
}
