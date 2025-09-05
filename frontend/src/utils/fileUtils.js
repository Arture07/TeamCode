// frontend/src/utils/fileUtils.js
// Utilitários simples para mapear extensões -> linguagem e lista de linguagens para o modal.

export function getLanguageFromExtension(fileName) {
    if (!fileName) return 'plaintext';
    const base = String(fileName);
    const lower = base.toLowerCase();

    // nomes especiais
    if (lower === 'dockerfile') return 'dockerfile';
    if (lower === 'makefile' || lower.endsWith('.mk')) return 'makefile';

    const parts = lower.split('.');
    if (parts.length === 1) return 'plaintext';
    const ext = parts.pop();

    switch (ext) {
        case 'js': case 'mjs': case 'cjs': return 'javascript';
        case 'jsx': return 'javascript';
        case 'ts': case 'tsx': return 'typescript';
        case 'py': return 'python';
        case 'java': return 'java';
        case 'html': case 'htm': return 'html';
        case 'css': return 'css';
        case 'json': return 'json';
        case 'md': return 'markdown';
        case 'rb': return 'ruby';
        case 'go': return 'go';
        case 'rs': return 'rust';
        case 'kt': case 'kts': return 'kotlin';
        case 'swift': return 'swift';
        case 'sh': case 'bash': case 'zsh': return 'shell';
        case 'ps1': return 'powershell';
        case 'yml': case 'yaml': return 'yaml';
        case 'xml': return 'xml';
        case 'sql': return 'sql';
        case 'tf': return 'terraform';
        case 'ini': return 'ini';
        case 'toml': return 'toml';
        case 'c': return 'c';
        case 'cpp': case 'cc': case 'cxx': return 'cpp';
        case 'h': case 'hpp': return 'cpp';
        case 'cs': return 'csharp';
        case 'php': return 'php';
        case 'r': return 'r';
        case 'pl': case 'pm': return 'perl';
        case 'dart': return 'dart';
        case 'lua': return 'lua';
        case 'gradle': return 'groovy';
        case 'properties': return 'properties';
        case 'txt': return 'plaintext';
        default: return 'plaintext';
    }
}

// Lista usada no modal de criar arquivo (nome + extensão)
export const LANGUAGES = [
    { name: 'JavaScript', ext: '.js' },
    { name: 'TypeScript', ext: '.ts' },
    { name: 'Python', ext: '.py' },
    { name: 'Java', ext: '.java' },
    { name: 'HTML', ext: '.html' },
    { name: 'CSS', ext: '.css' },
    { name: 'JSON', ext: '.json' },
    { name: 'Markdown', ext: '.md' },
    { name: 'SQL', ext: '.sql' },
    { name: 'Shell', ext: '.sh' },
    { name: 'PHP', ext: '.php' },
    { name: 'YAML', ext: '.yml' },
    { name: 'Rust', ext: '.rs' },
    { name: 'Go', ext: '.go' },
    { name: 'C', ext: '.c' },
    { name: 'C++', ext: '.cpp' },
    { name: 'C#', ext: '.cs' },
    { name: 'Kotlin', ext: '.kt' },
    { name: 'Swift', ext: '.swift' },
    { name: 'Dart', ext: '.dart' },
    { name: 'Lua', ext: '.lua' },
    { name: 'Perl', ext: '.pl' },
    { name: 'R', ext: '.r' },
    { name: 'Gradle (Groovy)', ext: '.gradle' },
    { name: 'Plain text', ext: '.txt' },
];
