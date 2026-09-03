import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { Button } from '../ui/Button'
import { supabase } from '../lib/supabase'

const LINKS = [
  { to: '/', labelKey: 'nav.collection' },
  { to: '/completeness', labelKey: 'nav.completeness' },
  { to: '/binders', labelKey: 'nav.binders' },
] as const

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className="min-h-dvh">
      {/* The reference's nav is whisper-quiet: no background, no shadow, and no
          rule under it. The page is one sheet of paper, not a dashboard shell
          with a chrome bar bolted on top. */}
      <header>
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-6">
          <span className="font-serif text-xl">{t('app.name')}</span>

          <nav className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `py-0.5 text-base ${
                    isActive ? 'font-[480] text-ink' : 'text-muted hover:text-ink'
                  }`
                }
              >
                {t(link.labelKey)}
              </NavLink>
            ))}
          </nav>

          <Button variant="quiet" onClick={() => void supabase.auth.signOut()}>
            {t('common.signOut')}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 pb-20 pt-6">
        <h1 className="mb-8 text-3xl">{title}</h1>
        {children}
      </main>
    </div>
  )
}
