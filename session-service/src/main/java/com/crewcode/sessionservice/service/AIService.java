package com.crewcode.sessionservice.service;

import com.crewcode.sessionservice.dto.AIRequest;
import com.crewcode.sessionservice.dto.TreeNode;
import com.crewcode.sessionservice.model.AIUsageLog;
import com.crewcode.sessionservice.repository.AIUsageLogRepository;
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
            "gemini-2.5-flash",
            "gemini-2.0-flash",
            "gemini-1.5-flash"
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
            return "**Configuração Necessária**\n\nPara usar a IA Real (" + modelName
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
                    "Você está integrado ao 'CrewCode', um editor de código colaborativo em tempo real.\n" +
                    "Suas diretrizes principais são:\n" +
                    "1. **Idioma:** Responda sempre em Português do Brasil (PT-BR).\n" +
                    "2. **Qualidade de Código:** Forneça soluções eficientes, seguras e seguindo as melhores práticas (Clean Code).\n"
                    +
                    "3. **Formatação:** Use blocos de código Markdown com a linguagem especificada.\n" +
                    "4. **Objetividade:** Vá direto ao ponto.\n" +
                    "5. **Contexto:** Analise profundamente o contexto fornecido antes de responder.\n" +
                    "6. **Correções:** Se encontrar erros, explique a causa raiz e forneça a versão corrigida.\n";

            if ("agent".equalsIgnoreCase(mode) && sessionId != null) {
                prompt += "7. **MODO AGENTE INTELIGENTE ATIVADO (ESTILO CURSOR / COPILOT / ANTIGRAVITY)**:\n" +
                        "   - Você tem acesso às seguintes ferramentas de engenharia de software:\n" +
                        "     * `batch_update_files`: Cria ou modifica múltiplos arquivos de uma só vez. Use SEMPRE que for criar um projeto ou múltiplos arquivos (ex: index.html, style.css, script.js, package.json).\n" +
                        "     * `update_file`: Cria ou modifica um único arquivo específico.\n" +
                        "     * `read_file`: Lê o conteúdo atual de um arquivo do workspace para inspecionar bugs ou entender código.\n" +
                        "     * `run_terminal_command`: Propõe a execução de um comando no terminal (ex: `npm install`, `npm start`, etc.).\n" +
                        "   - **PROJETOS COMPLETOS E 100% FUNCIONAIS:**\n" +
                        "     * Se o usuário pedir um projeto web / node / backend / frontend, gere TODOS os arquivos necessários sem deixar nada faltando.\n" +
                        "     * Se for um projeto Node/NPM, certifique-se de que o `package.json` é um JSON válido e estrito, com o nome do pacote em minúsculas (sem espaços), scripts corretos (`start`, `dev`, etc.) e dependências existentes e compatíveis.\n" +
                        "     * Use `batch_update_files` com todos os arquivos do projeto em uma única resposta, permitindo ao usuário revisar e aprovar o projeto inteiro com 1 clique.\n" +
                        "     * Em seguida, proponha o comando de terminal para instalar dependências e rodar o projeto.\n" +
                        "   - **DIAGNÓSTICO E CORREÇÃO:** Se o usuário relatar um erro de compilação ou execução (ex: `npm install` falhou), use `read_file` ou proponha o arquivo corrigido imediatamente com `update_file` ou `batch_update_files`.\n";
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

                    // Check for function calls (supports single or multiple tool calls)
                    List<Map<String, Object>> functionCalls = extractFunctionCalls(body);
                    if (!functionCalls.isEmpty()) {
                        StringBuilder sb = new StringBuilder();
                        String textExplanation = extractText(body);
                        if (textExplanation != null && !textExplanation.trim().isEmpty()) {
                            sb.append(textExplanation.trim()).append("\n\n");
                        }
                        for (Map<String, Object> fc : functionCalls) {
                            String funcName = (String) fc.get("name");
                            @SuppressWarnings("unchecked")
                            Map<String, Object> args = (Map<String, Object>) fc.get("args");

                            Map<String, Object> toolReq = new HashMap<>();
                            toolReq.put("type", "tool_request");
                            toolReq.put("tool", funcName);
                            toolReq.put("args", args);

                            try {
                                String json = (objectMapper != null ? objectMapper.writeValueAsString(toolReq) : new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(toolReq));
                                sb.append("```tool_request\n").append(json).append("\n```\n\n");
                            } catch (Exception e) {
                                sb.append("Erro ao formatar ferramenta: ").append(e.getMessage()).append("\n");
                            }
                        }
                        return sb.toString().trim();
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

        if (request == null || request.getContext() == null || request.getContext().trim().isEmpty()) {
            return "";
        }

        try {
            RestTemplate restTemplate = new RestTemplate();
            
            // For autocomplete, we expect the context to be "PREFIX<CURSOR>SUFFIX"
            String prompt = "You are a code completion AI. Complete the code that belongs at [CURSOR] based on [PREFIX] and [SUFFIX]. Output ONLY the exact code completion to insert at [CURSOR]. DO NOT include explanations, comments, or markdown code fences (```). If no code should be completed, return nothing.\n\n"
                    + request.getContext();

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
                        String completion = extractAutocompleteText(body);
                        if (completion != null && !completion.isBlank()) {
                            logUsage(body, null, "user", "autocomplete", currentModel);
                            return completion;
                        }
                        return "";
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
            return "";
        }
    }

    @SuppressWarnings("unchecked")
    private String extractAutocompleteText(Map<?, ?> body) {
        if (body != null) {
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
            if (candidates != null && !candidates.isEmpty()) {
                Map<String, Object> contentMap = (Map<String, Object>) candidates.get(0).get("content");
                if (contentMap != null) {
                    List<Map<String, Object>> parts = (List<Map<String, Object>>) contentMap.get("parts");
                    if (parts != null && !parts.isEmpty()) {
                        StringBuilder sb = new StringBuilder();
                        for (Map<String, Object> part : parts) {
                            if (part != null && part.containsKey("text")) {
                                sb.append(part.get("text"));
                            }
                        }
                        String text = sb.toString();
                        if (text.startsWith("```")) {
                            int firstNewLine = text.indexOf('\n');
                            if (firstNewLine != -1) {
                                text = text.substring(firstNewLine + 1);
                            }
                            if (text.endsWith("```")) {
                                text = text.substring(0, text.length() - 3);
                            }
                        }
                        return text;
                    }
                }
            }
        }
        return "";
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
        // 1. batch_update_files
        Map<String, Object> batchUpdateFunc = new HashMap<>();
        batchUpdateFunc.put("name", "batch_update_files");
        batchUpdateFunc.put("description", "Cria ou atualiza múltiplos arquivos de uma só vez no workspace. Use esta ferramenta SEMPRE que for criar um projeto com 2 ou mais arquivos (ex: index.html, style.css, script.js, package.json).");
        Map<String, Object> batchParams = new HashMap<>();
        batchParams.put("type", "OBJECT");
        Map<String, Object> batchProps = new HashMap<>();
        
        Map<String, Object> filesArrayProp = new HashMap<>();
        filesArrayProp.put("type", "ARRAY");
        filesArrayProp.put("description", "Lista de arquivos a serem criados ou atualizados.");
        Map<String, Object> fileItemSchema = new HashMap<>();
        fileItemSchema.put("type", "OBJECT");
        Map<String, Object> fileItemProps = new HashMap<>();
        
        Map<String, Object> fPath = new HashMap<>();
        fPath.put("type", "STRING");
        fPath.put("description", "Caminho do arquivo (ex: package.json, index.html, src/App.js)");
        fileItemProps.put("path", fPath);

        Map<String, Object> fContent = new HashMap<>();
        fContent.put("type", "STRING");
        fContent.put("description", "Conteúdo completo do arquivo");
        fileItemProps.put("content", fContent);

        Map<String, Object> fDesc = new HashMap<>();
        fDesc.put("type", "STRING");
        fDesc.put("description", "Breve descrição do que este arquivo faz");
        fileItemProps.put("description", fDesc);

        fileItemSchema.put("properties", fileItemProps);
        fileItemSchema.put("required", Arrays.asList("path", "content"));
        filesArrayProp.put("items", fileItemSchema);
        batchProps.put("files", filesArrayProp);

        batchParams.put("properties", batchProps);
        batchParams.put("required", Collections.singletonList("files"));
        batchUpdateFunc.put("parameters", batchParams);

        // 2. update_file
        Map<String, Object> updateFileFunc = new HashMap<>();
        updateFileFunc.put("name", "update_file");
        updateFileFunc.put("description", "CRIA um NOVO arquivo ou ATUALIZA um arquivo existente no workspace do usuário.");
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

        // 3. read_file
        Map<String, Object> readFileFunc = new HashMap<>();
        readFileFunc.put("name", "read_file");
        readFileFunc.put("description", "Lê o conteúdo atual de um arquivo do workspace para inspecionar seu código ou diagnosticar erros.");
        Map<String, Object> readParams = new HashMap<>();
        readParams.put("type", "OBJECT");
        Map<String, Object> readProps = new HashMap<>();
        Map<String, Object> rPathProp = new HashMap<>();
        rPathProp.put("type", "STRING");
        rPathProp.put("description", "Caminho do arquivo a ser lido (ex: package.json)");
        readProps.put("path", rPathProp);
        readParams.put("properties", readProps);
        readParams.put("required", Collections.singletonList("path"));
        readFileFunc.put("parameters", readParams);

        // 4. run_terminal_command
        Map<String, Object> runTerminalFunc = new HashMap<>();
        runTerminalFunc.put("name", "run_terminal_command");
        runTerminalFunc.put("description", "Executa um comando no terminal do workspace do usuário (ex: npm install, npm start, node server.js).");
        Map<String, Object> termParams = new HashMap<>();
        termParams.put("type", "OBJECT");
        Map<String, Object> termProps = new HashMap<>();
        
        Map<String, Object> cmdProp = new HashMap<>();
        cmdProp.put("type", "STRING");
        cmdProp.put("description", "O comando a ser executado");
        termProps.put("command", cmdProp);

        Map<String, Object> tIdProp = new HashMap<>();
        tIdProp.put("type", "STRING");
        tIdProp.put("description", "Identificador do terminal (opcional, ex: 'main', '2', 'ai')");
        termProps.put("terminalId", tIdProp);
        
        termParams.put("properties", termProps);
        termParams.put("required", Collections.singletonList("command"));
        runTerminalFunc.put("parameters", termParams);

        Map<String, Object> decl = new HashMap<>();
        decl.put("functionDeclarations", Arrays.asList(batchUpdateFunc, updateFileFunc, readFileFunc, runTerminalFunc));
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
            } else if ("batch_update_files".equals(name)) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> files = (List<Map<String, Object>>) args.get("files");
                if (files == null || files.isEmpty())
                    return "Erro: lista de arquivos vazia.";

                int count = 0;
                for (Map<String, Object> f : files) {
                    String path = (String) f.get("path");
                    String content = (String) f.get("content");
                    if (path != null && content != null) {
                        treeSessionService.updateFileContent(sessionId, path, content);
                        count++;
                    }
                }
                return count + " arquivos criados/atualizados com sucesso!";
            } else if ("read_file".equals(name)) {
                String path = (String) args.get("path");
                if (path == null) return "Erro: caminho do arquivo não fornecido.";
                TreeNode root = treeSessionService.getTree(sessionId);
                TreeNode node = findNodeInTree(root, path);
                if (node != null && node.getContent() != null) {
                    return node.getContent();
                }
                return "Arquivo " + path + " não encontrado ou vazio.";
            }
            return "Erro: Função desconhecida.";
        } catch (Exception e) {
            return "Erro ao executar função: " + e.getMessage();
        }
    }

    private TreeNode findNodeInTree(TreeNode root, String path) {
        if (root == null || path == null) return null;
        String cleanPath = path.startsWith("/") ? path.substring(1) : path;
        String[] parts = cleanPath.split("/");
        TreeNode current = root;
        for (String part : parts) {
            if (part.isEmpty()) continue;
            if (current.getChildren() == null) return null;
            TreeNode match = null;
            for (TreeNode child : current.getChildren()) {
                if (part.equals(child.getName())) {
                    match = child;
                    break;
                }
            }
            if (match == null) return null;
            current = match;
        }
        return current;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractFunctionCalls(Map<?, ?> body) {
        List<Map<String, Object>> list = new ArrayList<>();
        if (body != null) {
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
            if (candidates != null && !candidates.isEmpty()) {
                Map<String, Object> contentMap = (Map<String, Object>) candidates.get(0).get("content");
                if (contentMap != null) {
                    List<Map<String, Object>> parts = (List<Map<String, Object>>) contentMap.get("parts");
                    if (parts != null) {
                        for (Map<String, Object> part : parts) {
                            if (part != null && part.containsKey("functionCall")) {
                                list.add((Map<String, Object>) part.get("functionCall"));
                            }
                        }
                    }
                }
            }
        }
        return list;
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
                        StringBuilder sb = new StringBuilder();
                        for (Map<String, Object> part : parts) {
                            if (part != null && part.containsKey("text")) {
                                sb.append(part.get("text")).append("\n");
                            }
                        }
                        return sb.toString().trim();
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
