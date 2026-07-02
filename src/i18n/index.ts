/**
 * Internationalization setup.
 *
 * Language resolution order (i18next-browser-languagedetector):
 *   1. `metacrypt-lang` in localStorage — the user's explicit choice
 *   2. `navigator.language` — the OS / browser system language
 *   3. English fallback
 *
 * So a user with a Russian system gets Russian automatically on first
 * visit, and the manual picker always wins afterwards.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ru from './locales/ru.json';
import kk from './locales/kk.json';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'kk', label: 'Қазақша' },
] as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      kk: { translation: kk },
    },
    fallbackLng: 'en',
    // "ru-RU" → "ru", "kk-KZ" → "kk" etc.
    nonExplicitSupportedLngs: true,
    supportedLngs: ['en', 'ru', 'kk'],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'metacrypt-lang',
    },
  });

export default i18n;
