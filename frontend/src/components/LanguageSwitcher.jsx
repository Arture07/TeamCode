// frontend/src/components/LanguageSwitcher.jsx
import React from "react";
import { useTranslation } from "../contexts/LanguageContext";

function LanguageSwitcher({ variant = "dropdown", showLabel = false, className = "" }) {
  const { language, setLanguage, availableLanguages, t } = useTranslation();

  if (variant === "pills") {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {showLabel && (
          <label className="text-sm font-semibold whitespace-nowrap mr-1" style={{ color: "var(--text-color)" }}>
            {t("settings.language")}
          </label>
        )}
        <div className="flex rounded border p-0.5" style={{ borderColor: "var(--panel-border-color)", backgroundColor: "var(--input-bg-color)" }}>
          {availableLanguages.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`px-2.5 py-1 text-xs font-bold rounded transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[var(--primary-color)] text-white shadow-sm"
                    : "opacity-70 hover:opacity-100 text-[var(--text-color)]"
                }`}
                title={lang.label}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Default compact/dropdown style
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <label className="text-sm font-semibold whitespace-nowrap" style={{ color: "var(--text-color)" }}>
          {t("settings.language")}
        </label>
      )}
      <div className="relative inline-flex items-center">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="p-1 px-2 rounded-md appearance-none text-xs sm:text-sm font-bold cursor-pointer transition-colors"
          style={{
            backgroundColor: "var(--input-bg-color)",
            color: "var(--text-color)",
            border: "1px solid var(--panel-border-color)",
          }}
          title={t("common.language")}
        >
          {availableLanguages.map((lang) => (
            <option
              key={lang.code}
              value={lang.code}
              style={{
                backgroundColor: "var(--panel-bg-color)",
                color: "var(--text-color)",
              }}
            >
              {lang.flag} {lang.label}
            </option>
          ))}
        </select>
        <span className="codicon codicon-chevron-down text-[10px] pointer-events-none absolute right-2 opacity-60" />
      </div>
    </div>
  );
}

export default LanguageSwitcher;
