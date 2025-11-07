// Simple VS Code–style icons as inline SVG React components
import React from 'react';

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

export const IconFile = (props) => (
  <svg {...base} {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
);

export const IconFolder = (props) => (
  <svg {...base} {...props}><path d="M3 7h5l2 3h11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V5a2 2 0 0 1 2-2h3l2 2h5"/></svg>
);

export const IconAddFile = (props) => (
  <svg {...base} {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8"/><polyline points="14 2 14 8 20 8"/><path d="M19 16v6"/><path d="M16 19h6"/></svg>
);

export const IconAddFolder = (props) => (
  <svg {...base} {...props}><path d="M3 7h5l2 3h9"/><path d="M3 7V5a 2 2 0 0 1 2-2h3l2 2h5"/><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M12 13v4"/><path d="M10 15h4"/></svg>
);

export const IconRename = (props) => (
  <svg {...base} {...props}><path d="M3 20h6"/><path d="M7 20v-4"/><path d="M13 4l7 7-3 3-7-7 3-3z"/><path d="M12 5l3 3"/></svg>
);

export const IconDelete = (props) => (
  <svg {...base} {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
);

export const IconCopy = (props) => (
  <svg {...base} {...props}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
);

export const IconReveal = (props) => (
  <svg {...base} {...props}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
);
