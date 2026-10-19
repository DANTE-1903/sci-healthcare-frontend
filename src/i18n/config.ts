import en from '@/messages/en.json';
import fr from '@/messages/fr.json';
import sw from '@/messages/sw.json';

export const locales = ['en', 'fr', 'sw'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const messages: Record<Locale, typeof en> = {
  en,
  fr,
  sw,
};

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  sw: 'Kiswahili',
};

export const localeNumberFormats: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  sw: 'sw-KE',
};

export const localeDateFormats: Record<Locale, string> = {
  en: 'en-GB',
  fr: 'fr-FR',
  sw: 'sw-KE',
};
