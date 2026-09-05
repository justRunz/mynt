import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { Button } from '@/app/ui/button'

/**
 * The service worker waits rather than swapping itself in: an automatic reload
 * would discard whatever is half-typed in the quick-add form, which is the one
 * screen where that would actually cost the user something.
 */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-3 bg-card px-6 py-3 text-sm"
    >
      <span>{t('update.available')}</span>
      <Button className="h-9" onClick={() => void updateServiceWorker(true)}>
        {t('update.reload')}
      </Button>
      <Button variant="ghost" className="h-9" onClick={() => setNeedRefresh(false)}>
        {t('update.dismiss')}
      </Button>
    </div>
  )
}
