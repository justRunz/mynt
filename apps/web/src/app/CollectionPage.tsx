import { useTranslation } from 'react-i18next'

import { Collection } from '../collection/Collection'
import { AppShell } from './AppShell'

export function CollectionPage() {
  const { t } = useTranslation()
  return (
    <AppShell title={t('collection.title')}>
      <Collection />
    </AppShell>
  )
}
