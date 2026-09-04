import { useMutation, useQuery } from '@tanstack/react-query'

import {
  mutationKeys,
  type CreateBinderVariables,
  type CreatePageVariables,
  type FileCoinVariables,
  type MovePairVariables,
} from '../app/mutations'
import { supabase } from '../lib/supabase'

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

export function useCreateBinder() {
  return useMutation<void, Error, CreateBinderVariables>({
    mutationKey: mutationKeys.createBinder,
  })
}

export function useCreatePage() {
  return useMutation<void, Error, CreatePageVariables>({
    mutationKey: mutationKeys.createPage,
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

export function useFileCoin() {
  return useMutation<void, Error, FileCoinVariables>({ mutationKey: mutationKeys.fileCoin })
}

/** Two coins exchanged in one transaction; see place_pair in the migrations. */
export function useMovePair() {
  return useMutation<void, Error, MovePairVariables>({ mutationKey: mutationKeys.movePair })
}

export function useUnfileCoin() {
  return useMutation<void, Error, string>({ mutationKey: mutationKeys.unfileCoin })
}
