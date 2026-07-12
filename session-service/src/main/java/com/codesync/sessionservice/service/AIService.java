package com.codesync.sessionservice.service;

import com.codesync.sessionservice.dto.AIRequest;
import com.codesync.sessionservice.dto.TreeNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class AIService {

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.model:gemini-1.5-pro}")
    private String modelName;

    @Autowired
    private TreeSessionService treeSessionService;

    private static final String BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

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
                prompt += "7. **MODO AGENTE ATIVADO**: Você tem acesso a ferramentas para alterar os arquivos do usuário diretamente! Se o usuário pedir para criar, alterar ou deletar um arquivo, use as funções disponíveis para fazer isso. Após chamar a função, avise o usuário que o arquivo foi modificado no workspace.\n";
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
            contents.add(userContent);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("contents", contents);

            if ("agent".equalsIgnoreCase(mode)) {
                requestBody.put("tools", buildTools());
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            String url = BASE_URL + modelName + ":generateContent?key=" + apiKey;
            ResponseEntity<Map> response = restTemplate.postForEntity(url, entity, Map.class);
            Map<?, ?> body = response.getBody();

            // Check if function call
            Map<String, Object> functionCall = extractFunctionCall(body);
            if (functionCall != null) {
                String funcName = (String) functionCall.get("name");
                @SuppressWarnings("unchecked")
                Map<String, Object> args = (Map<String, Object>) functionCall.get("args");

                String funcResult = executeTool(funcName, args, sessionId);

                // Extract the exact content block from the model's response to preserve
                // thought_signatures
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> candidates = (List<Map<String, Object>>) body.get("candidates");
                @SuppressWarnings("unchecked")
                Map<String, Object> modelContent = (Map<String, Object>) candidates.get(0).get("content");
                contents.add(modelContent);

                Map<String, Object> funcRespPart = new HashMap<>();
                Map<String, Object> funcResp = new HashMap<>();
                funcResp.put("name", funcName);
                funcResp.put("response", Collections.singletonMap("result", funcResult));
                funcRespPart.put("functionResponse", funcResp);

                Map<String, Object> funcUserContent = new HashMap<>();
                funcUserContent.put("role", "user");
                funcUserContent.put("parts", Collections.singletonList(funcRespPart));
                contents.add(funcUserContent);

                entity = new HttpEntity<>(requestBody, headers);
                response = restTemplate.postForEntity(url, entity, Map.class);
                body = response.getBody();
            }

            return extractText(body);

        } catch (Exception e) {
            e.printStackTrace();
            return "Erro ao comunicar com a IA: " + e.getMessage();
        }
    }

    private List<Map<String, Object>> buildTools() {
        Map<String, Object> updateFileFunc = new HashMap<>();
        updateFileFunc.put("name", "update_file");
        updateFileFunc.put("description",
                "Cria ou atualiza um arquivo no workspace do usuário com o conteúdo fornecido. Use esta ferramenta quando o usuário pedir para implementar código.");
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

        Map<String, Object> decl = new HashMap<>();
        decl.put("functionDeclarations", Collections.singletonList(updateFileFunc));
        return Collections.singletonList(decl);
    }

    private String executeTool(String name, Map<String, Object> args, String sessionId) {
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
