import { useQuery } from '@tanstack/react-query'
import { countByCoinType } from '@mynt/core'

import { supabase } from '@/app/lib/supabase'

/**
 * Only the coin_type_id of every coin is needed here, not the joined rows the
 * collection list fetches, so this is its own small query rather than a reuse
 * of useCollection.
 */
export function useOwnedTypeCounts() {
  return useQuery({
    queryKey: ['collection', 'type-counts'],
    queryFn: async () => {
      const PAGE = 1000
      const rows: { coin_type_id: number }[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('coin')
          .select('coin_type_id')
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        rows.push(...data)
        if (data.length < PAGE) break
      }
      return countByCoinType(rows)
    },
  })
}
