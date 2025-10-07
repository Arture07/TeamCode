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

            // Support folder entries: either explicitly marked or name ends with '/'
            boolean isFolder = Boolean.TRUE.equals(newFile.isFolder()) || (newFile.getName() != null && newFile.getName().endsWith("/"));

            String normalizedName = newFile.getName();
            if (isFolder && !normalizedName.endsWith("/")) {
                normalizedName = normalizedName + "/";
                newFile.setName(normalizedName);
                newFile.setFolder(true);
            }

            // normalizedName may be reassigned above; make an effectively-final copy for use in lambdas
            final String nameToCheck = normalizedName;
            boolean fileExists = files.stream().anyMatch(f -> f.getName().equalsIgnoreCase(nameToCheck));
            if (fileExists) {
                throw new RuntimeException("Um ficheiro ou pasta com o nome '" + normalizedName + "' já existe.");
            }

            // For folder entries, we keep content null and flag folder=true
            if (isFolder) {
                FileData folderEntry = new FileData(normalizedName, "", true);
                files.add(folderEntry);
            } else {
                files.add(newFile);
            }
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

    @Transactional
    public void deleteFile(String publicId, String name) throws JsonProcessingException {
        CodingSession session = sessionRepository.findByPublicId(publicId)
                .orElseThrow(() -> new RuntimeException("Sessão não encontrada com o ID: " + publicId));

        List<FileData> files;
        String currentFilesJson = session.getFilesJson();

        if (currentFilesJson == null || currentFilesJson.isBlank()) {
            throw new RuntimeException("Não foram encontrados ficheiros nesta sessão.");
        } else {
            files = new ArrayList<>(objectMapper.readValue(currentFilesJson, new TypeReference<List<FileData>>() {}));
        }

        boolean removed = files.removeIf(f -> f.getName().equalsIgnoreCase(name));
        if (!removed) {
            throw new RuntimeException("Ficheiro não encontrado na sessão: " + name);
        }

        session.setFilesJson(objectMapper.writeValueAsString(files));
        sessionRepository.save(session);
    }

    @Transactional
    public void moveFile(String publicId, String fileName, String destFolder) throws JsonProcessingException {
        if (destFolder == null) throw new IllegalArgumentException("Destino inválido");
        CodingSession session = sessionRepository.findByPublicId(publicId)
                .orElseThrow(() -> new RuntimeException("Sessão não encontrada com o ID: " + publicId));

        List<FileData> files;
        String currentFilesJson = session.getFilesJson();

        if (currentFilesJson == null || currentFilesJson.isBlank()) {
            throw new RuntimeException("Não foram encontrados ficheiros nesta sessão.");
        } else {
            files = new ArrayList<>(objectMapper.readValue(currentFilesJson, new TypeReference<List<FileData>>() {}));
        }

        Optional<FileData> maybe = files.stream().filter(f -> f.getName().equalsIgnoreCase(fileName)).findFirst();
        if (maybe.isEmpty()) throw new RuntimeException("Ficheiro não encontrado: " + fileName);

        FileData fd = maybe.get();
        if (fd.getName().endsWith("/")) throw new IllegalArgumentException("Cannot move a folder with this endpoint.");

        // compute new name
    String base = fd.getName().contains("/") ? fd.getName().substring(fd.getName().lastIndexOf('/')+1) : fd.getName();
        String newName = destFolder.replaceAll("/+$","") + "/" + base;

        // ensure no conflict
        boolean exists = files.stream().anyMatch(f -> f.getName().equalsIgnoreCase(newName));
        if (exists) throw new RuntimeException("Já existe um ficheiro com esse nome no destino: " + newName);

        fd.setName(newName);

        session.setFilesJson(objectMapper.writeValueAsString(files));
        sessionRepository.save(session);
    }
}
