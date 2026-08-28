import { describe, expect, it } from 'vitest'

import {
  NO_FILTERS,
  hasActiveFilters,
  matchesFilters,
  type FilterableCoin,
} from './collection'

const coin: FilterableCoin = {
  countryCode: 'FR',
  faceValueCents: 20,
  year: 2003,
  isFiled: true,
}

describe('matchesFilters', () => {
  it('keeps everything when no filter is set', () => {
    expect(matchesFilters(coin, NO_FILTERS)).toBe(true)
  })

  it('filters on each dimension independently', () => {
    expect(matchesFilters(coin, { ...NO_FILTERS, countryCode: 'FR' })).toBe(true)
    expect(matchesFilters(coin, { ...NO_FILTERS, countryCode: 'DE' })).toBe(false)
    expect(matchesFilters(coin, { ...NO_FILTERS, faceValueCents: 20 })).toBe(true)
    expect(matchesFilters(coin, { ...NO_FILTERS, faceValueCents: 50 })).toBe(false)
    expect(matchesFilters(coin, { ...NO_FILTERS, year: 2003 })).toBe(true)
    expect(matchesFilters(coin, { ...NO_FILTERS, year: 2004 })).toBe(false)
  })

  it('separates filed coins from the ones still in a jar', () => {
    const loose = { ...coin, isFiled: false }
    expect(matchesFilters(coin, { ...NO_FILTERS, filing: 'FILED' })).toBe(true)
    expect(matchesFilters(loose, { ...NO_FILTERS, filing: 'FILED' })).toBe(false)
    expect(matchesFilters(loose, { ...NO_FILTERS, filing: 'UNFILED' })).toBe(true)
    expect(matchesFilters(coin, { ...NO_FILTERS, filing: 'UNFILED' })).toBe(false)
  })

  it('treats a 1 cent filter as distinct from no filter at all', () => {
    // Guards the classic falsy bug: 1 cent is a real face value, and year 0
    // does not exist, but neither may be read as "unset".
    const cent = { ...coin, faceValueCents: 1 }
    expect(matchesFilters(cent, { ...NO_FILTERS, faceValueCents: 1 })).toBe(true)
    expect(matchesFilters(coin, { ...NO_FILTERS, faceValueCents: 1 })).toBe(false)
  })
})

describe('hasActiveFilters', () => {
  it('is false only for the empty filter set', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false)
    expect(hasActiveFilters({ ...NO_FILTERS, year: 2003 })).toBe(true)
    expect(hasActiveFilters({ ...NO_FILTERS, filing: 'UNFILED' })).toBe(true)
  })
})
