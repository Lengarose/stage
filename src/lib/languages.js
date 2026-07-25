const LANGUAGE_CATALOG = [
  { value: "en", label: "English", nativeLabel: "English", flag: "🇬🇧", enabled: true },
  { value: "fr", label: "French", nativeLabel: "Français", flag: "🇫🇷", enabled: true },
  { value: "nl", label: "Dutch", nativeLabel: "Nederlands", flag: "🇳🇱", enabled: true },
  { value: "es", label: "Spanish", nativeLabel: "Español", flag: "🇪🇸", enabled: true },
  { value: "pt", label: "Portuguese", nativeLabel: "Português", flag: "🇵🇹", enabled: true },
  { value: "it", label: "Italian", nativeLabel: "Italiano", flag: "🇮🇹", enabled: true },
  { value: "de", label: "German", nativeLabel: "Deutsch", flag: "🇩🇪", enabled: true },
  { value: "zh", label: "Chinese", nativeLabel: "简体中文", flag: "🇨🇳", enabled: true },
  { value: "ja", label: "Japanese", nativeLabel: "日本語", flag: "🇯🇵", enabled: true },
  { value: "ru", label: "Russian", nativeLabel: "Русский", flag: "🇷🇺", enabled: false },
  { value: "ko", label: "Korean", nativeLabel: "한국어", flag: "🇰🇷", enabled: false },
  { value: "ar", label: "Arabic", nativeLabel: "العربية", flag: "🇸🇦", enabled: false },
  { value: "pl", label: "Polish", nativeLabel: "Polski", flag: "🇵🇱", enabled: false },
  { value: "tr", label: "Turkish", nativeLabel: "Türkçe", flag: "🇹🇷", enabled: false },
];

/** Active locales only — used by translation system & legacy selects. */
export const SUPPORTED_LANGUAGES = LANGUAGE_CATALOG.filter((item) => item.enabled);

/** All locales shown in settings (includes coming-soon). */
export const DISPLAY_LANGUAGES = LANGUAGE_CATALOG;

export const DEFAULT_LANGUAGE = "en";

export function isSupportedLanguage(language) {
  return SUPPORTED_LANGUAGES.some((item) => item.value === language);
}

export function getLanguageMeta(code) {
  return LANGUAGE_CATALOG.find((item) => item.value === code) || SUPPORTED_LANGUAGES[0];
}
