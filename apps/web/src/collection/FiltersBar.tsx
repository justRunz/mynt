import { useTranslation } from 'react-i18next'
import { FACE_VALUES_CENTS, hasActiveFilters, type CollectionFilters } from '@mynt/core'

import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import { Select } from '../ui/Select'
import { countryFlag, countryName } from '../lib/countries'
import { formatFaceValue } from '../lib/format'

interface Props {
  filters: CollectionFilters
  onChange: (filters: CollectionFilters) => void
  search: string
  onSearchChange: (search: string) => void
  /** Only the values actually present in the collection are offered. */
  countryCodes: readonly string[]
  years: readonly number[]
}

export function FiltersBar({
  filters,
  onChange,
  search,
  onSearchChange,
  countryCodes,
  years,
}: Props) {
  const { t } = useTranslation()
  const active = hasActiveFilters(filters) || search.trim() !== ''

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field
        label={t('filters.search')}
        type="search"
        placeholder={t('filters.searchPlaceholder')}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <Select
        label={t('filters.country')}
        value={filters.countryCode ?? ''}
        onChange={(e) => onChange({ ...filters, countryCode: e.target.value || null })}
      >
        <option value="">{t('filters.allCountries')}</option>
        {countryCodes.map((code) => (
          <option key={code} value={code}>
            {countryFlag(code)} {countryName(code)}
          </option>
        ))}
      </Select>

      <Select
        label={t('filters.faceValue')}
        value={filters.faceValueCents ?? ''}
        onChange={(e) =>
          onChange({
            ...filters,
            faceValueCents: e.target.value
              ? (Number(e.target.value) as CollectionFilters['faceValueCents'])
              : null,
          })
        }
      >
        <option value="">{t('filters.allFaceValues')}</option>
        {FACE_VALUES_CENTS.map((cents) => (
          <option key={cents} value={cents}>
            {formatFaceValue(cents)}
          </option>
        ))}
      </Select>

      <Select
        label={t('filters.year')}
        value={filters.year ?? ''}
        onChange={(e) => onChange({ ...filters, year: e.target.value ? Number(e.target.value) : null })}
      >
        <option value="">{t('filters.allYears')}</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>

      <Select
        label={t('filters.filing')}
        value={filters.filing}
        onChange={(e) =>
          onChange({ ...filters, filing: e.target.value as CollectionFilters['filing'] })
        }
      >
        <option value="ANY">{t('filters.filingANY')}</option>
        <option value="FILED">{t('filters.filingFILED')}</option>
        <option value="UNFILED">{t('filters.filingUNFILED')}</option>
      </Select>

      {active && (
        <Button
          variant="ghost"
          className="h-9"
          onClick={() => {
            onChange({ countryCode: null, faceValueCents: null, year: null, filing: 'ANY' })
            onSearchChange('')
          }}
        >
          {t('filters.reset')}
        </Button>
      )}
    </div>
  )
}
