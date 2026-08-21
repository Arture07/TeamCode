import React from "react";
import { useTheme } from "../contexts/ThemeContext";

function FileIcon({ fileName }) {
  const { theme } = useTheme();
  if (!fileName) return null;

  const extension = fileName.split(".").pop().toLowerCase();
  const iconMap = {
    js: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg",
    py: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg",
    java: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg",
    html: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg",
    css: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg",
    md: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/markdown/markdown-original.svg",
    json: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/json/json-original.svg",
    ts: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg",
    sh: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/bash/bash-original.svg",
  };
  const iconUrl = iconMap[extension];

  const needsInvert = theme.includes("dark");
  const style = needsInvert
    ? { filter: "invert(1) grayscale(1) brightness(2)" }
    : {};

  return iconUrl ? (
    <img src={iconUrl} alt={extension} className="w-5 h-5" style={style} />
  ) : (
    <div className="w-5 h-5 bg-gray-300" />
  );
}

export default FileIcon;
