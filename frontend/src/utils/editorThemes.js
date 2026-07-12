export const xtermThemes = {
  "neobrutalism-dark": {
    background: "#000000",
    foreground: "#ffffff",
    cursor: "#ffffff",
    selectionBackground: "#333333"
  },
  neobrutalism: {
    background: "#ffffff",
    foreground: "#000000",
    cursor: "#000000",
    selectionBackground: "#cccccc"
  },
  "aurora-light": {
    background: "#ffffff",
    foreground: "#333333",
    cursor: "#333333",
    selectionBackground: "#e0e0e0"
  },
  aurora: {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    selectionBackground: "#313244"
  },
  "cyber_glass-light": {
    background: "#ffffff",
    foreground: "#111111",
    cursor: "#111111",
    selectionBackground: "#dcdcdc"
  },
  cyber_glass: {
    background: "#0d1117",
    foreground: "#c9d1d9",
    cursor: "#58a6ff",
    selectionBackground: "#388bfd33"
  },
  dracula: {
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f0",
    selectionBackground: "#44475a"
  },
  "tokyo-night": {
    background: "#1a1b26",
    foreground: "#c0caf5",
    cursor: "#c0caf5",
    selectionBackground: "#33467c"
  }
};

export const monacoThemes = {
  "neobrutalism-dark": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "#ff5555", fontStyle: "bold" },
      { token: "string", foreground: "#f1fa8c" },
      { token: "number", foreground: "#bd93f9" },
      { token: "comment", foreground: "#6272a4", fontStyle: "italic" },
      { token: "tag", foreground: "#ff5555" },
      { token: "attribute.name", foreground: "#ffb86c" },
      { token: "attribute.value", foreground: "#f1fa8c" },
      { token: "delimiter.html", foreground: "#ffffff" }
    ],
    colors: {
      "editor.background": "#000000",
      "editor.foreground": "#ffffff"
    }
  },
  neobrutalism: {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "#d32f2f", fontStyle: "bold" },
      { token: "string", foreground: "#388e3c" },
      { token: "number", foreground: "#1976d2" },
      { token: "comment", foreground: "#757575", fontStyle: "italic" },
      { token: "tag", foreground: "#d32f2f" },
      { token: "attribute.name", foreground: "#f57c00" },
      { token: "attribute.value", foreground: "#388e3c" },
      { token: "delimiter.html", foreground: "#000000" }
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#000000"
    }
  },
  "aurora-light": {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "#d73a49" },
      { token: "string", foreground: "#032f62" },
      { token: "number", foreground: "#005cc5" },
      { token: "comment", foreground: "#6a737d", fontStyle: "italic" },
      { token: "tag", foreground: "#22863a" },
      { token: "attribute.name", foreground: "#6f42c1" },
      { token: "attribute.value", foreground: "#032f62" },
      { token: "delimiter.html", foreground: "#24292e" }
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#24292e"
    }
  },
  aurora: {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "#cba6f7", fontStyle: "italic" },
      { token: "string", foreground: "#a6e3a1" },
      { token: "number", foreground: "#fab387" },
      { token: "comment", foreground: "#6c7086", fontStyle: "italic" },
      { token: "function", foreground: "#89b4fa" },
      { token: "tag", foreground: "#f38ba8" },
      { token: "attribute.name", foreground: "#f9e2af" },
      { token: "attribute.value", foreground: "#a6e3a1" },
      { token: "delimiter.html", foreground: "#9399b2" }
    ],
    colors: {
      "editor.background": "#1e1e2e",
      "editor.foreground": "#cdd6f4"
    }
  },
  "cyber_glass-light": {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "#005cc5" },
      { token: "string", foreground: "#22863a" },
      { token: "number", foreground: "#e36209" },
      { token: "comment", foreground: "#6a737d" },
      { token: "tag", foreground: "#d73a49" },
      { token: "attribute.name", foreground: "#6f42c1" },
      { token: "attribute.value", foreground: "#22863a" },
      { token: "delimiter.html", foreground: "#111111" }
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#111111"
    }
  },
  cyber_glass: {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "#ff7b72" },
      { token: "string", foreground: "#a5d6ff" },
      { token: "number", foreground: "#79c0ff" },
      { token: "comment", foreground: "#8b949e" },
      { token: "tag", foreground: "#7ee787" },
      { token: "attribute.name", foreground: "#d2a8ff" },
      { token: "attribute.value", foreground: "#a5d6ff" },
      { token: "delimiter.html", foreground: "#c9d1d9" }
    ],
    colors: {
      "editor.background": "#0d1117",
      "editor.foreground": "#c9d1d9"
    }
  },
  dracula: {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "#ff79c6", fontStyle: "italic" },
      { token: "string", foreground: "#f1fa8c" },
      { token: "number", foreground: "#bd93f9" },
      { token: "comment", foreground: "#6272a4" },
      { token: "function", foreground: "#50fa7b" },
      { token: "tag", foreground: "#ff79c6" },
      { token: "attribute.name", foreground: "#50fa7b" },
      { token: "attribute.value", foreground: "#f1fa8c" },
      { token: "delimiter.html", foreground: "#f8f8f2" }
    ],
    colors: {
      "editor.background": "#282a36",
      "editor.foreground": "#f8f8f2"
    }
  },
  "tokyo-night": {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "#bb9af7", fontStyle: "italic" },
      { token: "string", foreground: "#9ece6a" },
      { token: "number", foreground: "#ff9e64" },
      { token: "comment", foreground: "#565f89", fontStyle: "italic" },
      { token: "function", foreground: "#7aa2f7" },
      { token: "tag", foreground: "#f7768e" },
      { token: "attribute.name", foreground: "#e0af68" },
      { token: "attribute.value", foreground: "#9ece6a" },
      { token: "delimiter.html", foreground: "#89ddff" }
    ],
    colors: {
      "editor.background": "#1a1b26",
      "editor.foreground": "#c0caf5"
    }
  }
};
