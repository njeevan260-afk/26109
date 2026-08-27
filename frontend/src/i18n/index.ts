import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { indianLanguagesResources, languageOptions } from './resources';

const STORAGE_KEY = 'herd-vitals-language';
const supportedCodes = new Set(languageOptions.map(language => language.code));
const savedLanguage = localStorage.getItem(STORAGE_KEY);
const browserLanguage = navigator.language.split('-')[0];
const initialLanguage = savedLanguage && supportedCodes.has(savedLanguage as never)
  ? savedLanguage
  : supportedCodes.has(browserLanguage as never)
    ? browserLanguage
    : 'en';

void i18n.use(initReactI18next).init({
  resources: indianLanguagesResources,
  lng: initialLanguage,
  fallbackLng: 'en',
  supportedLngs: languageOptions.map(language => language.code),
  interpolation: { escapeValue: false },
  returnNull: false,
});

function applyDocumentLanguage(languageCode: string) {
  const option = languageOptions.find(language => language.code === languageCode) ?? languageOptions[0];
  document.documentElement.lang = option.code;
  document.documentElement.dir = option.dir;
}

applyDocumentLanguage(initialLanguage);

i18n.on('languageChanged', languageCode => {
  localStorage.setItem(STORAGE_KEY, languageCode);
  applyDocumentLanguage(languageCode);
});

export default i18n;
