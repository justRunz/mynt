import { useTranslation } from 'react-i18next'
import { buildSlotGrid, metalFamily, type FaceValueCents } from '@mynt/core'

import { countryFlag, countryName } from '../lib/countries'
import { formatFaceValue } from '../lib/format'
import type { CollectionEntry } from '../collection/useCollection'

const FILL = {
  COPPER: 'bg-copper border-copper-edge',
  NORDIC_GOLD: 'bg-nordic border-nordic-edge',
  BIMETAL: 'bg-silver border-silver-edge',
} as const

export interface SlotCoin extends CollectionEntry {
  slotRow: number
  slotColumn: number
}

interface Props {
  rowCount: number
  columnCount: number
  coins: readonly SlotCoin[]
  onSelect: (slot: { row: number; column: number; coin: SlotCoin | null }) => void
}

export function SlotGrid({ rowCount, columnCount, coins, onSelect }: Props) {
  const { t } = useTranslation()
  const grid = buildSlotGrid(rowCount, columnCount, coins)

  return (
    <div className="flex flex-col gap-4">
      <p className="tnum text-sm text-muted">
        {t('binders.occupancy', { occupied: grid.occupied, total: rowCount * columnCount })}
      </p>

      <div className="overflow-x-auto">
        <div
          className="grid w-fit gap-2"
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {grid.rows.flatMap((row, rowIndex) =>
            row.map((coin, columnIndex) => {
              const position = { row: rowIndex + 1, column: columnIndex + 1 }
              const label = coin
                ? t('binders.slotFilled', {
                    ...position,
                    country: countryName(coin.countryCode),
                    value: formatFaceValue(coin.faceValueCents),
                    year: coin.year,
                  })
                : t('binders.slotFree', position)

              return (
                <button
                  key={`${position.row}-${position.column}`}
                  type="button"
                  aria-label={label}
                  onClick={() => onSelect({ ...position, coin })}
                  className="flex flex-col items-center gap-1 rounded-md p-1
                             hover:bg-rule/40"
                >
                  <span
                    aria-hidden
                    className={`flex size-14 items-center justify-center rounded-full border
                                text-xl ${
                                  coin
                                    ? FILL[metalFamily(coin.faceValueCents as FaceValueCents)]
                                    : 'border-dashed border-field'
                                }`}
                  >
                    {coin ? countryFlag(coin.countryCode) : ''}
                  </span>
                  <span className="tnum h-3 text-[10px] leading-3 text-muted">
                    {coin ? coin.year : ''}
                  </span>
                </button>
              )
            }),
          )}
        </div>
      </div>

      {grid.outOfBounds.length > 0 && (
        <p role="alert" className="text-sm text-danger">
          {t('binders.outOfBounds', { count: grid.outOfBounds.length })}
        </p>
      )}
    </div>
  )
}
