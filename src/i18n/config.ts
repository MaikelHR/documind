/* DocuMind — i18next initialization (Spanish primary, English fallback). */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

function storedLang(): string {
  try {
    return localStorage.getItem('dm-lang') || 'es';
  } catch {
    return 'es';
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: storedLang(),
  fallbackLng: 'en',
  // Resources are bundled inline, so initialize synchronously (no flash of keys).
  initAsync: false,
  interpolation: {
    escapeValue: false,
    // Reference strings use single-brace placeholders ({n}, {q}, …).
    prefix: '{',
    suffix: '}',
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
