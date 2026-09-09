import { asc, count, eq, sql } from 'drizzle-orm'

import type { Tx } from '../../db/index.js'
import { binders, coins, coinTypes, pages } from '../../db/schema.js'
import { DomainError, postgresErrorConstraint, postgresErrorCode } from '../../errors.js'
import type {
  AddCoin,
  CollectionCoin,
  MovePair,
  OwnedTypeCounts,
  Slot,
  UpdateCoin,
} from './types.js'

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

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Two coins aimed at one hole. The only conflict the collector can act on, so
 *  it has to arrive as itself rather than as a generic failure. */
const UNIQUE_VIOLATION = '23505'
/** A row that is not there -- or is somebody else's, which the policy makes the
 *  same thing. Also what the triggers raise for a page nobody can see. */
const NOT_FOUND = '23503'
/** A slot outside the sheet's dimensions, from the coin_fits_page trigger. */
const CHECK_VIOLATION = '23514'

/**
 * Turns a refusal by the database into one the collector can be told about.
 *
 * Every rule below lives in the schema rather than here, which is the point: a
 * check written in this file would be a second copy, racing the first and free
 * to disagree with it. What this does is translate.
 *
 * The constraint name is what separates three different 23503s -- an unknown
 * grade, an unknown catalog entry, and a page belonging to someone else. The
 * database assigned those names; nobody has to keep a message in step.
 */
function translate(error: unknown): never {
  const code = postgresErrorCode(error)

  if (code === UNIQUE_VIOLATION) {
    throw new DomainError(
      postgresErrorConstraint(error) === 'coins_slot_key' ? 'slot_taken' : 'conflict',
    )
  }

  if (code === NOT_FOUND) {
    const constraint = postgresErrorConstraint(error)
    if (constraint === 'coins_grade_code_fkey') throw new DomainError('unknown_grade')
    if (constraint === 'coins_coin_type_id_fkey') throw new DomainError('unknown_coin_type')
    // No constraint: a trigger raised it, for a page the caller cannot see.
    throw new DomainError('not_found')
  }

  if (code === CHECK_VIOLATION) throw new DomainError('slot_out_of_bounds')

  throw error
}

/**
 * Adds a coin to the collection.
 *
 * userId is passed in because this is the one write that states an owner, and it
 * comes from the token. The policy checks it again on the way in -- not because
 * this is untrusted, but because a second line that is never reached is the only
 * kind worth having.
 */
export async function addCoin(tx: Tx, userId: string, input: AddCoin): Promise<string> {
  try {
    const [created] = await tx
      .insert(coins)
      .values({
        userId,
        coinTypeId: input.coinTypeId,
        gradeCode: input.gradeCode,
        pageId: input.location?.pageId ?? null,
        slotRow: input.location?.row ?? null,
        slotColumn: input.location?.column ?? null,
      })
      .returning({ coinId: coins.coinId })
    return created!.coinId
  } catch (error) {
    translate(error)
  }
}

/**
 * Edits what a coin is, never where it sits.
 *
 * No owner in the where clause, and none is missing: the policy narrows this
 * statement to the caller's own rows. A coin belonging to somebody else is not
 * refused, it is simply not there -- so zero rows updated is the answer to both
 * "no such coin" and "not yours", which is exactly as much as anyone should
 * learn.
 */
export async function updateCoin(tx: Tx, coinId: string, input: UpdateCoin): Promise<void> {
  let touched
  try {
    touched = await tx
      .update(coins)
      .set({
        coinTypeId: input.coinTypeId,
        gradeCode: input.gradeCode,
        acquiredOn: input.acquiredOn,
        notes: input.notes,
      })
      .where(eq(coins.coinId, coinId))
      .returning({ coinId: coins.coinId })
  } catch (error) {
    translate(error)
  }

  if (touched.length === 0) throw new DomainError('not_found')
}

export async function deleteCoin(tx: Tx, coinId: string): Promise<void> {
  const removed = await tx
    .delete(coins)
    .where(eq(coins.coinId, coinId))
    .returning({ coinId: coins.coinId })

  if (removed.length === 0) throw new DomainError('not_found')
}

/**
 * Files a coin into a hole.
 *
 * Three refusals can come back, and all three are the database's: the hole is
 * taken, the sheet is not the caller's, or the hole is outside the sheet. None
 * of them is checked here first -- a check before the write is a guess about a
 * state that can change between the reading and the writing.
 */
export async function fileCoin(tx: Tx, coinId: string, slot: Slot): Promise<void> {
  let touched
  try {
    touched = await tx
      .update(coins)
      .set({ pageId: slot.pageId, slotRow: slot.row, slotColumn: slot.column })
      .where(eq(coins.coinId, coinId))
      .returning({ coinId: coins.coinId })
  } catch (error) {
    translate(error)
  }

  if (touched.length === 0) throw new DomainError('not_found')
}

/** Sends a coin back to the jar, which is a normal place for a coin to be. */
export async function unfileCoin(tx: Tx, coinId: string): Promise<void> {
  const touched = await tx
    .update(coins)
    .set({ pageId: null, slotRow: null, slotColumn: null })
    .where(eq(coins.coinId, coinId))
    .returning({ coinId: coins.coinId })

  if (touched.length === 0) throw new DomainError('not_found')
}

/**
 * Exchanges two coins in one statement.
 *
 * Not two updates: the first would land on a hole the second has not left yet,
 * and the unique constraint refuses it. place_pair suspends that constraint for
 * the length of its own transaction so the intermediate state is legal, and
 * takes the lock on both coins in a fixed order so two exchanges sharing a coin
 * cannot deadlock.
 *
 * It is SECURITY INVOKER, so it runs under the caller's policies: passing
 * somebody else's coin id makes the row invisible, the update touches nothing,
 * and the function raises rather than moving half a pair.
 */
export async function movePair(tx: Tx, input: MovePair): Promise<void> {
  try {
    // Cast at the call site because the function is declared with smallint
    // positions, and an untyped literal would not resolve to it.
    await tx.execute(sql`select place_pair(
      ${input.first.coinId}, ${input.first.pageId},
      ${input.first.row}::smallint, ${input.first.column}::smallint,
      ${input.second.coinId}, ${input.second.pageId},
      ${input.second.row}::smallint, ${input.second.column}::smallint
    )`)
  } catch (error) {
    translate(error)
  }
}
