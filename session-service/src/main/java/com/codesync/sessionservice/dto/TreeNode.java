package com.codesync.sessionservice.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TreeNode {
    private String name;            // node name only (no path separators)
    private String type;            // "file" | "folder"
    private String content;         // only for files
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
