import { Router } from 'express'
import { asc, eq } from 'drizzle-orm'

import { dbQueryAs } from '../db/index.js'
import { binders, pages } from '../db/schema.js'

export const binderRoutes = Router()

/**
 * Binders with their pages.
 *
 * One query and a regroup, rather than one query per binder. The join returns a
 * row per page, with the binder repeated; nesting them here keeps the response
 * in the shape the binder view actually draws.
 */
binderRoutes.get('/', async (req, res) => {
  const rows = await dbQueryAs(req.userId!, (tx) =>
    tx
      .select({
        binderId: binders.binderId,
        name: binders.name,
        pageId: pages.pageId,
        pageNumber: pages.pageNumber,
        rowCount: pages.rowCount,
        columnCount: pages.columnCount,
      })
      .from(binders)
      // Left, so a binder with no pages yet still comes back -- that is the
      // state the empty view exists for.
      .leftJoin(pages, eq(pages.binderId, binders.binderId))
      .orderBy(asc(binders.name), asc(pages.pageNumber)),
  )

  const byBinder = new Map<
    string,
    {
      binderId: string
      name: string
      pages: { pageId: string; pageNumber: number; rowCount: number; columnCount: number }[]
    }
  >()

  for (const row of rows) {
    let binder = byBinder.get(row.binderId)
    if (!binder) {
      binder = { binderId: row.binderId, name: row.name, pages: [] }
      byBinder.set(row.binderId, binder)
    }
    if (row.pageId !== null) {
      binder.pages.push({
        pageId: row.pageId,
        pageNumber: row.pageNumber!,
        rowCount: row.rowCount!,
        columnCount: row.columnCount!,
      })
    }
  }

  res.json([...byBinder.values()])
})
