import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FACE_VALUES_CENTS, metalFamily } from '@mynt/core'

import { Button } from '../ui/Button'
import { supabase } from '../lib/supabase'
import { countryFlag, countryName, sortCountryCodes } from '../lib/countries'
import { formatFaceValue } from '../lib/format'
import { catalogQueries } from './catalog'

const METAL_CLASS = {
  COPPER: 'bg-copper',
  NORDIC_GOLD: 'bg-nordic',
  BIMETAL: 'bg-silver',
} as const

/**
 * Placeholder home screen for step 1. It exists to prove the whole chain --
 * auth, RLS, PostgREST, TanStack Query, i18n, formatting -- works end to end.
 * Steps 2 to 5 replace it with the real screens.
 */
export function Home() {
  const { t } = useTranslation()
  const countries = useQuery(catalogQueries.countries())
  const coinTypes = useQuery(catalogQueries.coinTypes())

  const circulating = (countries.data ?? []).filter((c) => c.circulating)
  const codes = sortCountryCodes(circulating.map((c) => c.code))

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-baseline justify-between border-b border-rule pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('app.name')}</h1>
          <p className="mt-1 text-sm text-muted">{t('app.tagline')}</p>
        </div>
        <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>
          {t('common.signOut')}
        </Button>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted">{t('nav.completeness')}</h2>
        <p className="tnum mt-2 text-sm">
          {coinTypes.isPending
            ? t('common.loading')
            : `${coinTypes.data?.length ?? 0} types · ${circulating.length} pays`}
        </p>
      </section>

      <section className="mt-8">
        <ul className="flex flex-wrap gap-2">
          {FACE_VALUES_CENTS.map((cents) => (
            <li
              key={cents}
              className="flex items-center gap-2 rounded-md border border-rule px-3 py-1.5"
            >
              <span
                aria-hidden
                className={`size-3 rounded-full ${METAL_CLASS[metalFamily(cents)]}`}
              />
              <span className="tnum text-sm">{formatFaceValue(cents)}</span>
              <span className="sr-only">{t(`metal.${metalFamily(cents)}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {codes.map((code) => (
            <li key={code}>
              <span aria-hidden>{countryFlag(code)}</span> {countryName(code)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
