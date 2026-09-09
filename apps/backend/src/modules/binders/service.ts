import { asc, eq } from 'drizzle-orm'

import type { Tx } from '../../db/index.js'
import { binders, pages } from '../../db/schema.js'
import type { Binder } from './types.js'

/**
 * Every binder the collector owns, with its sheets.
 *
 * One query and a regroup, rather than one query per binder. The join returns a
 * row per sheet with the binder repeated; nesting them here is what makes this a
 * service rather than a thin wrapper over a select -- the caller receives the
 * shape it draws, not the shape the database stores.
 */
export async function listBinders(tx: Tx): Promise<Binder[]> {
  const rows = await tx
    .select({
      binderId: binders.binderId,
      name: binders.name,
      pageId: pages.pageId,
      pageNumber: pages.pageNumber,
      rowCount: pages.rowCount,
      columnCount: pages.columnCount,
    })
    .from(binders)
    // Left, so a binder with no sheets still comes back -- that is the state the
    // empty view exists for, and an inner join would hide it.
    .leftJoin(pages, eq(pages.binderId, binders.binderId))
    .orderBy(asc(binders.name), asc(pages.pageNumber))

  const byBinder = new Map<string, Binder>()

  for (const row of rows) {
    let binder = byBinder.get(row.binderId)
    if (!binder) {
      binder = { binderId: row.binderId, name: row.name, pages: [] }
      byBinder.set(row.binderId, binder)
    }
    // Null across the four page columns is the left join finding nothing, not a
    // sheet with missing values. One check answers for all four.
    if (row.pageId !== null) {
      binder.pages.push({
        pageId: row.pageId,
        pageNumber: row.pageNumber!,
        rowCount: row.rowCount!,
        columnCount: row.columnCount!,
      })
    }
  }

  return [...byBinder.values()]
}
