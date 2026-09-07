import { useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'

/**
 * Whether the browser currently has a connection, as TanStack Query sees it.
 *
 * Read from the query client's own manager rather than from navigator.onLine
 * directly, so the screens and the fetching layer never disagree about being
 * offline: a form is disabled by the same signal that would have failed its
 * request.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (callback) => onlineManager.subscribe(callback),
    () => onlineManager.isOnline(),
    // Assume a connection before the first subscription resolves: showing a
    // read-only banner to someone who has one is worse than the reverse.
    () => true,
  )
}
