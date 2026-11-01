import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en/translation.json';
import amTranslation from './locales/am/translation.json';

const STORAGE_KEY = 'meladesk_language';

const getInitialLanguage = (): string => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'am' || saved === 'en') {
    return saved;
  }
  return 'en';
};

const initialLang = getInitialLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslation,
      },
      am: {
        translation: amTranslation,
      },
    },
    lng: initialLang,
    fallbackLng: 'en',
    supportedLngs: ['en', 'am'],
    interpolation: {
      escapeValue: false,
    },
  });

// Synchronize document language and local storage on change
i18n.on('languageChanged', (lng: string) => {
  const resolvedLng = lng.startsWith('am') ? 'am' : 'en';
  localStorage.setItem(STORAGE_KEY, resolvedLng);
  document.documentElement.lang = resolvedLng;
});

// Set initial document language attribute
document.documentElement.lang = initialLang;

export default i18n;
