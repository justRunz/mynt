import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import fr from './locales/fr.json'

export const FALLBACK_LOCALE = 'fr'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr } },
    fallbackLng: FALLBACK_LOCALE,
    supportedLngs: ['fr'],
    interpolation: {
      // React escapes for us.
      escapeValue: false,
    },
  })

/**
 * index.html ships lang="fr" as a starting point; keep the document in sync
 * with the active locale. It drives screen reader pronunciation and hyphenation,
 * neither of which shows up in a visual review.
 */
const syncDocumentLanguage = (locale: string) => {
  document.documentElement.lang = locale
}

syncDocumentLanguage(i18n.resolvedLanguage ?? FALLBACK_LOCALE)
i18n.on('languageChanged', syncDocumentLanguage)

export default i18n
