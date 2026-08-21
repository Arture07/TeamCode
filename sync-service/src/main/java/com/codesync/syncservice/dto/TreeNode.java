package com.codesync.syncservice.dto;

import java.util.ArrayList;
import java.util.List;

public class TreeNode {
    private String name;            // Nome do nó (pasta ou ficheiro)
    private String type;            // "file" | "folder"
    private String content;         // Conteúdo (apenas se for ficheiro)
    private List<TreeNode> children;

    public TreeNode() {
    }

    public TreeNode(String name, String type, String content, List<TreeNode> children) {
        this.name = name;
        this.type = type;
        this.content = content;
        this.children = children;
    }

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public List<TreeNode> getChildren() {
        return children;
    }

    public void setChildren(List<TreeNode> children) {
        this.children = children;
    }
}
