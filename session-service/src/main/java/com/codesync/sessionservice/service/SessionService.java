package com.codesync.sessionservice.service;

import com.codesync.sessionservice.dto.FileData;
import com.codesync.sessionservice.model.CodingSession;
import com.codesync.sessionservice.repository.CodingSessionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.codesync.sessionservice.dto.UpdateFileRequest;

import java.util.*;

@Service
public class SessionService {

    private final CodingSessionRepository sessionRepository;
    private final ObjectMapper objectMapper;

    public SessionService(CodingSessionRepository sessionRepository, ObjectMapper objectMapper) {
        this.sessionRepository = sessionRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> getSessionByPublicId(String publicId) {
        return sessionRepository.findByPublicId(publicId)
                .map(session -> {
                    try {
                        List<FileData> files = new ArrayList<>();
                        if (session.getFilesJson() != null && !session.getFilesJson().isBlank()) {
                            files = objectMapper.readValue(session.getFilesJson(), new TypeReference<List<FileData>>() {});
                        }

                        Map<String, Object> result = new HashMap<>();
                        result.put("publicId", session.getPublicId());
                        // permite sessionName ser null (retorna null ou string vazia conforme preferires)
                        result.put("sessionName", session.getSessionName());
                        result.put("files", files);
                        return result;
                    } catch (JsonProcessingException e) {
                        throw new RuntimeException("Falha ao analisar os ficheiros da sessão.", e);
                    }
                });
    }




    @Transactional
    public FileData createFileForSession(String publicId, FileData newFile) {
        try {
            CodingSession session = sessionRepository.findByPublicId(publicId)
                    .orElseThrow(() -> new RuntimeException("Sessão não encontrada com o ID: " + publicId));

            List<FileData> files;
            String currentFilesJson = session.getFilesJson();

            if (currentFilesJson == null || currentFilesJson.isBlank()) {
                files = new ArrayList<>();
            } else {
                files = new ArrayList<>(objectMapper.readValue(currentFilesJson, new TypeReference<List<FileData>>() {}));
            }

            boolean fileExists = files.stream().anyMatch(f -> f.getName().equalsIgnoreCase(newFile.getName()));
            if (fileExists) {
                throw new RuntimeException("Um ficheiro com o nome '" + newFile.getName() + "' já existe.");
            }

            files.add(newFile);
            session.setFilesJson(objectMapper.writeValueAsString(files));
            sessionRepository.save(session);
            return newFile;
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Erro ao processar os dados do ficheiro.", e);
        }
    }

    @Transactional
    public CodingSession createSession(CodingSession session) {
        return sessionRepository.save(session);
    }

    @Transactional
    public void updateFileContent(String publicId, UpdateFileRequest request) throws JsonProcessingException {
        CodingSession session = sessionRepository.findByPublicId(publicId)
                .orElseThrow(() -> new RuntimeException("Sessão não encontrada com o ID: " + publicId));

        List<FileData> files;
        String currentFilesJson = session.getFilesJson();

        if (currentFilesJson == null || currentFilesJson.isBlank()) {
            // Isto não deveria acontecer se o ficheiro existe, mas é uma segurança extra.
            throw new RuntimeException("Não foram encontrados ficheiros nesta sessão.");
        } else {
            files = new ArrayList<>(objectMapper.readValue(currentFilesJson, new TypeReference<List<FileData>>() {}));
        }

        // Encontra o ficheiro na lista e atualiza o seu conteúdo.
        boolean fileUpdated = false;
        for (FileData file : files) {
            if (file.getName().equalsIgnoreCase(request.getName())) {
                file.setContent(request.getContent());
                fileUpdated = true;
                break;
            }
        }

        if (!fileUpdated) {
            throw new RuntimeException("Ficheiro não encontrado na sessão: " + request.getName());
        }

        // Salva a lista de ficheiros atualizada de volta na base de dados.
        session.setFilesJson(objectMapper.writeValueAsString(files));
        sessionRepository.save(session);
    }
}
