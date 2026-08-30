import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  GRADES,
  findCoinTypeId,
  indexCoinTypes,
  newId,
  type FaceValueCents,
  type Grade,
} from '@mynt/core'

import { useAuth } from '../auth/authContext'
import { catalogQueries } from '../app/catalog'
import { countryFlag, countryName } from '../lib/countries'
import { formatFaceValue } from '../lib/format'
import type { TranslationKey } from '../i18n/types'
import { Button } from '../ui/Button'
import { CountryCombobox } from './CountryCombobox'
import { FaceValuePicker } from './FaceValuePicker'
import { useAddCoin } from './useAddCoin'
import type { CollectionEntry } from './useCollection'

const CURRENT_YEAR = new Date().getFullYear()

export function QuickAdd() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const countries = useQuery(catalogQueries.countries())
  const coinTypes = useQuery(catalogQueries.coinTypes())
  const addCoin = useAddCoin()

  const [countryCode, setCountryCode] = useState<string | null>(null)
  const [faceValue, setFaceValue] = useState<FaceValueCents | null>(null)
  const [year, setYear] = useState('')
  const [grade, setGrade] = useState<Grade | ''>('')
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [notInCatalog, setNotInCatalog] = useState<string | null>(null)
  const [recent, setRecent] = useState<CollectionEntry[]>([])

  const firstValueRef = useRef<HTMLInputElement>(null)
  const index = useMemo(() => indexCoinTypes(coinTypes.data ?? []), [coinTypes.data])
  const codes = useMemo(() => (countries.data ?? []).map((c) => c.code), [countries.data])

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setErrorKey(null)
    setNotInCatalog(null)

    const profileId = session?.user.id
    if (!profileId) return
    if (!countryCode) return setErrorKey('quickAdd.errors.countryRequired')
    if (faceValue === null) return setErrorKey('quickAdd.errors.faceValueRequired')

    const parsedYear = Number(year)
    if (!/^\d{4}$/.test(year) || parsedYear < 1999 || parsedYear > CURRENT_YEAR) {
      return setErrorKey('quickAdd.errors.yearRequired')
    }

    const coinTypeId = findCoinTypeId(index, countryCode, faceValue, parsedYear)
    if (coinTypeId === null) {
      return setNotInCatalog(
        t('quickAdd.errors.notInCatalog', {
          country: countryName(countryCode),
          value: formatFaceValue(faceValue),
          year: parsedYear,
        }),
      )
    }

    const entry: CollectionEntry = {
      id: newId(),
      countryCode,
      faceValueCents: faceValue,
      year: parsedYear,
      variant: '',
      grade: grade || null,
      acquiredOn: null,
      notes: null,
      location: null,
    }

    addCoin.mutate(
      {
        // Generated here, not inside the mutation: a mutation replayed after a
        // reload has to carry the same id or it would insert a second coin.
        id: entry.id,
        profileId,
        coinTypeId,
        grade: entry.grade,
        countryCode,
        faceValueCents: faceValue,
        year: parsedYear,
      },
      {
        onError: () => {
          setRecent((list) => list.filter((e) => e.id !== entry.id))
          setErrorKey('quickAdd.errors.save')
        },
      },
    )

    // Confirmed and reset as soon as the entry is queued, not when the server
    // answers. Offline the mutation stays paused for as long as the signal is
    // gone, and a form that never clears would break the one thing this screen
    // is for -- working through a pile without stopping.
    setRecent((list) => [entry, ...list].slice(0, 6))
    // The country stays: a pile is usually sorted by country, and re-picking it
    // on every coin is the friction that makes people quit.
    setFaceValue(null)
    setYear('')
    setGrade('')
    firstValueRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-prose text-sm text-muted">{t('quickAdd.intro')}</p>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <CountryCombobox codes={codes} value={countryCode} onChange={setCountryCode} />

        <FaceValuePicker
          name="quick-add-face-value"
          value={faceValue}
          onChange={setFaceValue}
          firstRef={firstValueRef}
        />

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="year" className="text-sm font-medium text-muted">
              {t('quickAdd.year')}
            </label>
            <input
              id="year"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              placeholder="2003"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))}
              className="tnum h-10 w-28 rounded-md border border-field bg-raised px-3 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="grade" className="text-sm font-medium text-muted">
              {t('quickAdd.grade')}
            </label>
            <select
              id="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value as Grade | '')}
              className="h-10 rounded-md border border-field bg-raised px-2 text-sm"
            >
              <option value="">{t('quickAdd.gradeNone')}</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {t(`grade.${g}`)}
                </option>
              ))}
            </select>
          </div>

          {/* isPending alone would stay true for as long as a mutation sits
              paused offline, locking the form after the first coin -- the exact
              opposite of what this screen is for. Only an in-flight request
              should block it. */}
          <Button type="submit" disabled={addCoin.isPending && !addCoin.isPaused}>
            {t('quickAdd.submit')}
          </Button>
        </div>

        {errorKey && (
          <p role="alert" className="text-sm text-danger">
            {t(errorKey)}
          </p>
        )}
        {notInCatalog && (
          <p role="alert" className="max-w-prose text-sm text-danger">
            {notInCatalog}
          </p>
        )}
      </form>

      {recent.length > 0 && (
        <section aria-live="polite" className="border-t border-rule pt-6">
          <h2 className="text-sm font-medium text-muted">
            {t('quickAdd.recent')} · {t('quickAdd.added', { count: recent.length })}
          </h2>
          <ul className="tnum mt-3 flex flex-col gap-1 text-sm">
            {recent.map((entry) => (
              <li key={entry.id}>
                <span aria-hidden>{countryFlag(entry.countryCode)}</span>{' '}
                {countryName(entry.countryCode)} · {formatFaceValue(entry.faceValueCents)} ·{' '}
                {entry.year}
                {entry.grade ? ` · ${t(`grade.short.${entry.grade}`)}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
