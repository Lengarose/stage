import { createContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Import all translation files
import en from '../translations/en.json';
import fr from '../translations/fr.json';
import es from '../translations/es.json';
import nl from '../translations/nl.json';
import de from '../translations/de.json';
import it from '../translations/it.json';
import ru from '../translations/ru.json';
import pt from '../translations/pt.json';

const translations = { en, fr, es, nl, de, it, ru, pt };

export const TranslationContext = createContext();

export function TranslationProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    // Also save to user profile
    base44.auth.me().then(user => {
      if (user) {
        base44.auth.updateMe({ language });
      }
    }).catch(() => {});
  }, [language]);

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key; // Return key if not found
      }
    }
    
    return value || key;
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
}