'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { defaultLocale, locales, messages, type Locale } from './config';

export const LOCALE_STORAGE_KEY = 'sci-locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
  t: (key: string) => key,
});

export function useLocaleContext() {
  return useContext(LocaleContext);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
        if (saved && locales.includes(saved)) {
          return saved;
        }
        // Also check NEXT_LOCALE cookie or browser navigator language
        const navLang = navigator.language.slice(0, 2).toLowerCase() as Locale;
        if (locales.includes(navLang)) {
          return navLang;
        }
      } catch {
        // storage disabled or SSR
      }
    }
    return defaultLocale;
  });

  function setLocale(newLocale: Locale) {
    if (!locales.includes(newLocale)) return;
    setLocaleState(newLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = newLocale;
    } catch {
      // storage failed
    }
  }

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function t(path: string, params?: Record<string, string | number>): string {
    const keys = path.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = messages[locale] ?? messages[defaultLocale];

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        // Fallback to English
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fallbackCurrent: any = messages[defaultLocale];
        for (const fbKey of keys) {
          if (fallbackCurrent && typeof fallbackCurrent === 'object' && fbKey in fallbackCurrent) {
            fallbackCurrent = fallbackCurrent[fbKey];
          } else {
            return path;
          }
        }
        current = fallbackCurrent;
        break;
      }
    }

    if (typeof current !== 'string') {
      return path;
    }

    if (!params) {
      return current;
    }

    return current.replace(/{(\w+)}/g, (_, match) => {
      return params[match] !== undefined ? String(params[match]) : `{${match}}`;
    });
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}
