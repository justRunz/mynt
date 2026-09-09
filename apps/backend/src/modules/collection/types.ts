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

/** Where a coin physically sits, once it has been filed. */
export interface CoinLocation {
  pageId: string
  pageNumber: number
  binderId: string
  binderName: string
  row: number
  column: number
}

/**
 * A held coin, with its join resolved and its location said properly.
 *
 * The four filing fields used to sit flat and nullable beside each other, which
 * let the type describe fifteen states that cannot happen -- a coin with a page
 * number and no page, a binder name and no binder. A coin is in a hole or it is
 * in the jar, and one nullable object says exactly that.
 */
export interface CollectionCoin {
  coinId: string
  gradeCode: string | null
  acquiredOn: string | null
  notes: string | null
  countryCode: string
  faceValueCents: number
  year: number
  variant: string
  location: CoinLocation | null
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
