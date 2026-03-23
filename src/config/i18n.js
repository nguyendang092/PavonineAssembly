import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import vi from "./locales/vi";
import ko from "./locales/ko";

const resources = {
  vi: { translation: vi },
  ko: { translation: ko },
};

const LANGUAGE_STORAGE_KEY = "appLanguage";

const getBrowserLanguage = () => {
  const browserLang = navigator.language || navigator.userLanguage;

  if (browserLang.toLowerCase().startsWith("ko")) {
    return "ko";
  }

  if (browserLang.toLowerCase().startsWith("vi")) {
    return "vi";
  }

  return "vi";
};

const getInitialLanguage = () => {
  const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (savedLanguage === "vi" || savedLanguage === "ko") {
    return savedLanguage;
  }

  return getBrowserLanguage();
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLanguage(),
  fallbackLng: "vi",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
