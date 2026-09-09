import { describe, expect, it } from 'vitest'
import type { CoinType } from './catalog-types'

import { findCoinTypeId, indexCoinTypes } from './catalog'

const type = (
  coinTypeId: number,
  countryCode: string,
  faceValueCents: number,
  year: number,
  variant = '',
): CoinType => ({ coinTypeId, countryCode, faceValueCents, year, variant })

const catalog = [
  type(1, 'FR', 20, 2003),
  type(2, 'FR', 20, 2004),
  type(3, 'DE', 20, 2003),
  type(4, 'DE', 2, 2002, 'MINT_F'),
]

describe('findCoinTypeId', () => {
  const index = indexCoinTypes(catalog)

  it('resolves a coin type from its four identifying columns', () => {
    expect(findCoinTypeId(index, 'FR', 20, 2003)).toBe(1)
    expect(findCoinTypeId(index, 'DE', 20, 2003)).toBe(3)
  })

  it('returns null for a coin the catalog does not carry', () => {
    // France struck coins dated 1999 to 2001 before the changeover, but the
    // seed starts at 2002, so this is a real gap rather than a made-up case.
    expect(findCoinTypeId(index, 'FR', 20, 2001)).toBeNull()
    expect(findCoinTypeId(index, 'FR', 25, 2003)).toBeNull()
  })

  it('keeps variants apart, since they are part of the identity', () => {
    expect(findCoinTypeId(index, 'DE', 2, 2002, 'MINT_F')).toBe(4)
    expect(findCoinTypeId(index, 'DE', 2, 2002)).toBeNull()
  })
})
