import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { Button } from '../ui/Button'
import { supabase } from '../lib/supabase'

const LINKS = [
  { to: '/', labelKey: 'nav.collection' },
  { to: '/completeness', labelKey: 'nav.completeness' },
] as const

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">{t('app.name')}</span>

          <nav className="flex flex-1 gap-1">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm ${
                    isActive ? 'bg-rule/70 font-medium text-ink' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {t(link.labelKey)}
              </NavLink>
            ))}
          </nav>

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
