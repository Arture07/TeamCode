package com.codesync.sessionservice.service;

import com.codesync.sessionservice.dto.AIRequest;
import com.codesync.sessionservice.dto.TreeNode;
import com.codesync.sessionservice.model.AIUsageLog;
import com.codesync.sessionservice.repository.AIUsageLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class AIService {

    private static final Logger log = LoggerFactory.getLogger(AIService.class);

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.model:gemini-3.7-flash}")
    private String modelName;

    @Value("${gemini.fallback-models:gemini-3.6-flash,gemini-flash-lite-latest,gemini-2.5-flash,gemini-2.0-flash}")
    private String fallbackModelsStr;

    @Autowired
    private TreeSessionService treeSessionService;

    @Autowired
    private AIUsageLogRepository aiUsageLogRepository;

    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    private static final String BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

    private static final List<String> DEFAULT_FALLBACK_MODELS = Arrays.asList(
            "gemini-3.6-flash",
            "gemini-flash-lite-latest",
            "gemini-2.5-flash",
            "gemini-2.0-flash"
    );

    /**
     * Monta a lista ordenada de modelos candidatos (Principal -> Fallbacks) sem duplicações.
     */
    private List<String> getModelCandidateList() {
        LinkedHashSet<String> models = new LinkedHashSet<>();
        if (modelName != null && !modelName.trim().isEmpty()) {
            models.add(modelName.trim());
        }
        if (fallbackModelsStr != null && !fallbackModelsStr.trim().isEmpty()) {
            for (String m : fallbackModelsStr.split(",")) {
                String trimmed = m.trim();
                if (!trimmed.isEmpty()) {
                    models.add(trimmed);
                }
            }
        }
        models.addAll(DEFAULT_FALLBACK_MODELS);
        return new ArrayList<>(models);
    }

    /**
     * Verifica se o erro ocorrido permite tentar o próximo modelo da cadeia de fallback (ex: 503 alta demanda, 429, 5xx, timeouts).
     */
    private boolean isFallbackEligible(Exception e) {
        if (e == null) return false;

        if (e instanceof HttpStatusCodeException) {
            int status = ((HttpStatusCodeException) e).getStatusCode().value();
            if (status == 429 || status == 503 || status == 500 || status == 502 || status == 504 || status == 404) {
                return true;
            }
        }

        String msg = (e.getMessage() != null ? e.getMessage().toLowerCase() : "");
        return msg.contains("503") || msg.contains("unavailable") || msg.contains("high demand")
                || msg.contains("429") || msg.contains("resource_exhausted") || msg.contains("too many requests")
                || msg.contains("quota") || msg.contains("overloaded") || msg.contains("timed out")
                || msg.contains("timeout") || msg.contains("500") || msg.contains("502") || msg.contains("504")
                || msg.contains("404") || msg.contains("not found");
    }

    public String getAIResponse(AIRequest request) {
        if (apiKey == null || apiKey.isEmpty() || apiKey.contains("GEMINI_API_KEY")) {
            return "⚠️ **Configuração Necessária**\n\nPara usar a IA Real (" + modelName
                    + "), você precisa configurar a chave de API.\n\n1. Obtenha uma chave em: https://aistudio.google.com/\n2. Adicione `GEMINI_API_KEY=sua_chave` no arquivo `docker-compose.yml` (serviço session-service) ou crie um arquivo `.env`.\n3. Reinicie os containers.";
        }

        try {
            RestTemplate restTemplate = new RestTemplate();

            String message = request.getMessage();
            String context = request.getContext();
            String mode = request.getMode();
            String sessionId = request.getSessionId();

            String prompt = "Atue como um Engenheiro de Software Sênior e especialista em várias linguagens de programação.\n"
                    +
                    "Você está integrado ao 'TeamCode', um editor de código colaborativo em tempo real.\n" +
                    "Suas diretrizes principais são:\n" +
                    "1. **Idioma:** Responda sempre em Português do Brasil (PT-BR).\n" +
                    "2. **Qualidade de Código:** Forneça soluções eficientes, seguras e seguindo as melhores práticas (Clean Code).\n"
                    +
                    "3. **Formatação:** Use blocos de código Markdown com a linguagem especificada.\n" +
                    "4. **Objetividade:** Vá direto ao ponto.\n" +
                    "5. **Contexto:** Analise profundamente o contexto fornecido antes de responder.\n" +
                    "6. **Correções:** Se encontrar erros, explique a causa raiz e forneça a versão corrigida.\n";

            if ("agent".equalsIgnoreCase(mode) && sessionId != null) {
                prompt += "7. **MODO AGENTE ATIVADO (DIRETRIZES FUNDAMENTAIS)**:\n" +
                        "   - Você tem acesso à ferramenta `update_file` para criar ou modificar arquivos no workspace.\n" +
                        "   - **Criação Certeira:** Gere sempre código completo, limpo, moderno e 100% funcional logo na primeira tentativa. Evite placeholders ou versões parciais.\n" +
                        "   - **Fluxo Sequencial Multi-Arquivos:** Se o usuário solicitar múltiplos arquivos (ex: HTML, CSS e JS), crie um arquivo por vez em ordem lógica (ex: 1º HTML -> 2º CSS -> 3º JS). Após a confirmação de que um arquivo foi criado com sucesso, passe imediatamente para o próximo arquivo sem reescrever o arquivo anterior.\n" +
                        "   - **Conclusão:** Quando todos os arquivos solicitados já estiverem criados, envie uma mensagem final clara explicando o que foi feito e como testar, sem chamar ferramentas adicionais desnecessariamente.\n";
                // Inject workspace structure
                try {
                    TreeNode root = treeSessionService.getTree(sessionId);
                    prompt += "\n--- ESTRUTURA ATUAL DO WORKSPACE ---\n" + treeToString(root, "")
                            + "\n--- FIM DA ESTRUTURA ---\n";
                } catch (Exception e) {
                    prompt += "\n(Aviso: não foi possível carregar a árvore de arquivos)\n";
                }
            }

            if (context != null && !context.trim().isEmpty()) {
                prompt += "\n--- CONTEXTO DO ARQUIVO ATUAL ---\n" + context + "\n--- FIM DO CONTEXTO ---\n\n";
            }

            prompt += "PERGUNTA DO USUÁRIO: " + message;

            List<Map<String, Object>> parts = new ArrayList<>();
            Map<String, Object> textPart = new HashMap<>();
            textPart.put("text", prompt);
            parts.add(textPart);

            if (request.getAttachments() != null) {
                for (AIRequest.Attachment att : request.getAttachments()) {
                    Map<String, Object> inlineData = new HashMap<>();
                    inlineData.put("mimeType", att.getMimeType());
                    inlineData.put("data", att.getData());
                    Map<String, Object> part = new HashMap<>();
                    part.put("inlineData", inlineData);
                    parts.add(part);
                }
            }

            Map<String, Object> userContent = new HashMap<>();
            userContent.put("role", "user");
            userContent.put("parts", parts);

            List<Map<String, Object>> contents = new ArrayList<>();

            if (request.getHistory() != null) {
                for (AIRequest.ChatMessage msg : request.getHistory()) {
                    if (msg.getContent() == null || msg.getContent().isEmpty()) continue;
                    
                    String cleanContent = msg.getContent();
                    // Converte tool_requests brutos em um resumo contextual para que o modelo saiba o que já foi gerado
                    if (cleanContent.contains("```tool_request")) {
                        cleanContent = cleanContent.replaceAll("```tool_request[\\s\\S]*?```", "[Ação executada: alteração de arquivo]").trim();
                        if (cleanContent.isEmpty()) {
                            cleanContent = "[Ação executada no workspace]";
                        }
                    }

                    Map<String, Object> histContent = new HashMap<>();
                    histContent.put("role", "assistant".equals(msg.getRole()) ? "model" : "user");
                    
                    List<Map<String, Object>> histParts = new ArrayList<>();
                    Map<String, Object> histTextPart = new HashMap<>();
                    histTextPart.put("text", cleanContent);
                    histParts.add(histTextPart);
                    
                    histContent.put("parts", histParts);
                    contents.add(histContent);
                }
            }

            contents.add(userContent);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("contents", contents);

            if ("agent".equalsIgnoreCase(mode)) {
                requestBody.put("tools", buildTools());
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            List<String> candidates = getModelCandidateList();
            Exception lastException = null;

            for (int i = 0; i < candidates.size(); i++) {
                String currentModel = candidates.get(i);
                boolean hasNext = (i < candidates.size() - 1);

                try {
                    String url = BASE_URL + currentModel + ":generateContent?key=" + apiKey;
                    @SuppressWarnings("rawtypes")
                    ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
                    Map<?, ?> body = response.getBody();

                    if (body == null) {
                        throw new RuntimeException("Resposta vazia da API do Gemini para o modelo " + currentModel);
                    }

                    // FinOps: Log tokens consumed by Gemini with the actual model used
                    logUsage(body, sessionId, "user", mode, currentModel);

                    // Check if function call
                    Map<String, Object> functionCall = extractFunctionCall(body);
                    if (functionCall != null) {
                        String funcName = (String) functionCall.get("name");
                        @SuppressWarnings("unchecked")
                        Map<String, Object> args = (Map<String, Object>) functionCall.get("args");

                        // Em vez de executar silenciosamente, retornamos a intenção de ferramenta para o frontend aprovar
                        Map<String, Object> toolReq = new HashMap<>();
                        toolReq.put("type", "tool_request");
                        toolReq.put("tool", funcName);
                        toolReq.put("args", args);
                        
                        try {
                            return "```tool_request\n" + (objectMapper != null ? objectMapper.writeValueAsString(toolReq) : new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(toolReq)) + "\n```";
                        } catch (Exception e) {
                            return "Erro ao processar requisição de ferramenta: " + e.getMessage();
                        }
                    }

                    return extractText(body);

                } catch (Exception e) {
                    lastException = e;
                    log.warn("Modelo Gemini '{}' falhou: {}. Verificando fallback...", currentModel, e.getMessage());

                    if (hasNext) {
                        log.info("Acionando fallback automático para o próximo modelo: '{}'", candidates.get(i + 1));
                        continue;
                    }
                    break;
                }
            }

            if (lastException != null) {
                String errMsg = lastException.getMessage() != null ? lastException.getMessage() : "";
                if (errMsg.contains("429") || errMsg.toLowerCase().contains("too many requests") || errMsg.toLowerCase().contains("resource_exhausted")) {
                    return "Limite da API atingido em todos os modelos Gemini disponíveis. Aguarde cerca de 1 minuto para fazer novas solicitações.";
                }
                if (errMsg.contains("503") || errMsg.toLowerCase().contains("high demand") || errMsg.toLowerCase().contains("unavailable")) {
                    return "Os modelos de IA do Gemini estão com alta demanda temporária no Google AI Studio. Por favor, tente novamente em alguns instantes.";
                }
                return "Erro ao comunicar com a IA (todos os modelos falharam): " + errMsg;
            }

            return "Não foi possível obter resposta da IA.";

        } catch (Exception e) {
            e.printStackTrace();
            if (e.getMessage() != null && e.getMessage().contains("429 Too Many Requests")) {
                return "Limite da API atingido. Aguarde cerca de 1 minuto para fazer novas solicitações (limite da versão gratuita do Gemini excedido).";
            }
            return "Erro ao comunicar com a IA: " + e.getMessage();
        }
    }

    public String getAutocompleteResponse(AIRequest request) {
        if (apiKey == null || apiKey.isEmpty() || apiKey.contains("GEMINI_API_KEY")) {
            return ""; // No API key, just fail silently for autocomplete
        }

        try {
            RestTemplate restTemplate = new RestTemplate();
            
            // For autocomplete, we expect the context to be "PREFIX<CURSOR>SUFFIX"
            // The message parameter could be the active file extension/language
            String prompt = "You are a code completion AI. You will be provided with the code before and after the cursor, and the file type.\n"
                    + "Your task is to predict the code that belongs exactly at the cursor position.\n"
                    + "RETURN ONLY THE PREDICTED CODE. NO MARKDOWN FORMATTING. NO EXPLANATIONS.\n\n"
                    + "File Context:\n" + request.getContext();

            List<Map<String, Object>> parts = new ArrayList<>();
            Map<String, Object> textPart = new HashMap<>();
            textPart.put("text", prompt);
            parts.add(textPart);

            Map<String, Object> userContent = new HashMap<>();
            userContent.put("role", "user");
            userContent.put("parts", parts);

            List<Map<String, Object>> contents = new ArrayList<>();
            contents.add(userContent);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("contents", contents);
            
            // Adjust generation config for autocomplete (faster, less creative)
            Map<String, Object> generationConfig = new HashMap<>();
            generationConfig.put("temperature", 0.2);
            generationConfig.put("topK", 20);
            generationConfig.put("maxOutputTokens", 128); // Keep it short
            requestBody.put("generationConfig", generationConfig);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            List<String> candidates = getModelCandidateList();

            for (int i = 0; i < candidates.size(); i++) {
                String currentModel = candidates.get(i);
                boolean hasNext = (i < candidates.size() - 1);

                try {
                    String url = BASE_URL + currentModel + ":generateContent?key=" + apiKey;
                    @SuppressWarnings("rawtypes")
                    ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
                    Map<?, ?> body = response.getBody();

                    if (body != null) {
                        logUsage(body, null, "user", "autocomplete", currentModel);
                        return extractText(body).trim();
                    }
                } catch (Exception e) {
                    log.warn("Autocomplete falhou no modelo '{}': {}", currentModel, e.getMessage());
                    if (hasNext) {
                        continue;
                    }
                    break;
                }
            }

            return "";

        } catch (Exception e) {
            e.printStackTrace();
            return "";
        }
    }

    private void logUsage(Map<?, ?> body, String sessionId, String username, String mode, String usedModel) {
        try {
            if (body == null || !body.containsKey("usageMetadata") || aiUsageLogRepository == null) return;
            @SuppressWarnings("unchecked")
            Map<String, Object> usage = (Map<String, Object>) body.get("usageMetadata");
            if (usage != null) {
                Integer promptTokens = usage.get("promptTokenCount") instanceof Number ? ((Number) usage.get("promptTokenCount")).intValue() : 0;
                Integer responseTokens = usage.get("candidatesTokenCount") instanceof Number ? ((Number) usage.get("candidatesTokenCount")).intValue() : 0;
                Integer totalTokens = usage.get("totalTokenCount") instanceof Number ? ((Number) usage.get("totalTokenCount")).intValue() : (promptTokens + responseTokens);

                AIUsageLog logEntity = new AIUsageLog(sessionId, username, usedModel != null ? usedModel : modelName, mode, promptTokens, responseTokens, totalTokens);
                aiUsageLogRepository.save(logEntity);
            }
        } catch (Exception ignored) {
        }
    }

    private List<Map<String, Object>> buildTools() {
        Map<String, Object> updateFileFunc = new HashMap<>();
        updateFileFunc.put("name", "update_file");
        updateFileFunc.put("description",
                "CRIA um NOVO arquivo ou ATUALIZA um arquivo existente no workspace do usuário. OBRIGATÓRIO usar esta função se o usuário pedir para criar um arquivo ou escrever código.");
        Map<String, Object> params = new HashMap<>();
        params.put("type", "OBJECT");
        Map<String, Object> props = new HashMap<>();

        Map<String, Object> pathProp = new HashMap<>();
        pathProp.put("type", "STRING");
        pathProp.put("description", "Caminho do arquivo (ex: /src/App.js)");
        props.put("path", pathProp);

        Map<String, Object> contentProp = new HashMap<>();
        contentProp.put("type", "STRING");
        contentProp.put("description", "O conteúdo completo do arquivo.");
        props.put("content", contentProp);

        params.put("properties", props);
        params.put("required", Arrays.asList("path", "content"));
        updateFileFunc.put("parameters", params);

        Map<String, Object> runTerminalFunc = new HashMap<>();
        runTerminalFunc.put("name", "run_terminal_command");
        runTerminalFunc.put("description",
                "Executa um comando no terminal do workspace do usuário (ex: npm install, mkdir, etc). Use esta ferramenta para automatizar tarefas.");
        Map<String, Object> termParams = new HashMap<>();
        termParams.put("type", "OBJECT");
        Map<String, Object> termProps = new HashMap<>();
        
        Map<String, Object> cmdProp = new HashMap<>();
        cmdProp.put("type", "STRING");
        cmdProp.put("description", "O comando a ser executado (ex: npm install react-router-dom)");
        termProps.put("command", cmdProp);
        
        termParams.put("properties", termProps);
        termParams.put("required", Collections.singletonList("command"));
        runTerminalFunc.put("parameters", termParams);

        Map<String, Object> decl = new HashMap<>();
        decl.put("functionDeclarations", Arrays.asList(updateFileFunc, runTerminalFunc));
        return Collections.singletonList(decl);
    }

    public String executeTool(String name, Map<String, Object> args, String sessionId) {
        if (sessionId == null)
            return "Erro: sessionId não fornecido.";
        try {
            if ("update_file".equals(name)) {
                String path = (String) args.get("path");
                String content = (String) args.get("content");
                if (path == null || content == null)
                    return "Erro: argumentos inválidos.";

                treeSessionService.updateFileContent(sessionId, path, content);
                return "Arquivo " + path + " atualizado com sucesso!";
            }
            return "Erro: Função desconhecida.";
        } catch (Exception e) {
            return "Erro ao executar função: " + e.getMessage();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractFunctionCall(Map<?, ?> body) {
        if (body != null) {
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
            if (candidates != null && !candidates.isEmpty()) {
                Map<String, Object> contentMap = (Map<String, Object>) candidates.get(0).get("content");
                if (contentMap != null) {
                    List<Map<String, Object>> parts = (List<Map<String, Object>>) contentMap.get("parts");
                    if (parts != null && !parts.isEmpty()) {
                        return (Map<String, Object>) parts.get(0).get("functionCall");
                    }
                }
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private String extractText(Map<?, ?> body) {
        if (body != null) {
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
            if (candidates != null && !candidates.isEmpty()) {
                Map<String, Object> contentMap = (Map<String, Object>) candidates.get(0).get("content");
                if (contentMap != null) {
                    List<Map<String, Object>> parts = (List<Map<String, Object>>) contentMap.get("parts");
                    if (parts != null && !parts.isEmpty()) {
                        return (String) parts.get(0).get("text");
                    }
                }
            }
        }
        return "Não recebi uma resposta válida da IA.";
    }

    private String treeToString(TreeNode node, String prefix) {
        if (node == null)
            return "";
        StringBuilder sb = new StringBuilder();
        sb.append(prefix).append(node.getName().isEmpty() ? "/" : node.getName()).append("\n");
        if ("folder".equals(node.getType()) && node.getChildren() != null) {
            for (TreeNode child : node.getChildren()) {
                sb.append(treeToString(child, prefix + "  "));
            }
        }
        return sb.toString();
    }
}
