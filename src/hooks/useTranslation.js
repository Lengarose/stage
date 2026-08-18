import { useContext } from 'react';
import { TranslationContext } from '@/lib/TranslationContext';

let warnedMissingProvider = false;

function fallbackTranslate(key, params = {}) {
  return Object.entries(params).reduce(
    (text, [paramKey, paramValue]) => text.replaceAll(`{${paramKey}}`, String(paramValue)),
    String(key || '')
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  
  if (!context) {
    if (!warnedMissingProvider) {
      warnedMissingProvider = true;
      console.warn('useTranslation was used before TranslationProvider was ready; using fallback labels for this render.');
    }
    return {
      language: 'en',
      setLanguage: () => {},
      t: fallbackTranslate,
    };
  }
  
  return context;
}
