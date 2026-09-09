import type { CoinType } from './catalog-types'

/**
 * A coin type is identified by country, face value, year and variant -- the
 * same four columns as the unique key in the database.
 */
export function coinTypeKey(
  countryCode: string,
  faceValueCents: number,
  year: number,
  variant = '',
): string {
  return `${countryCode}|${faceValueCents}|${year}|${variant}`
}

/**
 * Index the catalog by that key so the quick-add form can resolve a coin type
 * without a round trip. The catalog is immutable and cached client side, so the
 * index is built once.
 */
export function indexCoinTypes(types: readonly CoinType[]): Map<string, number> {
  const index = new Map<string, number>()
  for (const type of types) {
    index.set(
      coinTypeKey(type.countryCode, type.faceValueCents, type.year, type.variant),
      type.coinTypeId,
    )
  }
  return index
}

export function findCoinTypeId(
  index: ReadonlyMap<string, number>,
  countryCode: string,
  faceValueCents: number,
  year: number,
  variant = '',
): number | null {
  return index.get(coinTypeKey(countryCode, faceValueCents, year, variant)) ?? null
}
