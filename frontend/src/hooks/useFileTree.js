/**
 * useFileTree - Encapsulates file tree CRUD operations.
 * 
 * Manages loading the tree, creating/deleting/renaming/moving/duplicating files.
 * All operations communicate with the backend REST API.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import { getAuthHeaders } from '../utils/auth';

/**
 * @param {Object} params
 * @param {string} params.sessionId - Session ID
 * @param {Function} params.publishTreeEvent - Publishes tree events via WebSocket
 * @param {Function} params.toast - Toast notification instance
 * @param {string|null} params.activeFile - Currently active file path
 * @param {Function} params.setActiveFile - Setter for active file
 * @param {Function} params.setOpenFiles - Setter for open files list
 */
export function useFileTree({
  sessionId,
  publishTreeEvent,
  toast,
  activeFile,
  setActiveFile,
  setOpenFiles,
}) {
  const [treeRoot, setTreeRoot] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, path: null, isFolder: false });
  const [renameState, setRenameState] = useState({ open: false, path: null });
  const selectionStashRef = useRef(new Set());

  const loadTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/tree/${sessionId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(`Árvore não encontrada (${res.status})`);
      const data = await res.json();
      setTreeRoot(data.tree || { name: '', type: 'folder', children: [] });
    } catch (err) {
      console.error('Erro ao carregar árvore', err);
    }
  }, [sessionId]);

  // Helper: find node in tree by path
  const findNodeInTree = useCallback((root, path) => {
    if (!root || !path) return null;
    const parts = path.split('/').filter(Boolean);
    let current = root;
    for (const part of parts) {
      if (current.type !== 'folder' || !Array.isArray(current.children)) return null;
      current = current.children.find((c) => c.name === part);
      if (!current) return null;
    }
    return current;
  }, []);

  // Update content of a node in the local tree without re-fetching
  const updateLocalTreeContent = useCallback((path, newContent) => {
    setTreeRoot((prev) => {
      if (!prev) return prev;
      try {
        const clone = JSON.parse(JSON.stringify(prev));
        const node = findNodeInTree(clone, path);
        if (node) node.content = newContent;
        return clone;
      } catch (e) {
        console.error('Error updating local tree', e);
        return prev;
      }
    });
  }, [findNodeInTree]);

  // Compute folder names for parent-folder dropdown
  const folderNames = useMemo(() => {
    const names = [];
    const walk = (node, prefix) => {
      if (!node) return;
      const path = prefix ? `${prefix}/${node.name}` : node.name;
      if (node.type === 'folder') {
        if (node.name) names.push(path);
        (node.children || []).forEach((c) => walk(c, path));
      }
    };
    if (treeRoot) (treeRoot.children || []).forEach((c) => walk(c, ''));
    return names;
  }, [treeRoot]);

  const requestDelete = useCallback((nameOrArray) => {
    if (!nameOrArray) return;
    const names = Array.isArray(nameOrArray) ? nameOrArray : [nameOrArray];
    selectionStashRef.current = new Set(names);
    const first = names[0];
    const isFolder = !first.split('/').pop().includes('.');
    setConfirmState({ open: true, path: first, isFolder });
  }, []);

  const confirmDelete = useCallback(async () => {
    const items =
      selectionStashRef.current && selectionStashRef.current.size
        ? Array.from(selectionStashRef.current)
        : confirmState.path
          ? [confirmState.path]
          : [];
    setConfirmState({ open: false, path: null, isFolder: false });
    if (!items.length) return;
    try {
      for (const name of items) {
        const encoded = encodeURIComponent(name);
        await fetch(`/api/tree/${sessionId}?path=${encoded}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (activeFile === name) {
          setActiveFile(null);
          setOpenFiles((prev) => prev.filter((p) => p !== name));
        }
      }
    } catch (err) {
      console.error('Erro ao apagar (lote)', err);
    } finally {
      selectionStashRef.current = new Set();
      await loadTree();
      publishTreeEvent(
        items.length > 1 ? 'REFRESH' : 'DELETED',
        items.length === 1 ? items[0] : undefined,
      );
    }
  }, [confirmState.path, sessionId, activeFile, setActiveFile, setOpenFiles, loadTree, publishTreeEvent]);

  const openRename = useCallback((path) => setRenameState({ open: true, path }), []);

  const submitRename = useCallback(async (newName) => {
    const path = renameState.path;
    setRenameState({ open: false, path: null });
    const base = path.split('/').pop();
    if (!newName || newName === base) return;
    try {
      const res = await fetch(`/api/tree/${sessionId}/rename`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ path, newName }),
      });
      if (!res.ok) {
        toast.error('Falha ao renomear');
      } else {
        await loadTree();
        const parent = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
        const newPath = parent ? `${parent}/${newName}` : newName;
        setOpenFiles((prev) => prev.map((f) => (f === path ? newPath : f)));
        if (activeFile === path) setActiveFile(newPath);
        publishTreeEvent('RENAMED', path, newPath);
        toast.success(`Renomeado para "${newName}"`);
      }
    } catch (e) {
      toast.error('Erro de rede ao renomear');
    }
  }, [renameState.path, sessionId, activeFile, setActiveFile, setOpenFiles, loadTree, publishTreeEvent, toast]);

  const duplicateFolder = useCallback(async (sourcePath, targetName) => {
    try {
      const res = await fetch(`/api/tree/${sessionId}/duplicate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ path: sourcePath, targetName }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => 'Falha ao duplicar'));
      const data = await res.json().catch(() => ({}));
      await loadTree();
      publishTreeEvent('DUPLICATED', sourcePath, data.newPath);
    } catch (e) {
      console.error('duplicate folder failed', e);
      toast.error('Falha ao duplicar o item.');
    }
  }, [sessionId, loadTree, publishTreeEvent, toast]);

  const handleMoveFile = useCallback(async (name, destFolder) => {
    if (!name || destFolder === undefined) return;
    try {
      const body = { from: name, to: destFolder };
      const res = await fetch(`/api/tree/${sessionId}/move`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Move failed');
      await loadTree();
      const newPath = destFolder
        ? `${destFolder}/${name.split('/').pop()}`
        : name.split('/').pop();
      publishTreeEvent('MOVED', name, newPath);
    } catch (err) {
      console.error('Move failed', err);
      await loadTree();
    }
  }, [sessionId, loadTree, publishTreeEvent]);

  const handleCreateFile = useCallback(async (fileInfo, handleFileClick) => {
    if (!fileInfo?.name) return;
    try {
      if (fileInfo.type === 'folder') {
        const payload = {
          path: fileInfo.name.replace(/\/+$/, ''),
          type: 'folder',
        };
        const response = await fetch(`/api/tree/${sessionId}`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          toast.error(`Erro ao criar pasta: ${await response.text().catch(() => '')}`);
        }
        await loadTree();
        publishTreeEvent('CREATED', payload.path);
      } else {
        const payload = {
          path: fileInfo.name,
          type: 'file',
          content: `// Arquivo: ${fileInfo.name}\n`,
        };
        const response = await fetch(`/api/tree/${sessionId}`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          toast.error(`Erro ao criar arquivo: ${await response.text().catch(() => '')}`);
        }
        await loadTree();
        handleFileClick?.(fileInfo.name);
        publishTreeEvent('CREATED', payload.path);
      }
    } catch (err) {
      toast.error('Não foi possível criar o arquivo/pasta.');
    }
  }, [sessionId, loadTree, publishTreeEvent, toast]);

  return {
    treeRoot,
    setTreeRoot,
    loadTree,
    findNodeInTree,
    updateLocalTreeContent,
    folderNames,
    confirmState,
    setConfirmState,
    requestDelete,
    confirmDelete,
    renameState,
    setRenameState,
    openRename,
    submitRename,
    duplicateFolder,
    handleMoveFile,
    handleCreateFile,
  };
}
