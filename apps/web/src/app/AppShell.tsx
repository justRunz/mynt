import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../ui/Button'
import { supabase } from '../lib/supabase'

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">{t('app.name')}</span>
          <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>
            {t('common.signOut')}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">{title}</h1>
        {children}
      </main>
    </div>
  )
}
