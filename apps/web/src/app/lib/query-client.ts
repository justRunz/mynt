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
 * Whether the persister is allowed to write.
 *
 * The provider keeps the persister subscribed to the query cache for the life
 * of the page, so emptying that cache is itself a change worth saving: without
 * this gate, signing out deletes the key and the subscription puts it straight
 * back, holding an empty cache. Harmless in content, but the code then claims
 * to remove something it only blanks.
 */
let persisting = true

/** The most recent write, so a delete can wait for it rather than race it. */
let lastWrite: Promise<void> = Promise.resolve()

/**
 * IndexedDB rather than localStorage: the catalog alone is some 4 000 rows,
 * well past what a 5 MB synchronous store should hold, and writing it must not
 * block the main thread.
 */
export const persister = createAsyncStoragePersister({
  key: PERSIST_KEY,
  storage: {
    getItem: (key) => get<string>(key).then((value) => value ?? null),
    setItem: (key, value) => {
      if (!persisting) return Promise.resolve()
      lastWrite = set(key, value)
      return lastWrite
    },
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
  // Closed before the cache is emptied, so the change that emptying causes is
  // never written.
  persisting = false
  queryClient.clear()
  // A write dispatched a moment earlier is still in flight and would land after
  // the delete. Failures are the persister's business, not this function's; all
  // that matters here is that nothing is still writing.
  await lastWrite.catch(() => {})
  await del(PERSIST_KEY)
}

/**
 * Reopened when a session appears, or the cache would stop being saved for the
 * rest of the tab's life after one sign-out -- and being usable offline is the
 * whole point of persisting it.
 */
export function resumePersistence() {
  persisting = true
}
