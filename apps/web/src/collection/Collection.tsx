import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  NO_FILTERS,
  matchesFilters,
  metalFamily,
  type CollectionFilters,
  type FaceValueCents,
} from '@mynt/core'

import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { countryCollator, countryFlag, countryName } from '../lib/countries'
import { formatFaceValue } from '../lib/format'
import { matchesSearch } from '../lib/search'
import { FiltersBar } from './FiltersBar'
import { QuickAdd } from './QuickAdd'
import { useCollection, type CollectionEntry } from './useCollection'

const METAL_DOT = {
  COPPER: 'bg-copper',
  NORDIC_GOLD: 'bg-nordic',
  BIMETAL: 'bg-silver',
} as const

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-rule px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  )
}

export function Collection() {
  const { t } = useTranslation()
  const { data, isPending, isError } = useCollection()
  const [filters, setFilters] = useState<CollectionFilters>(NO_FILTERS)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)

  const entries = useMemo(() => data ?? [], [data])

  // Filter options come from the collection itself, so the user is never
  // offered a country or a year that would return nothing.
  const countryCodes = useMemo(() => {
    const codes = [...new Set(entries.map((e) => e.countryCode))]
    const collator = countryCollator()
    return codes.sort((a, b) => collator.compare(countryName(a), countryName(b)))
  }, [entries])

  const years = useMemo(
    () => [...new Set(entries.map((e) => e.year))].sort((a, b) => a - b),
    [entries],
  )

  const visible = useMemo(() => {
    const collator = countryCollator()
    return entries
      .filter((entry) =>
        matchesFilters(
          {
            countryCode: entry.countryCode,
            faceValueCents: entry.faceValueCents,
            year: entry.year,
            isFiled: entry.location !== null,
          },
          filters,
        ),
      )
      .filter((entry) => matchesSearch([countryName(entry.countryCode), entry.notes], search))
      .sort(
        (a, b) =>
          collator.compare(countryName(a.countryCode), countryName(b.countryCode)) ||
          a.faceValueCents - b.faceValueCents ||
          a.year - b.year,
      )
  }, [entries, filters, search])

  if (isError) {
    return <p className="text-sm text-danger">{t('collection.error')}</p>
  }

  if (isPending) {
    return <p className="text-sm text-muted">{t('common.loading')}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <FiltersBar
        filters={filters}
        onChange={setFilters}
        search={search}
        onSearchChange={setSearch}
        countryCodes={countryCodes}
        years={years}
      >
        <Button onClick={() => setAddOpen(true)}>{t('quickAdd.open')}</Button>
      </FiltersBar>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('quickAdd.title')}>
        <QuickAdd />
      </Modal>

      {entries.length === 0 ? (
        <EmptyState title={t('collection.empty.title')} body={t('collection.empty.body')} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={t('collection.noResults.title')}
          body={t('collection.noResults.body')}
        />
      ) : (
        <>
          <p className="text-sm text-muted">{t('collection.count', { count: visible.length })}</p>
          <CollectionTable entries={visible} />
        </>
      )}
    </div>
  )
}

function CollectionTable({ entries }: { entries: readonly CollectionEntry[] }) {
  const { t } = useTranslation()

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs font-medium text-muted">
            <th scope="col" className="py-2 pr-4 font-medium">
              {t('collection.columns.country')}
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              {t('collection.columns.faceValue')}
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">
              {t('collection.columns.year')}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {t('collection.columns.grade')}
            </th>
            <th scope="col" className="py-2 font-medium">
              {t('collection.columns.location')}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-rule/60">
              <td className="py-2 pr-4 whitespace-nowrap">
                <span aria-hidden>{countryFlag(entry.countryCode)}</span>{' '}
                {countryName(entry.countryCode)}
              </td>
              <td className="py-2 pr-4 text-right whitespace-nowrap">
                <span
                  aria-hidden
                  className={`mr-2 inline-block size-2 rounded-full align-middle ${
                    METAL_DOT[metalFamily(entry.faceValueCents as FaceValueCents)]
                  }`}
                />
                {formatFaceValue(entry.faceValueCents)}
              </td>
              <td className="py-2 pr-4 text-right">{entry.year}</td>
              <td className="py-2 pr-4 whitespace-nowrap">
                {entry.grade ? t(`grade.short.${entry.grade}`) : <span className="text-muted">—</span>}
              </td>
              <td className="py-2 whitespace-nowrap">
                {entry.location ? (
                  t('collection.slot', {
                    binder: entry.location.binderName,
                    page: entry.location.pageNumber,
                    row: entry.location.row,
                    column: entry.location.column,
                  })
                ) : (
                  <span className="text-muted">{t('collection.unfiled')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
