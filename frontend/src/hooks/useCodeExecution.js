/**
 * useCodeExecution - Encapsulates code execution, file formatting, search, 
 * upload, download, and drag-and-drop operations.
 */
import { useState, useCallback, useRef } from 'react';
import { getAuthHeaders } from '../utils/auth';
import prettier from 'prettier/standalone';
import parserBabel from 'prettier/plugins/babel';
import parserHtml from 'prettier/plugins/html';
import parserCss from 'prettier/plugins/postcss';
import parserEstree from 'prettier/plugins/estree';

/**
 * @param {Object} params
 * @param {string} params.sessionId - Session ID
 * @param {Function} params.toast - Toast notification instance
 * @param {React.MutableRefObject} params.stompClientRef - Ref to STOMP client
 * @param {React.MutableRefObject} params.editorRef - Ref to Monaco editor
 * @param {Function} params.loadTree - Function to reload the file tree
 */
export function useCodeExecution({
  sessionId,
  toast,
  stompClientRef,
  editorRef,
  loadTree,
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleRunFile = useCallback((filePath, editorContent, terminalMinimized, setTerminalMinimized, setTerminalOutput) => {
    if (!filePath || isRunning) return;

    setIsRunning(true);
    const timestamp = new Date().toLocaleTimeString();
    setTerminalOutput?.((prev) => [
      ...prev,
      { timestamp, message: `Executando: ${filePath}`, type: 'info' },
    ]);

    setTimeout(() => setIsRunning(false), 3000);

    const content = editorContent || '';
    const ext = filePath.split('.').pop().toLowerCase();
    const fileName = filePath.split('/').pop();
    let command = '';

    switch (ext) {
      case 'js':
        command = `node ${fileName}`;
        break;
      case 'py':
        command = `python3 -u ${fileName}`;
        break;
      case 'java': {
        const className = fileName.replace(/\.java$/, '');
        command = `javac ${fileName} && java ${className}`;
        break;
      }
      case 'c': {
        const cOut = fileName.replace(/\.c$/, '') + '.out';
        command = `gcc ${fileName} -o ${cOut} && ./${cOut}`;
        break;
      }
      case 'cpp':
      case 'cc': {
        const cppOut = fileName.replace(/\.(cpp|cc)$/, '') + '.out';
        command = `g++ ${fileName} -o ${cppOut} && ./${cppOut}`;
        break;
      }
      case 'rb':
        command = `ruby ${fileName}`;
        break;
      case 'go':
        command = `go run ${fileName}`;
        break;
      case 'rs':
        command = `rustc ${fileName} && ./${fileName.replace(/\.rs$/, '')}`;
        break;
      case 'sh':
        command = `bash ${fileName}`;
        break;
      case 'ts':
        command = `ts-node ${fileName}`;
        break;
      default:
        toast.warning(`Tipo de arquivo não suportado: .${ext}`);
        setIsRunning(false);
        return;
    }

    try {
      const client = stompClientRef.current;
      if (!client?.connected) {
        toast.error('WebSocket desconectado. Recarregue a página.');
        return;
      }
      client.publish({
        destination: `/app/execute/${sessionId}`,
        body: JSON.stringify({ command, fileName, content }),
      });
      if (terminalMinimized) setTerminalMinimized?.(false);
    } catch (e) {
      console.error('Failed to send run command', e);
      toast.error('Falha ao executar o arquivo.');
    }
  }, [isRunning, sessionId, stompClientRef, toast]);

  const formatCode = useCallback(async (activeFile, editorContent, setEditorContent) => {
    if (!editorRef.current || !activeFile) return;
    const currentCode = editorRef.current.getValue();
    const ext = activeFile.split('.').pop();
    let parser = null;
    let plugins = [];

    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        parser = 'babel';
        plugins = [parserBabel, parserEstree];
        break;
      case 'html':
        parser = 'html';
        plugins = [parserHtml];
        break;
      case 'css':
        parser = 'css';
        plugins = [parserCss];
        break;
      case 'json':
        parser = 'json';
        plugins = [parserBabel];
        break;
      default:
        toast.warning('Formatação não suportada para este arquivo.');
        return;
    }

    try {
      const formatted = await prettier.format(currentCode, {
        parser,
        plugins,
        singleQuote: true,
      });
      editorRef.current.setValue(formatted);
      setEditorContent?.(formatted);
    } catch (e) {
      console.error('Format failed', e);
      toast.error('Erro ao formatar: ' + e.message);
    }
  }, [editorRef, toast]);

  const handleSearch = useCallback(async (query) => {
    try {
      const res = await fetch(
        `/api/tree/${sessionId}/search?query=${encodeURIComponent(query)}`,
        { headers: getAuthHeaders() },
      );
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data);
    } catch (e) {
      console.error(e);
      toast.error('Erro na busca');
    }
  }, [sessionId, toast]);

  const handleDownloadProject = useCallback(() => {
    window.open(`/api/tree/${sessionId}/download`, '_blank');
  }, [sessionId]);

  const handleUploadFile = useCallback(async (e) => {
    const file = e.target ? e.target.files[0] : e;
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', '');

    try {
      const res = await fetch(`/api/tree/${sessionId}/upload`, {
        method: 'POST',
        headers: { Authorization: getAuthHeaders()['Authorization'] },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      await loadTree();
      toast.success('Arquivo enviado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar arquivo');
    } finally {
      if (e.target) e.target.value = null;
    }
  }, [sessionId, loadTree, toast]);

  // Drag & Drop handlers for sidebar
  const handleSidebarDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleSidebarDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleSidebarDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    for (const file of files) {
      await handleUploadFile(file);
    }
  }, [handleUploadFile]);

  return {
    isRunning,
    searchResults,
    isDraggingOver,
    fileInputRef,
    handleRunFile,
    formatCode,
    handleSearch,
    handleDownloadProject,
    handleUploadFile,
    handleSidebarDragOver,
    handleSidebarDragLeave,
    handleSidebarDrop,
  };
}
