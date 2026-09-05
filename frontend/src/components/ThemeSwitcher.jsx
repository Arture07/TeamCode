import React from "react";
import { useTheme, themes } from "../contexts/ThemeContext";
import { useTranslation } from "../contexts/LanguageContext";

function ThemeSwitcher({ showFont = false }) {
  const { theme, setTheme, fontSize, setFontSize } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <label
          className="text-sm font-semibold whitespace-nowrap"
          style={{ color: "var(--text-color)" }}
        >
          {t("settings.theme")}
        </label>
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="p-1 rounded-md appearance-none text-sm"
          style={{
            backgroundColor: "var(--input-bg-color)",
            color: "var(--text-color)",
            border: "1px solid var(--panel-border-color)",
          }}
        >
          {Object.entries(themes).map(([key, name]) => (
            <option
              key={key}
              value={key}
              style={{
                backgroundColor: "var(--bg-color)",
                color: "var(--text-color)",
              }}
            >
              {name}
            </option>
          ))}
        </select>
      </div>
      {showFont && (
        <div className="flex items-center space-x-2">
          <label
            className="text-sm font-semibold whitespace-nowrap"
            style={{ color: "var(--text-color)" }}
          >
            {t("settings.editorFont")}
          </label>
          <input
            type="number"
            min="8"
            max="32"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="p-1 rounded-md text-sm w-16"
            style={{
              backgroundColor: "var(--input-bg-color)",
              color: "var(--text-color)",
              border: "1px solid var(--panel-border-color)",
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ThemeSwitcher;
