import { describe, expect, it } from 'vitest'

import { buildSlotGrid } from './binder'

const at = (slotRow: number, slotColumn: number, id = `${slotRow}-${slotColumn}`) => ({
  id,
  slotRow,
  slotColumn,
})

describe('buildSlotGrid', () => {
  it('lays coins out row-major and leaves free holes null', () => {
    const grid = buildSlotGrid(2, 3, [at(1, 1), at(2, 3)])
    expect(grid.rows).toHaveLength(2)
    expect(grid.rows[0]).toHaveLength(3)
    expect(grid.rows[0]?.[0]?.id).toBe('1-1')
    expect(grid.rows[0]?.[1]).toBeNull()
    expect(grid.rows[1]?.[2]?.id).toBe('2-3')
    expect(grid.occupied).toBe(2)
    expect(grid.free).toBe(4)
  })

  it('is 1-based, matching the database columns', () => {
    const grid = buildSlotGrid(1, 1, [at(1, 1)])
    expect(grid.rows[0]?.[0]).not.toBeNull()
  })

  it('surfaces coins stranded outside a page that was shrunk', () => {
    // The database cannot enforce slot_row <= page.row_count across tables, so
    // this is reachable and must not silently swallow a coin.
    const grid = buildSlotGrid(2, 2, [at(1, 1), at(5, 1), at(1, 9)])
    expect(grid.outOfBounds.map((c) => c.id)).toEqual(['5-1', '1-9'])
    expect(grid.occupied).toBe(1)
    expect(grid.free).toBe(3)
  })

  it('returns an empty grid for a page with no holes', () => {
    const grid = buildSlotGrid(0, 0, [])
    expect(grid.rows).toEqual([])
    expect(grid.free).toBe(0)
  })
})
