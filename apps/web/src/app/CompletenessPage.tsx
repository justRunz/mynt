import { useTranslation } from 'react-i18next'

import { Completeness } from '../completeness/Completeness'
import { AppShell } from './AppShell'

export function CompletenessPage() {
  const { t } = useTranslation()
  return (
    <AppShell title={t('completeness.title')}>
      <Completeness />
    </AppShell>
  )
}
