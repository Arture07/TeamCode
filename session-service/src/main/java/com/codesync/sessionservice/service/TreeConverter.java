package com.codesync.sessionservice.service;

import com.codesync.sessionservice.dto.FileData;
import com.codesync.sessionservice.dto.TreeNode;

import java.util.*;

public class TreeConverter {

    public static TreeNode flatListToTree(List<FileData> flat) {
        TreeNode root = TreeNode.folder("");
        if (flat == null) return root;
        for (FileData f : flat) {
            if (f == null || f.getName() == null) continue;
            String path = f.getName();
            boolean isFolder = f.isFolder() || path.endsWith("/");
            if (isFolder && !path.endsWith("/")) path = path + "/";
            // split path ignoring trailing slash for folders
            String trimmed = isFolder ? path.replaceAll("/+$/", "") : path;
            String[] parts = trimmed.split("/");
            TreeNode current = root;
            for (int i = 0; i < parts.length; i++) {
                String part = parts[i];
                boolean last = (i == parts.length - 1);
                if (last) {
                    if (isFolder) {
                        ensureFolderChild(current, part); // ensure folder
                    } else {
                        // ensure children list before adding a file
                        if (current.getChildren() == null) current.setChildren(new ArrayList<>());
                        current.getChildren().add(TreeNode.file(part, f.getContent()));
                    }
                } else {
                    current = ensureFolderChild(current, part);
                }
            }
        }
        return root;
    }

    public static List<FileData> treeToFlatList(TreeNode root) {
        List<FileData> result = new ArrayList<>();
        if (root == null || root.getChildren() == null) return result;
        walk(root, "", result);
        return result;
    }

    private static void walk(TreeNode node, String prefix, List<FileData> out) {
        if (node.getChildren() == null) return;
        for (TreeNode child : node.getChildren()) {
            String path = prefix.isEmpty() ? child.getName() : prefix + "/" + child.getName();
            if ("folder".equals(child.getType())) {
                out.add(new FileData(path + "/", null, true));
                walk(child, path, out);
            } else {
                out.add(new FileData(path, child.getContent(), false));
            }
        }
    }

    private static TreeNode ensureFolderChild(TreeNode parent, String name) {
        if (parent.getChildren() == null) parent.setChildren(new ArrayList<>());
        for (TreeNode c : parent.getChildren()) {
            if (c.getName().equals(name) && "folder".equals(c.getType())) return c;
        }
        TreeNode created = TreeNode.folder(name);
        parent.getChildren().add(created);
        return created;
    }

    // no-op helper removed
}
