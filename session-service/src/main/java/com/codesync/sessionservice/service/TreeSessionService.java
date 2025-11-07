package com.codesync.sessionservice.service;

import com.codesync.sessionservice.dto.FileData;
import com.codesync.sessionservice.dto.TreeNode;
import com.codesync.sessionservice.model.CodingSession;
import com.codesync.sessionservice.repository.CodingSessionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class TreeSessionService {

    private final CodingSessionRepository repo;
    private final ObjectMapper mapper;

    public TreeSessionService(CodingSessionRepository repo, ObjectMapper mapper) {
        this.repo = repo;
        this.mapper = mapper;
    }

    // -------- Core Loading / Migration --------
    private TreeNode loadRootAndMigrateIfNeeded(CodingSession session) throws Exception {
        String json = session.getFilesJson();
        if (json == null || json.isBlank()) {
            return TreeNode.folder("");
        }
        String trimmed = json.trim();
        if (trimmed.startsWith("[")) { // legacy flat list
            List<FileData> flat = mapper.readValue(trimmed, new TypeReference<List<FileData>>(){});
            TreeNode root = TreeConverter.flatListToTree(flat);
            // persist migrated tree
            session.setFilesJson(mapper.writeValueAsString(root));
            repo.save(session);
            return root;
        }
        // assume tree root JSON
        return mapper.readValue(trimmed, TreeNode.class);
    }

    private void persist(CodingSession session, TreeNode root) throws Exception {
        session.setFilesJson(mapper.writeValueAsString(root));
        repo.save(session);
    }
    // WebSocket events are handled by sync-service; session-service does not emit directly.

    private CodingSession getSession(String publicId) {
        return repo.findByPublicId(publicId).orElseThrow(() -> new NoSuchElementException("Sessão não encontrada"));
    }

    @Transactional(readOnly = true)
    public TreeNode getTree(String publicId) throws Exception {
        CodingSession s = getSession(publicId);
        return loadRootAndMigrateIfNeeded(s);
    }

    // -------- Path Helpers --------
    private List<String> splitPath(String path) {
        String p = path.replaceAll("/+","/").replaceAll("^/+|/+$","" );
        if (p.isEmpty()) return new ArrayList<>();
        return Arrays.asList(p.split("/"));
    }

    private TreeNode ensureFolder(TreeNode root, List<String> parts) {
        TreeNode current = root;
        for (String part : parts) {
            TreeNode next = null;
            if (current.getChildren() == null) current.setChildren(new ArrayList<>());
            for (TreeNode c : current.getChildren()) {
                if (c.getName().equals(part) && "folder".equals(c.getType())) { next = c; break; }
            }
            if (next == null) {
                next = TreeNode.folder(part);
                current.getChildren().add(next);
            }
            current = next;
        }
        return current;
    }

    private Optional<TreeNode> findChild(TreeNode parent, String name) {
        if (parent.getChildren() == null) return Optional.empty();
        return parent.getChildren().stream().filter(c -> c.getName().equals(name)).findFirst();
    }

    private TreeNode findParent(TreeNode root, List<String> parts) {
        if (parts.isEmpty()) return root; // parent of root is root
        TreeNode current = root;
        for (int i=0;i<parts.size()-1;i++) {
            String seg = parts.get(i);
            Optional<TreeNode> next = findChild(current, seg);
            if (next.isEmpty() || !"folder".equals(next.get().getType())) {
                throw new NoSuchElementException("Pasta não encontrada: " + seg);
            }
            current = next.get();
        }
        return current;
    }

    private boolean isAncestorPath(List<String> ancestor, List<String> candidate) {
        if (ancestor.size() >= candidate.size()) return false;
        for (int i=0;i<ancestor.size();i++) {
            if (!ancestor.get(i).equals(candidate.get(i))) return false;
        }
        return true;
    }

    private String uniqueCopyName(TreeNode parent, String baseName) {
        // Ensures no conflict in the parent: baseName-copy, baseName-copy 2, ...
        int i = 1;
        while (true) {
            String candidate = (i == 1) ? baseName + "-copy" : baseName + "-copy " + i;
            boolean exists = false;
            if (parent.getChildren() != null) {
                for (TreeNode c : parent.getChildren()) {
                    if (candidate.equals(c.getName())) { exists = true; break; }
                }
            }
            if (!exists) return candidate;
            i++;
        }
    }

    private TreeNode deepClone(TreeNode node) {
        TreeNode copy = new TreeNode();
        copy.setName(node.getName());
        copy.setType(node.getType());
        copy.setContent(node.getContent());
        if ("folder".equals(node.getType())) {
            copy.setChildren(new ArrayList<>());
            if (node.getChildren() != null) {
                for (TreeNode c : node.getChildren()) {
                    TreeNode cc = deepClone(c);
                    copy.getChildren().add(cc);
                }
            }
        }
        return copy;
    }

    // -------- Operations --------
    @Transactional
    public void createNode(String publicId, String path, String type, String content) throws Exception {
        if (path == null || path.isBlank()) throw new IllegalArgumentException("path vazio");
        CodingSession s = getSession(publicId);
        TreeNode root = loadRootAndMigrateIfNeeded(s);
        List<String> parts = splitPath(path);
        if (parts.isEmpty()) throw new IllegalArgumentException("Não pode criar root");
        TreeNode parent = findParent(root, parts);
        String name = parts.get(parts.size()-1);
        // check duplicate
        if (parent.getChildren()!=null && parent.getChildren().stream().anyMatch(c -> c.getName().equals(name))) {
            throw new IllegalStateException("Já existe nó com esse nome");
        }
        if (parent.getChildren()==null) parent.setChildren(new ArrayList<>());
        if ("folder".equals(type)) parent.getChildren().add(TreeNode.folder(name));
        else parent.getChildren().add(TreeNode.file(name, content==null?"":content));
        persist(s, root);
    }

    @Transactional
    public void updateFileContent(String publicId, String path, String content) throws Exception {
        CodingSession s = getSession(publicId);
        TreeNode root = loadRootAndMigrateIfNeeded(s);
        List<String> parts = splitPath(path);
        TreeNode parent = findParent(root, parts);
        String name = parts.isEmpty()?"":parts.get(parts.size()-1);
        Optional<TreeNode> node = findChild(parent, name);
        if (node.isEmpty() || !"file".equals(node.get().getType())) throw new NoSuchElementException("Ficheiro não encontrado");
        node.get().setContent(content);
        persist(s, root);
    }

    @Transactional
    public void deleteNode(String publicId, String path) throws Exception {
        CodingSession s = getSession(publicId);
        TreeNode root = loadRootAndMigrateIfNeeded(s);
        List<String> parts = splitPath(path);
        if (parts.isEmpty()) throw new IllegalArgumentException("Não pode apagar root");
        TreeNode parent = findParent(root, parts);
        String name = parts.get(parts.size()-1);
        if (parent.getChildren()==null || !parent.getChildren().removeIf(c -> c.getName().equals(name))) {
            throw new NoSuchElementException("Nó não encontrado");
        }
        persist(s, root);
    }

    @Transactional
    public void renameNode(String publicId, String path, String newName) throws Exception {
        if (newName == null || newName.isBlank()) throw new IllegalArgumentException("novo nome vazio");
        CodingSession s = getSession(publicId);
        TreeNode root = loadRootAndMigrateIfNeeded(s);
        List<String> parts = splitPath(path);
        if (parts.isEmpty()) throw new IllegalArgumentException("Root não pode ser renomeado");
        TreeNode parent = findParent(root, parts);
        String old = parts.get(parts.size()-1);
        Optional<TreeNode> node = findChild(parent, old);
        if (node.isEmpty()) throw new NoSuchElementException("Nó não encontrado");
        if (parent.getChildren().stream().anyMatch(c -> c.getName().equals(newName))) {
            throw new IllegalStateException("Conflito: já existe nome");
        }
        node.get().setName(newName);
        persist(s, root);
    }

    @Transactional
    public void moveNode(String publicId, String from, String toFolder) throws Exception {
        CodingSession s = getSession(publicId);
        TreeNode root = loadRootAndMigrateIfNeeded(s);
        List<String> fromParts = splitPath(from);
        if (fromParts.isEmpty()) throw new IllegalArgumentException("Não pode mover root");
        List<String> destParts = splitPath(toFolder);
        // detect cycle if moving folder into its subfolder
        if (isAncestorPath(fromParts, destParts)) throw new IllegalArgumentException("Destino é subpath da origem");
        TreeNode fromParent = findParent(root, fromParts);
        String name = fromParts.get(fromParts.size()-1);
        Optional<TreeNode> nodeOpt = findChild(fromParent, name);
        if (nodeOpt.isEmpty()) throw new NoSuchElementException("Origem não encontrada");
        TreeNode node = nodeOpt.get();
        TreeNode destFolderNode = destParts.isEmpty()?root:ensureFolder(root, destParts); // auto-create dest path
        if (destFolderNode.getChildren()==null) destFolderNode.setChildren(new ArrayList<>());
        // check conflict
        if (destFolderNode.getChildren().stream().anyMatch(c -> c.getName().equals(node.getName()))) {
            throw new IllegalStateException("Conflito destino");
        }
        // remove from old parent
        fromParent.getChildren().remove(node);
        destFolderNode.getChildren().add(node);
        persist(s, root);
    }

    @Transactional
    public String duplicateNode(String publicId, String path, String targetName) throws Exception {
        if (path == null || path.isBlank()) throw new IllegalArgumentException("path vazio");
        CodingSession s = getSession(publicId);
        TreeNode root = loadRootAndMigrateIfNeeded(s);
        List<String> parts = splitPath(path);
    if (parts.isEmpty()) throw new IllegalArgumentException("Caminho inválido");
        TreeNode parent = findParent(root, parts);
        String name = parts.get(parts.size()-1);
        Optional<TreeNode> nodeOpt = findChild(parent, name);
    if (nodeOpt.isEmpty()) throw new NoSuchElementException("Nó não encontrado");
        TreeNode original = nodeOpt.get();

        if (parent.getChildren() == null) parent.setChildren(new ArrayList<>());
        String newName = (targetName != null && !targetName.isBlank()) ? targetName : uniqueCopyName(parent, name);
        if (parent.getChildren().stream().anyMatch(c -> c.getName().equals(newName))) {
            throw new IllegalStateException("Conflito: já existe destino");
        }

        TreeNode clone = deepClone(original);
        clone.setName(newName);
        parent.getChildren().add(clone);
        persist(s, root);

        // return new relative path
        if (parts.size() == 1) return newName;
        return String.join("/", parts.subList(0, parts.size()-1)) + "/" + newName;
    }
}
