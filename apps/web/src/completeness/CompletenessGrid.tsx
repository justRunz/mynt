import { useTranslation } from 'react-i18next'
import { metalFamily, type Completeness, type CompletenessCell } from '@mynt/core'

import { countryName } from '../lib/countries'
import { formatFaceValue } from '../lib/format'

/**
 * Owned cells are filled with the metal of the denomination, so the grid
 * literally fills with copper and gold as the collection completes. State never
 * rests on hue alone: filled against outlined is the second channel, which
 * matters here more than usual since the palette is copper and gold, straddling
 * the red-green axis.
 */
const FILL = {
  COPPER: 'bg-copper border-copper-edge',
  NORDIC_GOLD: 'bg-nordic border-nordic-edge',
  BIMETAL: 'bg-silver border-silver-edge',
} as const

function Cell({ cell, countryCode }: { cell: CompletenessCell; countryCode: string }) {
  const { t } = useTranslation()
  const labelArgs = {
    country: countryName(countryCode),
    value: formatFaceValue(cell.faceValueCents),
    year: cell.year,
  }

  if (!cell.minted) {
    return (
      <td className="p-0.5">
        <div
          // A faint solid rather than nothing at all: a blank square is
          // indistinguishable from padding, and "never struck" is a real answer
          // to give a collector, not an absence of one.
          className="size-7 rounded-sm bg-rule/60"
          role="img"
          aria-label={t('completeness.cell.notMinted', labelArgs)}
        />
      </td>
    )
  }

  if (cell.owned === 0) {
    return (
      <td className="p-0.5">
        <div
          className="size-7 rounded-sm border border-dashed border-field"
          role="img"
          aria-label={t('completeness.cell.missing', labelArgs)}
        />
      </td>
    )
  }

  return (
    <td className="p-0.5">
      <div
        role="img"
        aria-label={
          cell.owned > 1
            ? t('completeness.cell.duplicates', { ...labelArgs, count: cell.owned })
            : t('completeness.cell.owned', labelArgs)
        }
        className={`tnum flex size-7 items-center justify-center rounded-sm border
                    text-[11px] font-medium text-on-metal
                    ${FILL[metalFamily(cell.faceValueCents)]}`}
      >
        {/* Only worth the ink when there is more than one copy. */}
        {cell.owned > 1 ? cell.owned : ''}
      </div>
    </td>
  )
}

export function CompletenessGrid({ grid }: { grid: Completeness }) {
  const { t } = useTranslation()

  if (grid.years.length === 0) {
    return <p className="text-sm text-muted">{t('completeness.empty')}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-surface pr-3 text-right">
              <span className="sr-only">{t('collection.columns.faceValue')}</span>
            </th>
            {grid.years.map((year) => (
              <th
                key={year}
                scope="col"
                className="tnum px-0.5 pb-1 text-xs font-medium text-muted"
              >
                {/* Vertical, because 25 four-digit years will not fit flat. */}
                <span className="block [writing-mode:vertical-rl]">{year}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.faceValueCents}>
              <th
                scope="row"
                className="tnum sticky left-0 z-10 bg-surface pr-3 text-right text-xs
                           font-medium whitespace-nowrap text-muted"
              >
                {formatFaceValue(row.faceValueCents)}
              </th>
              {row.cells.map((cell) => (
                <Cell key={cell.year} cell={cell} countryCode={grid.countryCode} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
