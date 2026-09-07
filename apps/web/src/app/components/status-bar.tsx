import { useTranslation } from 'react-i18next'

import { useIsOnline } from '@/app/hooks/use-is-online'

/**
 * Offline is a normal state for this app, not an error: cellars and flea
 * markets have no signal, and the collection stays readable there because the
 * query cache is persisted.
 *
 * What it says is the part the user actually needs: everything can still be
 * consulted, nothing can be changed. Coins are entered at a desk, so writes
 * are not queued for a reconnection -- attempting one without a signal fails
 * rather than waiting in silence.
 */
export function StatusBar() {
  const { t } = useTranslation()
  const online = useIsOnline()

  if (online) return null

  return (
    <div role="status" className="bg-card px-6 py-3 text-center text-sm text-muted">
      <span className="font-[480] text-ink">{t('status.offline')}</span>
      <span className="block text-xs">{t('status.offlineHint')}</span>
    </div>
  )
}
