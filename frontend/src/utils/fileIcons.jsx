import React from 'react';

const DEVICON_BASE = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/";

const iconUrls = {
  js: `${DEVICON_BASE}javascript/javascript-original.svg`,
  ts: `${DEVICON_BASE}typescript/typescript-original.svg`,
  py: `${DEVICON_BASE}python/python-original.svg`,
  java: `${DEVICON_BASE}java/java-original.svg`,
  html: `${DEVICON_BASE}html5/html5-original.svg`,
  css: `${DEVICON_BASE}css3/css3-original.svg`,
  json: `${DEVICON_BASE}json/json-original.svg`,
  md: `${DEVICON_BASE}markdown/markdown-original.svg`,
  sql: `${DEVICON_BASE}mysql/mysql-original.svg`,
  sh: `${DEVICON_BASE}bash/bash-original.svg`,
  php: `${DEVICON_BASE}php/php-original.svg`,
  yml: `${DEVICON_BASE}yaml/yaml-original.svg`,
  yaml: `${DEVICON_BASE}yaml/yaml-original.svg`,
  rs: `${DEVICON_BASE}rust/rust-original.svg`,
  go: `${DEVICON_BASE}go/go-original.svg`,
  c: `${DEVICON_BASE}c/c-original.svg`,
  cpp: `${DEVICON_BASE}cplusplus/cplusplus-original.svg`,
  cs: `${DEVICON_BASE}csharp/csharp-original.svg`,
  kt: `${DEVICON_BASE}kotlin/kotlin-original.svg`,
  swift: `${DEVICON_BASE}swift/swift-original.svg`,
  dart: `${DEVICON_BASE}dart/dart-original.svg`,
  lua: `${DEVICON_BASE}lua/lua-original.svg`,
  r: `${DEVICON_BASE}r/r-original.svg`,
  gradle: `${DEVICON_BASE}gradle/gradle-original.svg`,
};

function normalizeExtFromFileName(fileName) {
  if (!fileName) return 'txt';
  const lower = String(fileName).toLowerCase().trim();
  if (lower === 'dockerfile') return 'dockerfile';
  const parts = lower.split('.');
  if (parts.length === 1) return 'txt';
  return parts.pop();
}

/**
 * getFileIcon(fileName)
 * used by Sidebar: accepts fileName like 'index.js'
 */
export function getFileIcon(fileName) {
  const ext = normalizeExtFromFileName(fileName);
  const iconUrl = iconUrls[ext];

  // Identifica se o tema atual é dark para aplicar filtro em ícones escuros (opcional).
  // Porém, a maioria das cores originais são boas.
  if (iconUrl) {
    return <img src={iconUrl} alt={ext} className="w-5 h-5" />;
  }

  // Fallback for unknown extensions
  return <div className="w-5 h-5 bg-gray-400 rounded-sm" />;
}

export default {
  getFileIcon
};
