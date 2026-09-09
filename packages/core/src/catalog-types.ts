/**
 * The shared catalog, in the shape the app uses.
 *
 * Written here rather than derived from the generated database types, and that
 * is the point: these are the shapes the API promises, not a reflection of a
 * column layout. The two are free to differ -- coin_types.coin_type_id is a
 * good column name and a poor field name -- and the server is where they meet.
 */

/** A country that mints euros. No name: the front end derives it from the ISO
 *  code through Intl.DisplayNames, in whatever language is being read. */
export interface Country {
  countryCode: string
  /** Year of that country's first minting. */
  euroSince: number
  /** False for Monaco, San Marino and the Vatican, whose runs are for
   *  collectors and would otherwise fill the grid with unfillable cells. */
  circulating: boolean
}

/** A catalog entry -- "the French 2 € of 2003" -- not a coin anyone holds. */
export interface CoinType {
  coinTypeId: number
  countryCode: string
  faceValueCents: number
  year: number
  /** Empty until mint marks arrive. Never null: this value is concatenated into
   *  a lookup key, where a null would land as the word "null". */
  variant: string
}
