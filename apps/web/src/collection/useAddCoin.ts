import { useMutation, useQueryClient } from '@tanstack/react-query'
import { newId, type Grade } from '@mynt/core'

import { supabase } from '../lib/supabase'
import { collectionQueryKey, type CollectionEntry } from './useCollection'

export interface NewCoin {
  profileId: string
  coinTypeId: number
  grade: Grade | null
  /** Carried along so the optimistic row can render before the server answers. */
  countryCode: string
  faceValueCents: number
  year: number
}

/**
 * The id is generated here, on the client, not by the database. That is what
 * makes the optimistic row the real row: there is nothing to reconcile when the
 * insert comes back, and a retry carries the same id rather than creating a
 * duplicate. Step 6 leans on exactly this to replay a queue of offline entries.
 */
export function useAddCoin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: NewCoin): Promise<CollectionEntry> => {
      const entry: CollectionEntry = {
        id: newId(),
        countryCode: input.countryCode,
        faceValueCents: input.faceValueCents,
        year: input.year,
        variant: '',
        grade: input.grade,
        acquiredOn: null,
        notes: null,
        location: null,
      }

      const { error } = await supabase.from('coin').insert({
        id: entry.id,
        profile_id: input.profileId,
        coin_type_id: input.coinTypeId,
        grade: input.grade,
      })
      if (error) throw error
      return entry
    },

    onSuccess: (entry) => {
      queryClient.setQueryData<CollectionEntry[]>(collectionQueryKey, (current) =>
        current ? [...current, entry] : [entry],
      )
    },
  })
}
