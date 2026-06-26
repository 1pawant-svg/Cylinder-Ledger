"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { Language, translations } from './translations';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('cylindera_lang') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'ne')) {
      setLanguageState(savedLang);
    }
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('cylindera_lang', lang);
  };

  const t = useCallback((key: keyof typeof translations['en']): string => {
    const dict = translations[language] || translations['en'];
    return dict[key] || translations['en'][key] || key;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, t]);

  return (
    <I18nContext.Provider value={value}>
      {mounted ? children : (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <div className="animate-pulse font-headline text-xl font-bold text-primary">Cylindera...</div>
        </div>
      )}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
