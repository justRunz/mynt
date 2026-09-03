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
import { EditCoin } from './EditCoin'
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
    // A neutral card, flat: the reference reserves elevation for floating
    // artifacts and has no dashed borders anywhere in its inventory.
    <div className="rounded-xl bg-card px-6 py-16 text-center">
      <h2 className="text-2xl">{title}</h2>
      <p className="mt-2 text-base text-muted">{body}</p>
    </div>
  )
}

export function Collection() {
  const { t } = useTranslation()
  const { data, isPending, isError } = useCollection()
  const [filters, setFilters] = useState<CollectionFilters>(NO_FILTERS)
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<CollectionEntry | null>(null)

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

      <EditCoin coin={editing} onClose={() => setEditing(null)} />

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
          <CollectionTable entries={visible} onEdit={setEditing} />
        </>
      )}
    </div>
  )
}

function CollectionTable({
  entries,
  onEdit,
}: {
  entries: readonly CollectionEntry[]
  onEdit: (entry: CollectionEntry) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-base">
        <thead>
          <tr className="border-b border-rule text-left text-sm font-[450] text-muted">
            <th scope="col" className="py-3 pr-4 font-[450]">
              {t('collection.columns.country')}
            </th>
            <th scope="col" className="py-3 pr-4 text-right font-[450]">
              {t('collection.columns.faceValue')}
            </th>
            <th scope="col" className="py-3 pr-4 text-right font-[450]">
              {t('collection.columns.year')}
            </th>
            <th scope="col" className="py-3 pr-4 font-[450]">
              {t('collection.columns.grade')}
            </th>
            <th scope="col" className="py-3 pr-4 font-[450]">
              {t('collection.columns.location')}
            </th>
            <th scope="col" className="py-3">
              <span className="sr-only">{t('collection.columns.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-rule hover:bg-band">
              <td className="py-3 pr-4 whitespace-nowrap">
                <span aria-hidden>{countryFlag(entry.countryCode)}</span>{' '}
                {countryName(entry.countryCode)}
              </td>
              <td className="py-3 pr-4 text-right whitespace-nowrap">
                <span
                  aria-hidden
                  className={`mr-2 inline-block size-2 rounded-full align-middle ${
                    METAL_DOT[metalFamily(entry.faceValueCents as FaceValueCents)]
                  }`}
                />
                {formatFaceValue(entry.faceValueCents)}
              </td>
              <td className="py-3 pr-4 text-right">{entry.year}</td>
              <td className="py-3 pr-4 whitespace-nowrap">
                {entry.grade ? t(`grade.short.${entry.grade}`) : <span className="text-muted">—</span>}
              </td>
              <td className="py-3 pr-4 whitespace-nowrap">
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
              <td className="py-3 text-right">
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  aria-label={t('editCoin.open', {
                    country: countryName(entry.countryCode),
                    value: formatFaceValue(entry.faceValueCents),
                    year: entry.year,
                  })}
                  className="ml-auto flex size-9 items-center justify-center rounded-full
                             text-muted hover:bg-card hover:text-ink"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M11.2 2.3l2.5 2.5-8 8-3.2.7.7-3.2z" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
