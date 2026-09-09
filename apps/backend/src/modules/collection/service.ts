import { asc, count, eq } from 'drizzle-orm'

import type { Tx } from '../../db/index.js'
import { binders, coins, coinTypes, pages } from '../../db/schema.js'
import type { CollectionCoin, OwnedTypeCounts } from './types.js'

/**
 * Everything the signed-in collector holds.
 *
 * There is no filter on the owner anywhere below, and it is not an oversight:
 * the policy adds one, inside the transaction this is handed. Writing it here as
 * well would be a second copy of the rule, free to drift from the first and
 * impossible to test independently.
 *
 * PostgREST returned nested objects the client had to flatten; a join returns
 * rows already flat, so half of that mapping disappears.
 */
export function listCoins(tx: Tx): Promise<CollectionCoin[]> {
  return tx
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
      pageId: pages.pageId,
      pageNumber: pages.pageNumber,
      binderId: binders.binderId,
      binderName: binders.name,
    })
    .from(coins)
    // Inner: a coin without a catalog entry cannot exist, the foreign key says
    // so. Left for the rest: a coin in the jar has no page, and the join has to
    // survive that.
    .innerJoin(coinTypes, eq(coinTypes.coinTypeId, coins.coinTypeId))
    .leftJoin(pages, eq(pages.pageId, coins.pageId))
    .leftJoin(binders, eq(binders.binderId, pages.binderId))
    .orderBy(asc(coins.coinId))
}

/**
 * How many copies of each catalog entry, for the completeness grid.
 *
 * Counted in SQL rather than by shipping every coin's type id and tallying them
 * in the browser: the grid needs one number per type, not a list.
 *
 * The reshaping into an object lives here rather than in the controller. It is
 * part of what this function promises to return, not part of answering HTTP.
 */
export async function countOwnedByType(tx: Tx): Promise<OwnedTypeCounts> {
  const rows = await tx
    .select({ coinTypeId: coins.coinTypeId, owned: count() })
    .from(coins)
    .groupBy(coins.coinTypeId)

  return Object.fromEntries(rows.map((row) => [row.coinTypeId, row.owned]))
}
