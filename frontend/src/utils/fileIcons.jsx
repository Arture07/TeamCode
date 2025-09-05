// frontend/src/utils/fileIcons.jsx
import React from 'react';

/**
 * Implementação estável e sem dependência de nomeações de pacotes:
 * - Retorna um pequeno elemento JSX (emoji ou tag com extensão)
 * - Exporta: getFileIcon(fileName) e getIconByExtension(ext)
 *
 * Isso evita erros de "is not exported by react-icons/si" no build.
 */

const EXT_ICON_MAP = {
    js: '🟨',
    ts: '🔷',
    py: '🐍',
    java: '☕',
    html: '🌐',
    css: '🎨',
    json: '{ }',
    md: '📝',
    sql: '🗄️',
    sh: '💻',
    php: '🐘',
    yml: '📄',
    yaml: '📄',
    rs: '🦀',
    go: '🐹',
    c: '🅲',
    cpp: '⨯',
    cs: '♯',
    kt: '🔶',
    swift: '🟠',
    dart: '🎯',
    lua: '🌊',
    pl: '🧵',
    r: '📊',
    gradle: '🔧',
    txt: '📄',
};

function normalizeExtFromFileName(fileName) {
    if (!fileName) return '';
    const lower = String(fileName).toLowerCase().trim();
    if (lower === 'dockerfile') return 'dockerfile';
    const parts = lower.split('.');
    if (parts.length === 1) return '';
    return parts.pop();
}

/**
 * Retorna um ícone (JSX) com base no nome do arquivo (ex: "index.js")
 * Usado na sidebar.
 */
export function getFileIcon(fileName, props = {}) {
    const ext = normalizeExtFromFileName(fileName);
    return getIconByExtension(ext || 'txt', props);
}

/**
 * Retorna um ícone (JSX) para uma extensão (ex: "js", ".js")
 * Usado no modal de criar arquivo (getIconByExtension(lang.ext))
 */
export function getIconByExtension(extRaw, props = {}) {
    if (!extRaw) extRaw = 'txt';
    const ext = String(extRaw).replace(/^\./, '').toLowerCase();
    const emoji = EXT_ICON_MAP[ext] ?? null;
    const size = props.size ?? 16;
    const className = props.className ?? 'inline-block align-middle';

    if (emoji) {
        // pequenos ajustes visuais: emoji ou texto
        return <span className={className} style={{ fontSize: size, lineHeight: 1 }}>{emoji}</span>;
    }

    // fallback: mostra a extensão em caixa pequena
    return (
        <span className={className} style={{
            display: 'inline-block',
            fontSize: Math.max(12, size - 4),
            padding: '2px 6px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            color: 'inherit',
            lineHeight: 1
        }}>
            {ext}
        </span>
    );
}

export default {
    getFileIcon,
    getIconByExtension
};
