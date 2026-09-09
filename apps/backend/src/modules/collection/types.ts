import type { z } from 'zod'

import type {
  addCoinSchema,
  fileCoinSchema,
  movePairSchema,
  updateCoinSchema,
} from './schemas.js'

/**
 * What the collection endpoints promise, independent of both the column layout
 * below and the component props above.
 *
 * Declared here rather than inferred from the query, because an inferred type is
 * a reflection: rename a column and the API contract changes without anyone
 * deciding it should. These are the shapes the server means.
 */

/**
 * A held coin with its join already resolved.
 *
 * The four filing fields are nullable together -- a coin is either in a hole or
 * in the jar -- which this shape cannot say, so it permits fifteen combinations
 * that cannot occur. A nested `location: {...} | null` would say it properly, and
 * is what the front end already models. Left as is deliberately: changing it
 * changes the response, and this step is a refactor proved by the response not
 * changing. It belongs to the step where the front end moves.
 */
export interface CollectionCoin {
  coinId: string
  gradeCode: string | null
  acquiredOn: string | null
  notes: string | null
  slotRow: number | null
  slotColumn: number | null
  countryCode: string
  faceValueCents: number
  year: number
  variant: string
  pageId: string | null
  pageNumber: number | null
  binderId: string | null
  binderName: string | null
}

/**
 * How many copies are held of each catalog entry, keyed by coin type id.
 *
 * An object rather than a Map, and that is not a style choice: this response is
 * persisted to IndexedDB as JSON, and a Map rehydrates as {} -- every read of it
 * would then throw. This project has had that bug once already.
 */
export type OwnedTypeCounts = Record<number, number>

// ---------------------------------------------------------------------------
// What a write is given
// ---------------------------------------------------------------------------

/**
 * Inferred from the schemas rather than written again, so a field added to a
 * validator cannot be forgotten in the type -- there is only one description of
 * a request body, and it is the one that actually rejects things.
 */
export type Slot = z.infer<typeof fileCoinSchema>
export type AddCoin = z.infer<typeof addCoinSchema>
export type UpdateCoin = z.infer<typeof updateCoinSchema>
export type MovePair = z.infer<typeof movePairSchema>
