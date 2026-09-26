import { useContext } from 'react';
import { TranslationContext } from '@/lib/TranslationContext';

let warnedMissingProvider = false;

function normalizeTranslationArgs(paramsOrFallback = {}, maybeParams = {}) {
  if (typeof paramsOrFallback === "string") {
    return { fallback: paramsOrFallback, params: maybeParams && typeof maybeParams === "object" ? maybeParams : {} };
  }
  return { fallback: null, params: paramsOrFallback && typeof paramsOrFallback === "object" ? paramsOrFallback : {} };
}

function fallbackTranslate(key, paramsOrFallback = {}, maybeParams = {}) {
  const { fallback, params } = normalizeTranslationArgs(paramsOrFallback, maybeParams);
  return Object.entries(params).reduce((text, [paramKey, paramValue]) => {
    const str = String(paramValue);
    return text
      .replaceAll(`{{${paramKey}}}`, str)
      .replaceAll(`{${paramKey}}`, str);
  }, String(fallback || key || ''));
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
