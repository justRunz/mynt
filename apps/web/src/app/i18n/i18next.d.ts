import type fr from './locales/fr.json'

/**
 * Types every translation key from fr.json, so a key that does not exist fails
 * the build instead of rendering its own name in the interface.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof fr }
  }
}
