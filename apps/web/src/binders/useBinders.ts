import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { newId } from '@mynt/core'

import { supabase } from '../lib/supabase'
import { collectionQueryKey } from '../collection/useCollection'

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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ profileId, name }: { profileId: string; name: string }) => {
      const { error } = await supabase
        .from('binder')
        .insert({ id: newId(), profile_id: profileId, name })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bindersQueryKey }),
  })
}

export function useCreatePage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (page: {
      binderId: string
      number: number
      rowCount: number
      columnCount: number
    }) => {
      const { error } = await supabase.from('page').insert({
        id: newId(),
        binder_id: page.binderId,
        number: page.number,
        row_count: page.rowCount,
        column_count: page.columnCount,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bindersQueryKey }),
  })
}

/** Postgres unique_violation: two coins aimed at the same hole. */
export const SLOT_TAKEN = '23505'

export function useFileCoin() {
  const queryClient = useQueryClient()
  return useMutation({
    // The unique constraint on (page_id, slot_row, slot_column) is the final
    // guard against two coins in one hole. The interface has to handle its
    // error rather than merely try to avoid it: another device may have taken
    // the slot since this page was loaded.
    mutationFn: async (input: {
      coinId: string
      pageId: string
      row: number
      column: number
    }) => {
      const { error } = await supabase
        .from('coin')
        .update({
          page_id: input.pageId,
          slot_row: input.row,
          slot_column: input.column,
        })
        .eq('id', input.coinId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionQueryKey }),
  })
}

export function useUnfileCoin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (coinId: string) => {
      const { error } = await supabase
        .from('coin')
        .update({ page_id: null, slot_row: null, slot_column: null })
        .eq('id', coinId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionQueryKey }),
  })
}
