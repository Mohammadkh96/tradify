import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/locales/en/common.json";
import es from "@/locales/es/common.json";
import fr from "@/locales/fr/common.json";
import de from "@/locales/de/common.json";
import zh from "@/locales/zh/common.json";
import ar from "@/locales/ar/common.json";

import enPropfirm from "@/locales/en/propfirm.json";
import esPropfirm from "@/locales/es/propfirm.json";
import frPropfirm from "@/locales/fr/propfirm.json";
import dePropfirm from "@/locales/de/propfirm.json";
import zhPropfirm from "@/locales/zh/propfirm.json";
import arPropfirm from "@/locales/ar/propfirm.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", native: "English", flag: "🇺🇸", dir: "ltr" },
  { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "fr", label: "French", native: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "de", label: "German", native: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  { code: "zh", label: "Chinese", native: "中文", flag: "🇨🇳", dir: "ltr" },
  { code: "ar", label: "Arabic", native: "العربية", flag: "🇸🇦", dir: "rtl" },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]["code"];

export const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map(l => l.code) as readonly string[];

export function normalizeLang(code: string | undefined | null): LanguageCode {
  if (!code) return "en";
  const base = code.split("-")[0].toLowerCase();
  return (SUPPORTED_CODES.includes(base) ? base : "en") as LanguageCode;
}

export function isRtl(code: string | undefined | null) {
  return SUPPORTED_LANGUAGES.find(l => l.code === normalizeLang(code))?.dir === "rtl";
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en, propfirm: enPropfirm },
      es: { common: es, propfirm: esPropfirm },
      fr: { common: fr, propfirm: frPropfirm },
      de: { common: de, propfirm: dePropfirm },
      zh: { common: zh, propfirm: zhPropfirm },
      ar: { common: ar, propfirm: arPropfirm },
    },
    fallbackLng: "en",
    defaultNS: "common",
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["querystring", "localStorage", "navigator", "htmlTag"],
      lookupQuerystring: "lang",
      lookupLocalStorage: "tradify_lang",
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  });

export function applyLangAttrs(lng: string) {
  if (typeof document === "undefined") return;
  const norm = normalizeLang(lng);
  document.documentElement.lang = norm;
  document.documentElement.dir = isRtl(norm) ? "rtl" : "ltr";
}

if (typeof document !== "undefined") {
  applyLangAttrs(i18n.language || "en");
  i18n.on("languageChanged", applyLangAttrs);
}

export default i18n;
