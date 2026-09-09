import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  useRefetchCollection,
  type SlotDestination,
} from '@/app/collection/hooks/use-collection'
import { ApiError, apiFetch } from '@/app/lib/api'

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

/** A binder as the API sends it: pages already nested, already in order. */
interface ApiBinder {
  binderId: string
  name: string
  pages: { pageId: string; pageNumber: number; rowCount: number; columnCount: number }[]
}

export function useBinders() {
  return useQuery({
    queryKey: bindersQueryKey,
    queryFn: async (): Promise<Binder[]> => {
      const binders = await apiFetch<ApiBinder[]>('/binders')
      // Renames only. The nesting and the ordering are the server's doing now --
      // it joins once and groups, where this used to sort every binder's pages
      // in the browser.
      return binders.map((binder) => ({
        id: binder.binderId,
        name: binder.name,
        pages: binder.pages.map((page) => ({
          id: page.pageId,
          number: page.pageNumber,
          rowCount: page.rowCount,
          columnCount: page.columnCount,
        })),
      }))
    },
  })
}

/**
 * Told apart from any other failure because it is the one the user can act on:
 * the hole is gone, pick another. Both the binder view and the add form ask.
 *
 * The server names it rather than leaking a SQLSTATE. This used to read '23505'
 * straight off a PostgREST error, which meant the interface depended on Postgres
 * error numbering; now it depends on a word the API promises.
 */
export function isSlotTaken(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'slot_taken'
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function useRefetchBinders() {
  const client = useQueryClient()
  return () => void client.invalidateQueries({ queryKey: bindersQueryKey })
}

export interface CreateBinderVariables {
  name: string
}

export function useCreateBinder() {
  const refetch = useRefetchBinders()
  return useMutation<void, Error, CreateBinderVariables>({
    // No owner in the body: it comes from the token.
    mutationFn: (input) =>
      apiFetch<{ binderId: string }>('/binders', {
        method: 'POST',
        body: { name: input.name },
      }).then(() => undefined),
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
    // The binder is in the path, because a sheet has no existence apart from
    // one.
    mutationFn: (input) =>
      apiFetch<{ pageId: string }>(`/binders/${input.binderId}/pages`, {
        method: 'POST',
        body: {
          pageNumber: input.number,
          rowCount: input.rowCount,
          columnCount: input.columnCount,
        },
      }).then(() => undefined),
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
    // PUT, not PATCH: a coin is in exactly one hole or in none, so this replaces
    // the location outright and repeating it changes nothing.
    mutationFn: (input) =>
      apiFetch<void>(`/collection/${input.coinId}/location`, {
        method: 'PUT',
        body: { pageId: input.pageId, row: input.row, column: input.column },
      }),
    onSuccess: refetch,
  })
}

export function useUnfileCoin() {
  const refetch = useRefetchCollection()
  return useMutation<void, Error, string>({
    mutationFn: (coinId) =>
      apiFetch<void>(`/collection/${coinId}/location`, { method: 'DELETE' }),
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
    mutationFn: (input) =>
      apiFetch<void>('/collection/move-pair', {
        method: 'POST',
        body: {
          first: { coinId: input.first.coinId, ...input.first.destination },
          second: { coinId: input.second.coinId, ...input.second.destination },
        },
      }),
    onSuccess: refetch,
  })
}
