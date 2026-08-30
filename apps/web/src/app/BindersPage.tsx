import { useTranslation } from 'react-i18next'

import { Binders } from '../binders/Binders'
import { AppShell } from './AppShell'

export function BindersPage() {
  const { t } = useTranslation()
  return (
    <AppShell title={t('binders.title')}>
      <Binders />
    </AppShell>
  )
}
