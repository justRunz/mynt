import { useSyncExternalStore } from 'react'
import { onlineManager, useMutationState } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

function useIsOnline(): boolean {
  return useSyncExternalStore(
    (callback) => onlineManager.subscribe(callback),
    () => onlineManager.isOnline(),
    () => true,
  )
}

/**
 * Offline is a normal state for this app, not an error: cellars and flea
 * markets have no signal. It says so plainly, and says what happens to the work
 * in the meantime, because "your changes are kept" is the only thing the user
 * actually needs to know.
 */
export function StatusBar() {
  const { t } = useTranslation()
  const online = useIsOnline()
  const paused = useMutationState({
    filters: { predicate: (mutation) => mutation.state.isPaused },
  })

  if (online && paused.length === 0) return null

  return (
    <div
      role="status"
      className="bg-card px-6 py-3 text-center text-sm text-muted"
    >
      {!online && (
        <span className="font-[480] text-ink">{t('status.offline')}</span>
      )}
      {!online && paused.length > 0 && ' · '}
      {paused.length > 0 && (
        <span className="tnum">{t('status.pending', { count: paused.length })}</span>
      )}
      {!online && <span className="block text-xs">{t('status.offlineHint')}</span>}
    </div>
  )
}
