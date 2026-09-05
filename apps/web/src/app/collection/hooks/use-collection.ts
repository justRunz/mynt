import { useQuery } from '@tanstack/react-query'
import type { Grade } from '@mynt/core'

import { supabase } from '@/app/lib/supabase'

/** Where a coin physically sits, when it has been filed. */
export interface CoinLocation {
  pageId: string
  binderId: string
  binderName: string
  pageNumber: number
  row: number
  column: number
}

/**
 * A coin as the screens want it: flat, in English, with the join already
 * resolved. This mapping is the seam that keeps the French table and column
 * names out of the components.
 */
export interface CollectionEntry {
  id: string
  countryCode: string
  faceValueCents: number
  year: number
  variant: string
  grade: Grade | null
  acquiredOn: string | null
  notes: string | null
  location: CoinLocation | null
}

const SELECT = `
  id, grade, acquired_on, notes, slot_row, slot_column,
  coin_type ( country_code, face_value_cents, year, variant ),
  page ( id, number, binder ( id, name ) )
`

/**
 * The whole collection is fetched once and filtered on the client. Even a
 * serious collector holds a couple of thousand coins, which is nothing to hold
 * in memory, and it makes every filter instant. It is also the shape the
 * offline step needs anyway, since the full collection has to be cached.
 *
 * No profile_id filter here: row level security already restricts the rows to
 * the signed-in profile, and duplicating the rule in the client would be a
 * second place for it to go wrong.
 */
async function fetchCollection(): Promise<CollectionEntry[]> {
  const PAGE = 1000
  const entries: CollectionEntry[] = []

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('coin')
      .select(SELECT)
      .order('id')
      .range(from, from + PAGE - 1)

    if (error) throw error

    for (const row of data) {
      entries.push({
        id: row.id,
        countryCode: row.coin_type.country_code,
        faceValueCents: row.coin_type.face_value_cents,
        year: row.coin_type.year,
        variant: row.coin_type.variant,
        grade: row.grade,
        acquiredOn: row.acquired_on,
        notes: row.notes,
        location:
          row.page && row.slot_row !== null && row.slot_column !== null
            ? {
                pageId: row.page.id,
                binderId: row.page.binder.id,
                binderName: row.page.binder.name,
                pageNumber: row.page.number,
                row: row.slot_row,
                column: row.slot_column,
              }
            : null,
      })
    }

    if (data.length < PAGE) return entries
  }
}

export const collectionQueryKey = ['collection'] as const

export function useCollection() {
  return useQuery({
    queryKey: collectionQueryKey,
    queryFn: fetchCollection,
  })
}
