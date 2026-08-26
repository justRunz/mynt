import { queryOptions } from '@tanstack/react-query'
import type { CoinType, Country } from '@mynt/core'

import { supabase } from '../lib/supabase'

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
      queryFn: async (): Promise<Country[]> => {
        const { data, error } = await supabase.from('country').select('*')
        if (error) throw error
        return data
      },
      ...IMMUTABLE,
    }),

  coinTypes: () =>
    queryOptions({
      queryKey: ['catalog', 'coin-types'],
      queryFn: async (): Promise<CoinType[]> => {
        // PostgREST caps a plain select, so page through explicit ranges.
        const PAGE = 1000
        const rows: CoinType[] = []
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from('coin_type')
            .select('*')
            .order('id')
            .range(from, from + PAGE - 1)
          if (error) throw error
          rows.push(...data)
          if (data.length < PAGE) return rows
        }
      },
      ...IMMUTABLE,
    }),
}
