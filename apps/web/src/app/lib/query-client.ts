import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'

import { registerMutations } from './mutations'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // Kept in the cache for a week so a flea market on Sunday still has last
      // Monday's collection.
      gcTime: 7 * 24 * 60 * 60 * 1000,
    },
    mutations: {
      // networkMode 'online' is the default and is what pauses mutations while
      // offline instead of failing them. Spelled out because the whole offline
      // queue depends on it.
      networkMode: 'online',
    },
  },
})

registerMutations(queryClient)

const PERSIST_KEY = 'mynt-query-cache'

/**
 * IndexedDB rather than localStorage: the catalog alone is some 4 000 rows,
 * well past what a 5 MB synchronous store should hold, and writing it must not
 * block the main thread.
 */
export const persister = createAsyncStoragePersister({
  key: PERSIST_KEY,
  storage: {
    getItem: (key) => get<string>(key).then((value) => value ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
  throttleTime: 1_000,
})

/**
 * A persisted cache outlives the session, so signing out has to erase it.
 * Otherwise the next account on this browser would briefly see the previous
 * one's collection before the first fetch replaced it.
 */
export async function clearPersistedCache() {
  queryClient.clear()
  await del(PERSIST_KEY)
}
