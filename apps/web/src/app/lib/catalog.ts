import { queryOptions } from '@tanstack/react-query'
import type { CoinType, Country } from '@mynt/core'

import { apiFetch } from './api'

/**
 * The catalog is shared, immutable and small (~4 000 rows). It is fetched once
 * and never goes stale, so the completeness grid can join it against the user's
 * coins on the client instead of asking the server per country.
 */
const IMMUTABLE = { staleTime: Infinity, gcTime: Infinity } as const

export const catalogQueries = {
  countries: () =>
    queryOptions({
      queryKey: ['catalog', 'countries'],
      queryFn: () => apiFetch<Country[]>('/catalog/countries'),
      ...IMMUTABLE,
    }),

  coinTypes: () =>
    queryOptions({
      queryKey: ['catalog', 'coin-types'],
      // One request for all four thousand. PostgREST capped a plain select at a
      // thousand rows, which is why this used to walk explicit ranges; our own
      // route has no such ceiling and the loop is gone.
      queryFn: () => apiFetch<CoinType[]>('/catalog/coin-types'),
      ...IMMUTABLE,
    }),
}
