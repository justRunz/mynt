import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  useRefetchCollection,
  type SlotDestination,
} from '@/app/collection/hooks/use-collection'
import { supabase } from '@/app/lib/supabase'

export interface BinderPage {
  id: string
  number: number
  rowCount: number
  columnCount: number
}

export interface Binder {
  id: string
  name: string
  pages: BinderPage[]
}

export const bindersQueryKey = ['binders'] as const

export function useBinders() {
  return useQuery({
    queryKey: bindersQueryKey,
    queryFn: async (): Promise<Binder[]> => {
      const { data, error } = await supabase
        .from('binder')
        .select('id, name, sort_order, page ( id, number, row_count, column_count )')
        .order('sort_order')
      if (error) throw error
      return data.map((binder) => ({
        id: binder.id,
        name: binder.name,
        pages: binder.page
          .map((page) => ({
            id: page.id,
            number: page.number,
            rowCount: page.row_count,
            columnCount: page.column_count,
          }))
          .sort((a, b) => a.number - b.number),
      }))
    },
  })
}

/** Postgres unique_violation: two coins aimed at the same hole. */
const SLOT_TAKEN = '23505'

/**
 * Told apart from any other failure because it is the one the user can act on:
 * the hole is gone, pick another. Both the binder view and the add form ask.
 */
export function isSlotTaken(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === SLOT_TAKEN
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function useRefetchBinders() {
  const client = useQueryClient()
  return () => void client.invalidateQueries({ queryKey: bindersQueryKey })
}

export interface CreateBinderVariables {
  profileId: string
  name: string
}

export function useCreateBinder() {
  const refetch = useRefetchBinders()
  return useMutation<void, Error, CreateBinderVariables>({
    mutationFn: async (input) => {
      const { error } = await supabase
        .from('binder')
        .insert({ profile_id: input.profileId, name: input.name })
      if (error) throw error
    },
    onSuccess: refetch,
  })
}

export interface CreatePageVariables {
  binderId: string
  number: number
  rowCount: number
  columnCount: number
}

export function useCreatePage() {
  const refetch = useRefetchBinders()
  return useMutation<void, Error, CreatePageVariables>({
    mutationFn: async (input) => {
      const { error } = await supabase.from('page').insert({
        binder_id: input.binderId,
        number: input.number,
        row_count: input.rowCount,
        column_count: input.columnCount,
      })
      if (error) throw error
    },
    onSuccess: refetch,
  })
}

// Filing, unfiling and exchanging all write to coin rows, never to binder or
// page ones. It is the collection that goes stale, not the list of binders --
// which is why these three refetch the other list.

export interface FileCoinVariables extends SlotDestination {
  coinId: string
}

export function useFileCoin() {
  const refetch = useRefetchCollection()
  return useMutation<void, Error, FileCoinVariables>({
    mutationFn: async (input) => {
      const { error } = await supabase
        .from('coin')
        .update({ page_id: input.pageId, slot_row: input.row, slot_column: input.column })
        .eq('id', input.coinId)
      if (error) throw error
    },
    onSuccess: refetch,
  })
}

export function useUnfileCoin() {
  const refetch = useRefetchCollection()
  return useMutation<void, Error, string>({
    mutationFn: async (coinId) => {
      const { error } = await supabase
        .from('coin')
        .update({ page_id: null, slot_row: null, slot_column: null })
        .eq('id', coinId)
      if (error) throw error
    },
    onSuccess: refetch,
  })
}

/**
 * One coin and the hole it ends up in. Narrower than the SQL function, which
 * would accept a null position: this mutation only ever exchanges two coins
 * that are both on a page. Sending one to the jar is unfileCoin, on its own.
 */
export interface PlacedCoin {
  coinId: string
  destination: SlotDestination
}

/**
 * Two coins moved in one statement, which is what dropping a coin onto an
 * occupied hole needs: neither can move first without landing on a hole the
 * other has not left. place_pair defers the one-coin-per-hole constraint for
 * the length of its own transaction so that the intermediate state is legal.
 *
 * It takes absolute destinations rather than "swap these two" -- see the
 * migration for the reasoning.
 */
export interface MovePairVariables {
  first: PlacedCoin
  second: PlacedCoin
}

export function useMovePair() {
  const refetch = useRefetchCollection()
  return useMutation<void, Error, MovePairVariables>({
    mutationFn: async (input) => {
      const { error } = await supabase.rpc('place_pair', {
        first_coin: input.first.coinId,
        first_page: input.first.destination.pageId,
        first_row: input.first.destination.row,
        first_column: input.first.destination.column,
        second_coin: input.second.coinId,
        second_page: input.second.destination.pageId,
        second_row: input.second.destination.row,
        second_column: input.second.destination.column,
      })
      if (error) throw error
    },
    onSuccess: refetch,
  })
}
