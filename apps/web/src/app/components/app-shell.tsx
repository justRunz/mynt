import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'

import { Button } from '@/app/ui/button'
import { Drawer } from '@/app/ui/drawer'
import { supabase } from '@/app/lib/supabase'

type IconProps = { className?: string }

const iconBase = {
  'aria-hidden': true,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** The list of every coin. */
function CollectionIcon({ className }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M2.5 4h1.5M6.5 4h7M2.5 8h1.5M6.5 8h7M2.5 12h1.5M6.5 12h7" />
    </svg>
  )
}

/** The grid of what is held against what was struck. */
function CompletenessIcon({ className }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <rect x="2.25" y="2.25" width="5" height="5" rx="1.25" />
      <rect x="8.75" y="2.25" width="5" height="5" rx="1.25" />
      <rect x="2.25" y="8.75" width="5" height="5" rx="1.25" />
      <rect x="8.75" y="8.75" width="5" height="5" rx="1.25" />
    </svg>
  )
}

/** An album seen closed, spine on the left. */
function BindersIcon({ className }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="1.5" />
      <path d="M5.5 2.25v11.5M3.75 5.5h.25M3.75 8h.25M3.75 10.5h.25" />
    </svg>
  )
}

/** Leaving: a door standing open, and the arrow on its way out. */
function SignOutIcon({ className }: IconProps) {
  return (
    <svg {...iconBase} className={className}>
      <path d="M6.5 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" />
      <path d="M10.5 5.5 13 8l-2.5 2.5M13 8H6.5" />
    </svg>
  )
}

const LINKS = [
  { to: '/', labelKey: 'nav.collection', Icon: CollectionIcon },
  { to: '/completeness', labelKey: 'nav.completeness', Icon: CompletenessIcon },
  { to: '/binders', labelKey: 'nav.binders', Icon: BindersIcon },
] as const

function NavLinks({ onNavigate, className }: { onNavigate?: () => void; className: string }) {
  const { t } = useTranslation()
  return (
    <nav className={className}>
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 py-0.5 ${
              isActive ? 'font-[480] text-ink' : 'text-muted hover:text-ink'
            }`
          }
        >
          {/* The glyph inherits the link's colour, so the active state is said
              once and applies to both halves. */}
          <link.Icon className="size-4 shrink-0" />
          {t(link.labelKey)}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * Set off by a rule and pushed to the foot of whichever container holds it, so
 * it reads as the way out rather than as a fourth destination.
 */
function SignOutAction({ onSignOut }: { onSignOut: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="mt-auto w-full border-t border-rule pt-4">
      <Button variant="quiet" className="-ml-2" onClick={onSignOut}>
        <SignOutIcon className="size-4 shrink-0" />
        {t('common.signOut')}
      </Button>
    </div>
  )
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const signOut = () => void supabase.auth.signOut()

  return (
    // Two tracks rather than two flex children. minmax(0, 1fr) is the point:
    // a flex item's automatic minimum size is its content, which is why the
    // content column needed min-w-0 bolted on or the completeness grid would
    // push the page wider than the window. Here the track simply cannot exceed
    // its share, and the rule lives with the columns instead of on a child.
    <div className="md:grid md:min-h-dvh md:grid-cols-[14rem_minmax(0,1fr)]">
      {/* Flush against the left edge of the window rather than inset in the
          centred column: a navigation bar is part of the frame, not a card
          floating in the page. Sticky and the full height of the viewport, so
          the mist band never stops short of the fold. */}
      <aside
        // self-start matters: a grid item is stretched to the row by default,
        // and an item as tall as the thing it scrolls within has nowhere to
        // stick.
        className="hidden md:sticky md:top-0 md:flex md:h-dvh md:self-start
                   md:flex-col md:items-start md:gap-6 md:border-r md:border-rule
                   md:px-6 md:py-10 md:shadow-rail"
      >
        <span className="font-serif text-xl">{t('app.name')}</span>
        <NavLinks className="flex flex-col gap-3 self-stretch text-base" />
        <SignOutAction onSignOut={signOut} />
      </aside>

      <div>
        {/* Phone: a bar with the menu button, since a column would eat the
            width the completeness grid needs. */}
        <div className="flex items-center gap-2 px-6 py-4 md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            // haspopup rather than aria-expanded: this opens a modal dialog,
            // not an inline disclosure.
            aria-haspopup="dialog"
            aria-label={t('nav.openMenu')}
            className="-ml-2 flex size-11 items-center justify-center rounded-md text-ink
                       hover:bg-hover"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
            </svg>
          </button>
          <span className="font-serif text-xl">{t('app.name')}</span>
        </div>

        <main className="mx-auto max-w-[1200px] px-6 pb-20 md:pt-10">
          <h1 className="mb-8 text-3xl">{title}</h1>
          {children}
        </main>
      </div>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title={t('app.name')}>
        {/* Closed on navigation: leaving it open over the page just arrived at
            would hide the thing the tap asked for. */}
        <NavLinks
          onNavigate={() => setMenuOpen(false)}
          className="flex flex-col gap-2 text-lg"
        />
        <SignOutAction onSignOut={signOut} />
      </Drawer>
    </div>
  )
}
