// From the dedicated entry, not the barrel: the barrel re-exports Supabase's
// generated Database type, and this server must not depend on what it is
// replacing. A type-only import, so nothing of it survives compilation.
import type { CoinType, Country } from '@mynt/core/catalog-types'
import { asc } from 'drizzle-orm'

import type { Tx } from '../../db/index.js'
import { coinTypes, countries } from '../../db/schema.js'

/**
 * The shared catalog: what exists, as opposed to what anyone holds.
 *
 * A service knows the database and nothing else. It never sees a Request, never
 * chooses a status code, and never opens its own transaction -- the caller hands
 * it the one it must run in, because one request is one transaction and only the
 * caller knows where that begins.
 *
 * The transaction is not a detail that could be dropped for convenience: it is
 * the only thing wearing the `authenticated` costume. A query outside it runs as
 * a role that owns nothing and is refused outright, which is deliberate.
 */

/**
 * Every country that mints euros.
 *
 * Read through the same scoped transaction as private data even though every
 * account sees identical rows. Going around it "because it is public" is how a
 * second way in gets built.
 */
export function listCountries(tx: Tx): Promise<Country[]> {
  // Columns listed rather than select(): the return type is a promise this
  // module makes to the outside, and a column added to the table tomorrow must
  // not silently widen it.
  return tx
    .select({
      countryCode: countries.countryCode,
      euroSince: countries.euroSince,
      circulating: countries.circulating,
    })
    .from(countries)
    .orderBy(asc(countries.countryCode))
}

/**
 * Every catalog entry, all 4192 of them, unpaged.
 *
 * PostgREST capped a plain select at a thousand rows, which is why the client
 * used to walk explicit ranges; that loop can go. Some 350 kB, fetched once and
 * cached for the session.
 */
export function listCoinTypes(tx: Tx): Promise<CoinType[]> {
  return tx
    .select({
      coinTypeId: coinTypes.coinTypeId,
      countryCode: coinTypes.countryCode,
      faceValueCents: coinTypes.faceValueCents,
      year: coinTypes.year,
      variant: coinTypes.variant,
    })
    .from(coinTypes)
    .orderBy(asc(coinTypes.coinTypeId))
}
