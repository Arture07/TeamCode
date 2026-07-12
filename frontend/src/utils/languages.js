export const LANGUAGES = [
  { name: "JavaScript", extension: ".js" },
  { name: "Python", extension: ".py" },
  { name: "Java", extension: ".java" },
  { name: "HTML", extension: ".html" },
  { name: "CSS", extension: ".css" },
  { name: "Markdown", extension: ".md" },
  { name: "JSON", extension: ".json" },
  { name: "TypeScript", extension: ".ts" },
  { name: "Shell Script", extension: ".sh" },
  { name: "C", extension: ".c" },
  { name: "C++", extension: ".cpp" },
  { name: "C#", extension: ".cs" },
  { name: "Go", extension: ".go" },
  { name: "Rust", extension: ".rs" },
  { name: "Ruby", extension: ".rb" },
  { name: "PHP", extension: ".php" },
  { name: "SQL", extension: ".sql" },
  { name: "YAML", extension: ".yml" },
];

export const getLanguageFromExtension = (fileName) => {
  if (!fileName) return "plaintext";
  const extension = fileName.split(".").pop().toLowerCase();
  switch (extension) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "java":
      return "java";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "sh":
    case "bash":
      return "shell";
    case "xml":
      return "xml";
    case "sql":
      return "sql";
    case "yaml":
    case "yml":
      return "yaml";
    case "c":
    case "h":
      return "c";
    case "cpp":
    case "hpp":
    case "cc":
      return "cpp";
    case "cs":
      return "csharp";
    case "rb":
      return "ruby";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "php":
      return "php";
    default:
      return "plaintext";
  }
};
