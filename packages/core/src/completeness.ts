import type { CoinType } from './db'
import { FACE_VALUES_CENTS, type FaceValueCents } from './denominations'

/**
 * A coin type is either owned, missing, or was never struck. The third state
 * matters: the generated catalog is deliberately over-generous, and a country
 * that skipped a denomination one year should read as a blank rather than as a
 * gap the collector could ever fill.
 */
export interface CompletenessCell {
  year: number
  faceValueCents: FaceValueCents
  /** False when the catalog holds no type for this country, value and year. */
  minted: boolean
  /** Copies held. Above one means duplicates, which is routine in this hobby. */
  owned: number
}

export interface CompletenessRow {
  faceValueCents: FaceValueCents
  cells: CompletenessCell[]
}

export interface Completeness {
  countryCode: string
  years: number[]
  rows: CompletenessRow[]
  /** Types held at least once, over types actually struck. */
  ownedTypes: number
  mintedTypes: number
}

const key = (faceValueCents: number, year: number) => `${faceValueCents}|${year}`

/**
 * Copies held, keyed by coin type id.
 *
 * A plain object rather than a Map on purpose: this value is cached by the
 * query client and the cache is persisted to IndexedDB as JSON. A Map survives
 * neither leg of that round trip -- it rehydrates as {} and every read of it
 * throws -- so the shape that crosses the cache has to be one JSON can carry.
 */
export type OwnedCountByTypeId = Readonly<Record<number, number>>

export function buildCompleteness(
  countryCode: string,
  coinTypes: readonly CoinType[],
  ownedCountByTypeId: OwnedCountByTypeId,
): Completeness {
  const byCell = new Map<string, number[]>()
  const years = new Set<number>()

  for (const type of coinTypes) {
    if (type.country_code !== countryCode) continue
    years.add(type.year)
    const cell = key(type.face_value_cents, type.year)
    const ids = byCell.get(cell)
    if (ids) ids.push(type.id)
    else byCell.set(cell, [type.id])
  }

  const sortedYears = [...years].sort((a, b) => a - b)
  let ownedTypes = 0
  let mintedTypes = 0

  const rows = FACE_VALUES_CENTS.map((faceValueCents) => ({
    faceValueCents,
    cells: sortedYears.map((year) => {
      // Several types can share a cell once variants exist -- German mint
      // marks, the 2007 reverse. Their copies count towards the same square.
      const ids = byCell.get(key(faceValueCents, year)) ?? []
      const owned = ids.reduce((sum, id) => sum + (ownedCountByTypeId[id] ?? 0), 0)
      const minted = ids.length > 0
      if (minted) mintedTypes += 1
      if (owned > 0) ownedTypes += 1
      return { year, faceValueCents, minted, owned }
    }),
  }))

  return { countryCode, years: sortedYears, rows, ownedTypes, mintedTypes }
}

/** Copies held per coin type, the shape buildCompleteness expects. */
export function countByCoinType(
  coins: readonly { coin_type_id: number }[],
): Record<number, number> {
  const counts: Record<number, number> = {}
  for (const coin of coins) {
    counts[coin.coin_type_id] = (counts[coin.coin_type_id] ?? 0) + 1
  }
  return counts
}
