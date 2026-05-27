import React, { useState, useEffect, createContext, useContext } from "react";

export const themes = {
  "neobrutalism-dark": "Neo Brutalism (Dark)",
  neobrutalism: "Neo Brutalism (Light)",
  "aurora-light": "Aurora (Light)",
  aurora: "Aurora (Dark)",
  "cyber_glass-light": "Cyber Glass (Light)",
  cyber_glass: "Cyber Glass (Dark)",
  dracula: "Dracula",
  "tokyo-night": "Tokyo Night",
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(
    localStorage.getItem("teamcode-theme") || "neobrutalism-dark",
  );
  const [fontSize, setFontSize] = useState(
    Number(localStorage.getItem("teamcode-font-size")) || 14,
  );

  useEffect(() => {
    localStorage.setItem("teamcode-theme", theme);
    document.body.className = "";
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("teamcode-font-size", fontSize);
  }, [fontSize]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
