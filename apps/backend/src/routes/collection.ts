import { Router } from 'express'
import { asc, count, eq } from 'drizzle-orm'

import { dbQueryAs } from '../db/index.js'
import { binders, coins, coinTypes, pages } from '../db/schema.js'

export const collectionRoutes = Router()

/**
 * The whole collection, joined and flat.
 *
 * No filter on the owner anywhere below, and that is not an oversight: the
 * policy adds one. Writing it here as well would be a second copy of the rule,
 * free to drift from the first.
 *
 * PostgREST returned nested objects that the client had to flatten. A join
 * returns rows already flat, so half of that mapping disappears.
 */
collectionRoutes.get('/', async (req, res) => {
  const rows = await dbQueryAs(req.userId!, (tx) =>
    tx
      .select({
        coinId: coins.coinId,
        gradeCode: coins.gradeCode,
        acquiredOn: coins.acquiredOn,
        notes: coins.notes,
        slotRow: coins.slotRow,
        slotColumn: coins.slotColumn,
        countryCode: coinTypes.countryCode,
        faceValueCents: coinTypes.faceValueCents,
        year: coinTypes.year,
        variant: coinTypes.variant,
        // Left joins: a coin in the jar has no page, and a page always has a
        // binder, but the join has to survive the first being null.
        pageId: pages.pageId,
        pageNumber: pages.pageNumber,
        binderId: binders.binderId,
        binderName: binders.name,
      })
      .from(coins)
      .innerJoin(coinTypes, eq(coinTypes.coinTypeId, coins.coinTypeId))
      .leftJoin(pages, eq(pages.pageId, coins.pageId))
      .leftJoin(binders, eq(binders.binderId, pages.binderId))
      .orderBy(asc(coins.coinId)),
  )
  res.json(rows)
})

/**
 * How many copies are held of each catalog entry, for the completeness grid.
 *
 * Counted in SQL rather than by shipping every coin's type id and tallying them
 * in the browser. The grid needs one number per type, not a list.
 */
collectionRoutes.get('/type-counts', async (req, res) => {
  const rows = await dbQueryAs(req.userId!, (tx) =>
    tx
      .select({ coinTypeId: coins.coinTypeId, owned: count() })
      .from(coins)
      .groupBy(coins.coinTypeId),
  )

  // An object keyed by type id, which is what the grid looks up by -- and what
  // survives being persisted to IndexedDB as JSON. A Map would rehydrate as {}
  // and every read of it would throw, which is a bug this project has already
  // had once.
  res.json(Object.fromEntries(rows.map((row) => [row.coinTypeId, row.owned])))
})
