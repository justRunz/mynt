import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/app/lib/api'

/**
 * How many copies are held of each catalog entry.
 *
 * Counted by the database, in one grouped query, rather than by fetching every
 * coin's type id and tallying them here -- the grid needs one number per type,
 * not a list. It used to page through a thousand rows at a time to build the
 * same object in the browser.
 *
 * An object rather than a Map, because this is persisted to IndexedDB as JSON: a
 * Map rehydrates as {} and every read of it would throw.
 */
export function useOwnedTypeCounts() {
  return useQuery({
    queryKey: ['collection', 'type-counts'],
    queryFn: () => apiFetch<Record<number, number>>('/collection/type-counts'),
  })
}
