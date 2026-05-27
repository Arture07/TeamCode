package com.codesync.syncservice.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TreeNode {
    private String name;            // Nome do nó (pasta ou ficheiro)
    private String type;            // "file" | "folder"
    private String content;         // Conteúdo (apenas se for ficheiro)
    private List<TreeNode> children;

    public static TreeNode folder(String name) {
        TreeNode n = new TreeNode();
        n.setName(name);
        n.setType("folder");
        n.setChildren(new ArrayList<>());
        return n;
    }

    public static TreeNode file(String name, String content) {
        TreeNode n = new TreeNode();
        n.setName(name);
        n.setType("file");
        n.setContent(content);
        return n;
    }
}
