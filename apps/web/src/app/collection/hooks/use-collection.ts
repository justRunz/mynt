import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Grade } from '@mynt/core'

import { supabase } from '@/app/lib/supabase'

/**
 * A hole in a binder page, as the forms name one: where a coin is being sent.
 * Its resolved counterpart, once the binder and page have names, is
 * CoinLocation just below.
 */
export interface SlotDestination {
  pageId: string
  row: number
  column: number
}

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
 * in memory, and it makes every filter instant. It is also what makes the app
 * readable without a signal: the persisted cache holds the whole thing.
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

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Every write refetches the collection rather than patching the cache from the
 * variables it was given.
 *
 * Patching optimistically means the screen shows a result the server has not
 * agreed to yet, and putting it back when the answer is no is a second thing to
 * get right. Writes only happen online now, where the round trip is a few tens
 * of milliseconds -- not worth showing a guess for.
 */
export function useRefetchCollection() {
  const client = useQueryClient()
  return () => void client.invalidateQueries({ queryKey: collectionQueryKey })
}

export interface AddCoinVariables {
  profileId: string
  coinTypeId: number
  grade: Grade | null
  /**
   * Set when the add form filed the coin on the spot. It rides along in the
   * same insert rather than becoming a second mutation: one write instead of
   * two, and no window in which the coin exists but is nowhere.
   */
  destination: SlotDestination | null
}

export function useAddCoin() {
  const refetch = useRefetchCollection()
  return useMutation<void, Error, AddCoinVariables>({
    mutationFn: async (input) => {
      // The id is left to the database. Nothing on this side needs it before
      // the row exists: the screen refetches rather than drawing the coin
      // itself, so there is nothing to key on in the meantime.
      const { error } = await supabase.from('coin').insert({
        profile_id: input.profileId,
        coin_type_id: input.coinTypeId,
        grade: input.grade,
        page_id: input.destination?.pageId ?? null,
        slot_row: input.destination?.row ?? null,
        slot_column: input.destination?.column ?? null,
      })
      if (error) throw error
    },
    onSuccess: refetch,
  })
}

export interface UpdateCoinVariables {
  coinId: string
  coinTypeId: number
  grade: Grade | null
  acquiredOn: string | null
  notes: string | null
}

export function useUpdateCoin() {
  const refetch = useRefetchCollection()
  return useMutation<void, Error, UpdateCoinVariables>({
    mutationFn: async (input) => {
      const { error } = await supabase
        .from('coin')
        .update({
          coin_type_id: input.coinTypeId,
          grade: input.grade,
          acquired_on: input.acquiredOn,
          notes: input.notes,
        })
        .eq('id', input.coinId)
      if (error) throw error
    },
    onSuccess: refetch,
  })
}

export function useDeleteCoin() {
  const refetch = useRefetchCollection()
  return useMutation<void, Error, string>({
    mutationFn: async (coinId) => {
      const { error } = await supabase.from('coin').delete().eq('id', coinId)
      if (error) throw error
    },
    onSuccess: refetch,
  })
}
