import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { TranslationKey } from '../i18n/types'

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('app.name')}</h1>
        <p className="mt-1 text-sm text-muted">{t('app.tagline')}</p>
      </header>
      <section className="rounded-lg border border-rule bg-raised p-6">
        <h2 className="mb-5 text-base font-medium">{title}</h2>
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
