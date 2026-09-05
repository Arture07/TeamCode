// frontend/src/contexts/LanguageContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import translations, { availableLanguages } from "../locales";

export const LanguageContext = createContext();

const STORAGE_KEY = "codesync-language";

const getInitialLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("crewcode-language");
    if (saved && (saved === "pt" || saved === "en")) {
      return saved;
    }
    // Detect from browser
    const browserLang = (navigator.language || navigator.userLanguage || "").toLowerCase();
    if (browserLang.startsWith("pt")) {
      return "pt";
    }
  } catch (_) {}
  return "en"; // Default to English for international access
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((lang) => {
    if (lang === "pt" || lang === "en") {
      setLanguageState(lang);
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (_) {}
      document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
  }, [language]);

  /**
   * Helper function to retrieve nested translation keys with variable interpolation.
   * Example: t('header.removeUserFromRoom', { username: 'Artur' })
   */
  const t = useCallback((keyPath, params = {}) => {
    if (!keyPath) return "";

    const keys = keyPath.split(".");
    let current = translations[language];

    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        current = undefined;
        break;
      }
    }

    // Fallback to English if not found in current language
    if (current === undefined && language !== "en") {
      let fallback = translations.en;
      for (const k of keys) {
        if (fallback && typeof fallback === "object" && k in fallback) {
          fallback = fallback[k];
        } else {
          fallback = undefined;
          break;
        }
      }
      current = fallback;
    }

    if (current === undefined || typeof current !== "string") {
      return keyPath;
    }

    // Replace {placeholder} with params
    return current.replace(/\{(\w+)\}/g, (_, match) => {
      return params[match] !== undefined ? params[match] : `{${match}}`;
    });
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, availableLanguages }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return context;
};

export default LanguageContext;
