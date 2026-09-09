import { Router } from 'express'
import { asc } from 'drizzle-orm'

import { dbQueryAs } from '../db/index.js'
import { coinTypes, countries } from '../db/schema.js'

/**
 * The shared catalog: what exists, as opposed to what anyone holds.
 *
 * Read through dbQueryAs like everything else, even though every signed-in
 * account sees the same rows. Going around the wrapper "because it is public"
 * is how a second way in gets built, and the policy on these tables is scoped
 * to authenticated for a reason -- an unscoped connection cannot read them.
 */
export const catalogRoutes = Router()

catalogRoutes.get('/countries', async (req, res) => {
  const rows = await dbQueryAs(req.userId!, (tx) =>
    tx.select().from(countries).orderBy(asc(countries.countryCode)),
  )
  res.json(rows)
})

catalogRoutes.get('/coin-types', async (req, res) => {
  // All 4 192 of them, in one response. PostgREST capped a plain select at a
  // thousand rows, which is why the client used to page through explicit
  // ranges; that loop can go. Some 200 kB, fetched once and cached forever.
  const rows = await dbQueryAs(req.userId!, (tx) =>
    tx.select().from(coinTypes).orderBy(asc(coinTypes.coinTypeId)),
  )
  res.json(rows)
})
