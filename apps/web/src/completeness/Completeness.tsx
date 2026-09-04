import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { parseAsBoolean, parseAsString, useQueryState } from 'nuqs'
import { useTranslation } from 'react-i18next'
import { buildCompleteness, countByCoinType } from '@mynt/core'

import { catalogQueries } from '../app/catalog'
import { supabase } from '../lib/supabase'
import { countryFlag, countryName, sortCountryCodes } from '../lib/countries'
import { Select } from '../ui/Select'
import { CompletenessGrid } from './CompletenessGrid'

/**
 * Only the coin_type_id of every coin is needed here, not the joined rows the
 * collection list fetches, so this is its own small query rather than a reuse
 * of useCollection.
 */
function useOwnedTypeCounts() {
  return useQuery({
    queryKey: ['collection', 'type-counts'],
    queryFn: async () => {
      const PAGE = 1000
      const rows: { coin_type_id: number }[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('coin')
          .select('coin_type_id')
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        rows.push(...data)
        if (data.length < PAGE) break
      }
      return countByCoinType(rows)
    },
  })
}

export function Completeness() {
  const { t } = useTranslation()
  const countries = useQuery(catalogQueries.countries())
  const coinTypes = useQuery(catalogQueries.coinTypes())
  const owned = useOwnedTypeCounts()

  // In the query string, so the country being worked through survives a reload
  // and a link points at the same grid.
  const [countryCode, setCountryCode] = useQueryState('country', parseAsString.withDefault('FR'))
  const [showCollectorOnly, setShowCollectorOnly] = useQueryState(
    'collector',
    parseAsBoolean.withDefault(false),
  )

  const visibleCountries = useMemo(() => {
    const list = (countries.data ?? []).filter((c) => showCollectorOnly || c.circulating)
    return sortCountryCodes(list.map((c) => c.code))
  }, [countries.data, showCollectorOnly])

  const grid = useMemo(
    () => buildCompleteness(countryCode, coinTypes.data ?? [], owned.data ?? {}),
    [countryCode, coinTypes.data, owned.data],
  )

  if (coinTypes.isPending || owned.isPending || countries.isPending) {
    return <p className="text-sm text-muted">{t('common.loading')}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <Select
          label={t('completeness.country')}
          value={countryCode}
          onChange={(e) => void setCountryCode(e.target.value)}
        >
          {visibleCountries.map((code) => (
            <option key={code} value={code}>
              {countryFlag(code)} {countryName(code)}
            </option>
          ))}
        </Select>

        <p className="tnum pb-2 text-sm">
          {t('completeness.progress', { owned: grid.ownedTypes, total: grid.mintedTypes })}
        </p>
      </div>

      <CompletenessGrid grid={grid} />

      <Legend />

      <label className="flex items-start gap-2 border-t border-rule pt-4 text-sm text-muted">
        <input
          type="checkbox"
          checked={showCollectorOnly}
          onChange={(e) => void setShowCollectorOnly(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          {t('completeness.showCollectorOnly')}
          <span className="block text-xs">{t('completeness.collectorOnlyHint')}</span>
        </span>
      </label>
    </div>
  )
}

function Legend() {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      <li className="flex items-center gap-2">
        <span aria-hidden className="size-4 rounded-[4px] border border-nordic-edge bg-nordic" />
        {t('completeness.legend.owned')}
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="size-4 rounded-[4px] border border-dashed border-field" />
        {t('completeness.legend.missing')}
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="size-4 rounded-[4px] border border-field bg-card" />
        {t('completeness.legend.notMinted')}
      </li>
    </ul>
  )
}
