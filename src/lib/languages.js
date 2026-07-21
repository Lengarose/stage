export const SUPPORTED_LANGUAGES = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "fr", label: "French", nativeLabel: "Français" },
  { value: "nl", label: "Dutch", nativeLabel: "Nederlands" },
  { value: "es", label: "Spanish", nativeLabel: "Español" },
  { value: "it", label: "Italian", nativeLabel: "Italiano" },
  { value: "zh", label: "Chinese", nativeLabel: "简体中文" },
  { value: "ja", label: "Japanese", nativeLabel: "日本語" },
];

export const DEFAULT_LANGUAGE = "en";

export function isSupportedLanguage(language) {
  return SUPPORTED_LANGUAGES.some((item) => item.value === language);
}
