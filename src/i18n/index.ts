import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from '../../public/locales/en/translation.json';
import zhTranslation from '../../public/locales/zh/translation.json';

/**
 * Configures i18next with bundled English and Chinese translations.
 * No HTTP backend is used; JSON resources are imported at build time.
 */
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslation },
    zh: { translation: zhTranslation },
  },
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'zh'],
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
