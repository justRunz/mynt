import type { FaceValueCents } from './denominations'

/**
 * Filters applied to a collection listing.
 *
 * Structural only. Text search runs on localised country names, which needs a
 * locale, so it stays in the front end rather than here.
 */
export interface CollectionFilters {
  countryCode: string | null
  faceValueCents: FaceValueCents | null
  year: number | null
  /** Whether the coin sits in a binder slot or is still loose in a jar. */
  filing: 'ANY' | 'FILED' | 'UNFILED'
}

export const NO_FILTERS: CollectionFilters = {
  countryCode: null,
  faceValueCents: null,
  year: null,
  filing: 'ANY',
}

/** The minimum a coin has to expose to be filtered. */
export interface FilterableCoin {
  countryCode: string
  faceValueCents: number
  year: number
  isFiled: boolean
}

export function matchesFilters(
  coin: FilterableCoin,
  filters: CollectionFilters,
): boolean {
  if (filters.countryCode !== null && coin.countryCode !== filters.countryCode) {
    return false
  }
  if (
    filters.faceValueCents !== null &&
    coin.faceValueCents !== filters.faceValueCents
  ) {
    return false
  }
  if (filters.year !== null && coin.year !== filters.year) return false
  if (filters.filing === 'FILED' && !coin.isFiled) return false
  if (filters.filing === 'UNFILED' && coin.isFiled) return false
  return true
}

export function hasActiveFilters(filters: CollectionFilters): boolean {
  return (
    filters.countryCode !== null ||
    filters.faceValueCents !== null ||
    filters.year !== null ||
    filters.filing !== 'ANY'
  )
}
