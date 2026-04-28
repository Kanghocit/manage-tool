import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en/translation.json'
import vi from './locales/vi/translation.json'

const STORAGE_KEY = 'tool-admin-locale'

const saved = localStorage.getItem(STORAGE_KEY)
const initialLanguage = saved === 'vi' || saved === 'en' ? saved : 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      vi: { translation: vi },
    },
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  })

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng)
})

export default i18n
