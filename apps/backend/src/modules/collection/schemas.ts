import { z } from 'zod'

/**
 * The shape of every write to the collection.
 *
 * Nothing here says who is writing. The owner comes from the verified token and
 * only from there -- a user id accepted in a body is a way to write as somebody
 * else, and the fact that a policy would refuse it does not make asking for it a
 * good idea.
 */

/** A hole, one-based like the grid people are looking at. The upper bound is the
 *  largest sheet anyone sells; the real limit is the page's own size, which only
 *  the database knows and its trigger enforces. */
const slot = z.object({
  pageId: z.uuid(),
  row: z.int().min(1).max(20),
  column: z.int().min(1).max(20),
})

/**
 * Grades are not listed here on purpose.
 *
 * coins.grade_code is a foreign key onto the grades table, so the database is
 * already the authority on which codes exist, and repeating the four of them
 * here would be a second list free to drift from the first. An unknown code
 * comes back as a named constraint violation, which the service turns into a
 * plain 400 -- the same answer this would have given, without the duplicate.
 */
const gradeCode = z.string().max(40).nullable()

export const addCoinSchema = z.object({
  coinTypeId: z.int().positive(),
  gradeCode,
  /** Filed on the spot by the add form, in the same insert rather than a second
   *  write -- so there is no instant where the coin exists but is nowhere. */
  location: slot.nullable().default(null),
})

/**
 * All four fields, every time, rather than a partial patch.
 *
 * The edit form holds all of them and sends all of them, so "absent" would only
 * ever mean "cleared" -- and a schema where absent and null mean different
 * things is a schema someone will eventually read wrong. Location is not among
 * them: moving a coin is its own route, because it is its own action.
 */
export const updateCoinSchema = z.object({
  coinTypeId: z.int().positive(),
  gradeCode,
  acquiredOn: z.iso.date().nullable(),
  notes: z.string().max(2000).nullable(),
})

export const fileCoinSchema = slot

/** Two coins and where each ends up, rather than "swap these two": the caller
 *  says the destination, so the server never has to infer an intent. */
export const movePairSchema = z.object({
  first: slot.extend({ coinId: z.uuid() }),
  second: slot.extend({ coinId: z.uuid() }),
})

export const coinIdSchema = z.object({ coinId: z.uuid() })
