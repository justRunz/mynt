import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FACE_VALUES_CENTS, hasActiveFilters, type CollectionFilters } from '@mynt/core'

import { Field } from '../ui/Field'
import { Select } from '../ui/Select'
import { countryFlag, countryName } from '../lib/countries'
import { formatFaceValue } from '../lib/format'

interface Props {
  /** Rendered at the end of the same flex row, so the action sits with the
      filters instead of wrapping onto its own line. */
  children?: ReactNode
  filters: CollectionFilters
  onChange: (filters: CollectionFilters) => void
  search: string
  onSearchChange: (search: string) => void
  /** Only the values actually present in the collection are offered. */
  countryCodes: readonly string[]
  years: readonly number[]
}

export function FiltersBar({
  children,
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
    <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex flex-wrap items-end gap-3">
      <Field
        // Elastic rather than a fixed width: the search box absorbs the leftover
        // space so the action stays on the filter row, and shrinks instead of
        // pushing it onto its own line when a translation runs long.
        wrapperClassName="min-w-32 flex-1"
        className="w-full"
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

        <button
          type="button"
          // Always rendered, only disabled: appearing on the first active filter
          // used to insert a control into the row and shove everything sideways.
          disabled={!active}
          aria-label={t('filters.reset')}
          title={t('filters.reset')}
          onClick={() => {
            onChange({ countryCode: null, faceValueCents: null, year: null, filing: 'ANY' })
            onSearchChange('')
          }}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted
                     hover:bg-rule/60 hover:text-ink disabled:pointer-events-none
                     disabled:opacity-30"
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
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
            <path d="M12.5 1.5v3h-3" />
          </svg>
        </button>
      </div>

      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}
