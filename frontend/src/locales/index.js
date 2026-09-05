// frontend/src/locales/index.js
import pt from "./pt";
import en from "./en";

export const translations = {
  pt,
  en,
};

export const availableLanguages = [
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "en", label: "English", flag: "🇺🇸" },
];

export default translations;
