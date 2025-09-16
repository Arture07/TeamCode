import React from 'react';

/**
 * File icons built with inline SVG (no external dependency).
 * - API compatible with previous implementation:
 *    getFileIcon(fileName, props)
 *    getIconByExtension(ext, props)
 *
 * - Each icon is a rounded square badge with a 1-3 letter label.
 * - Props:
 *    size (number, default 16), className (string)
 */

/* ---------- config ---------- */
const ICONS = {
    js: { label: 'JS', bg: '#f7df1e', fg: '#000' },
    ts: { label: 'TS', bg: '#3178c6', fg: '#fff' },
    py: { label: 'PY', bg: '#3776AB', fg: '#fff' },
    java: { label: 'JA', bg: '#007396', fg: '#fff' },
    html: { label: '<>', bg: '#E34F26', fg: '#fff' },
    css: { label: '{}', bg: '#2965f1', fg: '#fff' },
    json: { label: '{}', bg: '#222', fg: '#fff' },
    md: { label: 'MD', bg: '#4f4f4f', fg: '#fff' },
    sql: { label: 'SQL', bg: '#e38c00', fg: '#fff' },
    sh: { label: 'SH', bg: '#373737', fg: '#fff' },
    php: { label: 'PHP', bg: '#777bb4', fg: '#fff' },
    yml: { label: 'YML', bg: '#cb171e', fg: '#fff' },
    yaml: { label: 'YML', bg: '#cb171e', fg: '#fff' },
    rs: { label: 'RS', bg: '#dea584', fg: '#000' },
    go: { label: 'GO', bg: '#00ADD8', fg: '#fff' },
    c: { label: 'C', bg: '#555', fg: '#fff' },
    cpp: { label: 'C++', bg: '#00599C', fg: '#fff' },
    cs: { label: 'C#', bg: '#178600', fg: '#fff' },
    kt: { label: 'KT', bg: '#ff6f00', fg: '#fff' },
    swift: { label: 'SW', bg: '#ff6b00', fg: '#fff' },
    dart: { label: 'D', bg: '#0175C2', fg: '#fff' },
    lua: { label: 'LU', bg: '#0d5eaf', fg: '#fff' },
    pl: { label: 'PL', bg: '#394357', fg: '#fff' },
    r: { label: 'R', bg: '#276DC2', fg: '#fff' },
    gradle: { label: 'GR', bg: '#3bb27f', fg: '#fff' },
    txt: { label: 'TXT', bg: '#6b7280', fg: '#fff' },
};

/* ---------- helpers ---------- */
function normalizeExt(extRaw) {
    if (!extRaw) return 'txt';
    const s = String(extRaw).trim().toLowerCase();
    return s.replace(/^\./, '');
}

function normalizeExtFromFileName(fileName) {
    if (!fileName) return 'txt';
    const lower = String(fileName).toLowerCase().trim();
    if (lower === 'dockerfile') return 'dockerfile';
    const parts = lower.split('.');
    if (parts.length === 1) return 'txt';
    return parts.pop();
}

/* ---------- core icon component ---------- */
function IconBadge({ label = '', bg = '#666', fg = '#fff', size = 16, className = '', title = '' }) {
    const fontSize = Math.max(8, Math.round(size * 0.45));
    const rx = Math.max(2, Math.round(size * 0.15));
    return (
        <svg
            role="img"
            aria-label={title || label}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className={className}
            style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
            <rect x="1" y="1" width="22" height="22" rx={rx} fill={bg} />
            <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="Inter, Roboto, system-ui, -apple-system, 'Segoe UI', sans-serif"
                fontWeight="600"
                fontSize={fontSize}
                fill={fg}
            >
                {label}
            </text>
        </svg>
    );
}

/* ---------- public API ---------- */

/**
 * getIconByExtension(ext, props)
 * ext: 'js' or '.js' etc.
 * props: { size, className }
 */
export function getIconByExtension(extRaw, props = {}) {
    const ext = normalizeExt(extRaw);
    const cfg = ICONS[ext] || ICONS['txt'];
    // special: if ext === 'dockerfile' show DF letters
    const label = ext === 'dockerfile' ? 'DF' : cfg.label;
    return <IconBadge label={label} bg={cfg.bg} fg={cfg.fg} size={props.size ?? 18} className={props.className ?? ''} title={props.title ?? ext} />;
}

/**
 * getFileIcon(fileName, props)
 * used by Sidebar: accepts fileName like 'index.js'
 */
export function getFileIcon(fileName, props = {}) {
    const ext = normalizeExtFromFileName(fileName);
    // handle .gradle extension (some IDEs show filename 'build.gradle')
    const key = ext === 'gradle' ? 'gradle' : ext;
    return getIconByExtension(key, props);
}

/* default export to keep compatibility */
export default {
    getFileIcon,
    getIconByExtension
};
