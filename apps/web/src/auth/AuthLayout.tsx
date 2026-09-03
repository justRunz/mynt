import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { TranslationKey } from '../i18n/types'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="text-center">
        <h1 className="text-4xl">{t('app.name')}</h1>
        <p className="mt-2 text-base text-muted">{t('app.tagline')}</p>
      </header>
      {/* A floating artifact rather than a neutral card: it is the only thing on
          the page, and elevation is what the reference reserves for surfaces
          that sit on top of the paper rather than in it. */}
      <section className="rounded-lg bg-raised p-8 shadow-float">
        <h2 className="mb-6 text-2xl">{title}</h2>
        {children}
      </section>
    </main>
  )
}

export function FormError({ messageKey }: { messageKey: TranslationKey | null }) {
  const { t } = useTranslation()
  if (!messageKey) return null
  return (
    <p role="alert" className="text-sm text-danger">
      {t(messageKey)}
    </p>
  )
}

export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm text-muted">
      {children}
    </p>
  )
}
