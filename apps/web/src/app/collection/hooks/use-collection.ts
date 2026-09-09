import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Grade } from '@mynt/core'

import { apiFetch } from '@/app/lib/api'

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

/**
 * A coin as the API sends it. The join is already resolved and the location is
 * already nested, so nothing here has to decide what four loose nullable fields
 * meant together.
 */
interface ApiCoin {
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
 * The whole collection is fetched once and filtered on the client. Even a
 * serious collector holds a couple of thousand coins, which is nothing to hold
 * in memory, and it makes every filter instant. It is also what makes the app
 * readable without a signal: the persisted cache holds the whole thing.
 *
 * No owner is sent or asked for. The policy in the database narrows the rows to
 * whoever the token names, and repeating that here would be a second place for
 * the rule to go wrong.
 */
async function fetchCollection(): Promise<CollectionEntry[]> {
  const rows = await apiFetch<ApiCoin[]>('/collection')

  // Two renames and a cast, nothing more: `location` already arrives in the
  // shape the screens draw. The names could be made to match and this could go,
  // which is a tidy-up and not part of moving the app off Supabase.
  return rows.map(({ coinId, gradeCode, ...coin }) => ({
    ...coin,
    id: coinId,
    grade: gradeCode as Grade | null,
  }))
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
    // No owner in the body. The server takes it from the verified token, which
    // is the only place it can come from that nobody can forge.
    mutationFn: (input) =>
      apiFetch<{ coinId: string }>('/collection', {
        method: 'POST',
        body: {
          coinTypeId: input.coinTypeId,
          gradeCode: input.grade,
          location: input.destination,
        },
      }).then(() => undefined),
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
    mutationFn: (input) =>
      apiFetch<void>(`/collection/${input.coinId}`, {
        method: 'PATCH',
        body: {
          coinTypeId: input.coinTypeId,
          gradeCode: input.grade,
          acquiredOn: input.acquiredOn,
          notes: input.notes,
        },
      }),
    onSuccess: refetch,
  })
}

export function useDeleteCoin() {
  const refetch = useRefetchCollection()
  return useMutation<void, Error, string>({
    mutationFn: (coinId) => apiFetch<void>(`/collection/${coinId}`, { method: 'DELETE' }),
    onSuccess: refetch,
  })
}
