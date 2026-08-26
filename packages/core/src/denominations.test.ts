import { describe, expect, it } from 'vitest'

import { FACE_VALUES_CENTS, isFaceValue, metalFamily } from './denominations'

describe('metalFamily', () => {
  it('maps every face value to the metal the mint actually uses', () => {
    expect(FACE_VALUES_CENTS.map(metalFamily)).toEqual([
      'COPPER', // 1c
      'COPPER', // 2c
      'COPPER', // 5c
      'NORDIC_GOLD', // 10c
      'NORDIC_GOLD', // 20c
      'NORDIC_GOLD', // 50c
      'BIMETAL', // 1 EUR
      'BIMETAL', // 2 EUR
    ])
  })
})

describe('isFaceValue', () => {
  it('accepts the eight circulating values', () => {
    for (const value of FACE_VALUES_CENTS) expect(isFaceValue(value)).toBe(true)
  })

  it('rejects values that were never struck', () => {
    // 25 cents is a common denomination elsewhere, never in the euro series.
    expect(isFaceValue(25)).toBe(false)
    expect(isFaceValue(0)).toBe(false)
    expect(isFaceValue(500)).toBe(false)
  })
})
