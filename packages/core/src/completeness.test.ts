import { describe, expect, it } from 'vitest'
import type { CoinType } from './db'

import { buildCompleteness, countByCoinType } from './completeness'

const type = (
  id: number,
  country_code: string,
  face_value_cents: number,
  year: number,
  variant = '',
): CoinType => ({ id, country_code, face_value_cents, year, variant })

// Croatia joined in 2023, so its catalog is small enough to reason about.
const catalog = [
  type(1, 'HR', 1, 2023),
  type(2, 'HR', 2, 2023),
  type(3, 'HR', 1, 2024),
  type(4, 'FR', 1, 2023),
]

describe('buildCompleteness', () => {
  it('lays years out in columns and only for the country asked for', () => {
    const grid = buildCompleteness('HR', catalog, new Map())
    expect(grid.years).toEqual([2023, 2024])
    expect(grid.rows).toHaveLength(8)
    expect(grid.rows[0]?.faceValueCents).toBe(1)
  })

  it('marks cells the catalog never struck, which are not gaps to fill', () => {
    const grid = buildCompleteness('HR', catalog, new Map())
    const twoCents = grid.rows.find((r) => r.faceValueCents === 2)
    expect(twoCents?.cells.find((c) => c.year === 2023)?.minted).toBe(true)
    expect(twoCents?.cells.find((c) => c.year === 2024)?.minted).toBe(false)
    // Three struck types for Croatia, none of them owned yet.
    expect(grid.mintedTypes).toBe(3)
    expect(grid.ownedTypes).toBe(0)
  })

  it('counts duplicates without counting the type twice', () => {
    const owned = countByCoinType([
      { coin_type_id: 1 },
      { coin_type_id: 1 },
      { coin_type_id: 1 },
      { coin_type_id: 2 },
    ])
    const grid = buildCompleteness('HR', catalog, owned)
    const cell = grid.rows[0]?.cells.find((c) => c.year === 2023)
    expect(cell?.owned).toBe(3)
    expect(grid.ownedTypes).toBe(2)
    expect(grid.mintedTypes).toBe(3)
  })

  it('sums copies across variants sharing one square', () => {
    // What German mint marks will look like: same country, value and year.
    const withVariants = [
      ...catalog,
      type(5, 'HR', 1, 2023, 'MINT_A'),
      type(6, 'HR', 1, 2023, 'MINT_D'),
    ]
    const owned = countByCoinType([{ coin_type_id: 5 }, { coin_type_id: 6 }])
    const grid = buildCompleteness('HR', withVariants, owned)
    expect(grid.rows[0]?.cells.find((c) => c.year === 2023)?.owned).toBe(2)
  })

  it('returns an empty grid for a country with no catalog entry', () => {
    const grid = buildCompleteness('XX', catalog, new Map())
    expect(grid.years).toEqual([])
    expect(grid.mintedTypes).toBe(0)
  })
})
