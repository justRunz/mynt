import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildSlotGrid } from '@mynt/core'

import type { SlotDestination } from '@/app/lib/mutations'
import { useBinders } from '@/app/binders/hooks/use-binders'
import { Select } from '@/app/ui/select'
import { useCollection } from '../hooks/use-collection'

interface Props {
  value: SlotDestination | null
  onChange: (value: SlotDestination | null) => void
}

const slotValue = (row: number, column: number) => `${row}-${column}`

/**
 * Choosing where a coin goes, as three lists rather than a picture of the page.
 * The binder view already draws the grid; here the point is to name a hole in
 * two clicks while working through a pile, so the third list offers only the
 * holes that are actually free and the invalid choice cannot be made.
 */
export function SlotSelect({ value, onChange }: Props) {
  const { t } = useTranslation()
  const binders = useBinders()
  const collection = useCollection()

  const withPages = useMemo(
    () => (binders.data ?? []).filter((binder) => binder.pages.length > 0),
    [binders.data],
  )

  const [binderId, setBinderId] = useState<string | null>(null)
  const [pageId, setPageId] = useState<string | null>(null)

  const binder = withPages.find((b) => b.id === binderId) ?? withPages[0] ?? null
  const page = binder?.pages.find((p) => p.id === pageId) ?? binder?.pages[0] ?? null

  // Read from the collection cache rather than a query of its own, so a coin
  // filed a second ago has already taken its hole out of the list.
  const grid = useMemo(() => {
    if (!page) return null
    const filed = (collection.data ?? [])
      .filter((entry) => entry.location?.pageId === page.id)
      .map((entry) => ({
        slotRow: entry.location?.row ?? 0,
        slotColumn: entry.location?.column ?? 0,
      }))
    return buildSlotGrid(page.rowCount, page.columnCount, filed)
  }, [collection.data, page])

  const freeSlots = useMemo(() => {
    if (!grid) return []
    return grid.rows.flatMap((row, rowIndex) =>
      row.flatMap((coin, columnIndex) =>
        coin ? [] : [{ row: rowIndex + 1, column: columnIndex + 1 }],
      ),
    )
  }, [grid])

  if (binders.isPending) return null

  if (withPages.length === 0) {
    return <p className="max-w-prose text-sm text-muted">{t('quickAdd.noBinders')}</p>
  }

  function selectPage(nextBinderId: string, nextPageId: string | null) {
    setBinderId(nextBinderId)
    setPageId(nextPageId)
    // The hole numbers mean nothing on a different page, so the choice cannot
    // survive a change of page.
    onChange(null)
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-[450] text-muted">{t('quickAdd.filing')}</legend>

      <div className="flex flex-wrap items-end gap-4">
        <Select
          dense
          label={t('binders.binder')}
          value={binder?.id ?? ''}
          onChange={(e) => {
            const next = withPages.find((b) => b.id === e.target.value)
            selectPage(e.target.value, next?.pages[0]?.id ?? null)
          }}
        >
          {withPages.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>

        <Select
          dense
          label={t('binders.page')}
          value={page?.id ?? ''}
          onChange={(e) => selectPage(binder?.id ?? '', e.target.value)}
        >
          {(binder?.pages ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {t('binders.pageNumber', { number: p.number })}
            </option>
          ))}
        </Select>

        <Select
          dense
          label={t('quickAdd.slot')}
          value={value ? slotValue(value.row, value.column) : ''}
          onChange={(e) => {
            if (!e.target.value || !page) return onChange(null)
            const [row, column] = e.target.value.split('-').map(Number)
            onChange({ pageId: page.id, row: row!, column: column! })
          }}
        >
          {/* Filing stays optional: a coin with no hole chosen goes to the jar,
              which is what every coin did before this existed. */}
          <option value="">{t('quickAdd.slotNone')}</option>
          {freeSlots.map((slot) => (
            <option key={slotValue(slot.row, slot.column)} value={slotValue(slot.row, slot.column)}>
              {t('binders.slotShort', slot)}
            </option>
          ))}
        </Select>
      </div>

      {grid && (
        <p className="tnum text-sm text-muted">
          {grid.free === 0
            ? t('quickAdd.pageFull')
            : t('binders.occupancy', {
                occupied: grid.occupied,
                total: page ? page.rowCount * page.columnCount : 0,
              })}
        </p>
      )}
    </fieldset>
  )
}
