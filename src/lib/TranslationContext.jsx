import { createContext, useState, useEffect } from 'react';
import { stageClient } from '@/api/stageClient';

// Import all translation files
import en from '../translations/en.json';
import fr from '../translations/fr.json';
import es from '../translations/es.json';
import nl from '../translations/nl.json';
import de from '../translations/de.json';
import it from '../translations/it.json';
import ru from '../translations/ru.json';
import pt from '../translations/pt.json';
import zh from '../translations/zh.json';
import ja from '../translations/ja.json';
import ko from '../translations/ko.json';
import ar from '../translations/ar.json';
import pl from '../translations/pl.json';
import tr from '../translations/tr.json';
import { DEFAULT_LANGUAGE, isSupportedLanguage } from '@/lib/languages';
import { getCoreTranslations } from '@/translations/coreTranslations';

function mergeTranslations(base, extension) {
  const output = { ...base };
  for (const [key, value] of Object.entries(extension || {})) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = mergeTranslations(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

const baseTranslations = { en, fr, es, nl, de, it, ru, pt, zh, ja, ko, ar, pl, tr };
const translations = Object.fromEntries(
  Object.entries(baseTranslations).map(([languageCode, messages]) => [
    languageCode,
    mergeTranslations(messages, getCoreTranslations(languageCode)),
  ])
);

export const TranslationContext = createContext();

export function TranslationProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const savedLanguage = localStorage.getItem('language') || DEFAULT_LANGUAGE;
    return isSupportedLanguage(savedLanguage) ? savedLanguage : DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    const normalizedLanguage = isSupportedLanguage(language) ? language : DEFAULT_LANGUAGE;
    if (normalizedLanguage !== language) {
      setLanguage(normalizedLanguage);
      return;
    }
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    // Also save to user profile
    stageClient.auth.me().then(user => {
      if (user) {
        stageClient.auth.updateMe({ language }).catch(() => {});
      }
    }).catch(() => {});
  }, [language]);

  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        value = null;
        break;
      }
    }
    
    if (!value) {
      value = translations[DEFAULT_LANGUAGE];
      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k];
        } else {
          value = null;
          break;
        }
      }
    }

    if (typeof value !== "string") return value || key;

    return Object.entries(params).reduce(
      (text, [paramKey, paramValue]) => text.replaceAll(`{${paramKey}}`, String(paramValue)),
      value
    );
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
}
