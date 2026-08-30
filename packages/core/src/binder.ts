/** A coin that has been filed, reduced to what placing it on a page needs. */
export interface FiledCoin {
  slotRow: number
  slotColumn: number
}

export interface SlotGrid<T extends FiledCoin> {
  /** Row-major, one entry per hole, null where the hole is free. */
  rows: (T | null)[][]
  /**
   * Coins sitting outside the page's current dimensions. The database cannot
   * express "slot_row <= page.row_count" as a check across tables, so a page
   * shrunk after the fact can strand coins. They must be surfaced rather than
   * silently vanish from the view.
   */
  outOfBounds: T[]
  free: number
  occupied: number
}

export function buildSlotGrid<T extends FiledCoin>(
  rowCount: number,
  columnCount: number,
  coins: readonly T[],
): SlotGrid<T> {
  const rows: (T | null)[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: columnCount }, () => null),
  )
  const outOfBounds: T[] = []
  let occupied = 0

  for (const coin of coins) {
    const rowIndex = coin.slotRow - 1
    const columnIndex = coin.slotColumn - 1
    const row = rows[rowIndex]
    if (!row || columnIndex < 0 || columnIndex >= columnCount) {
      outOfBounds.push(coin)
      continue
    }
    row[columnIndex] = coin
    occupied += 1
  }

  return { rows, outOfBounds, free: rowCount * columnCount - occupied, occupied }
}
