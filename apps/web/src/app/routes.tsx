import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router-dom'

import { SignIn } from '@/app/auth/sign-in'
import { SignUp } from '@/app/auth/sign-up'
import { BindersPage } from '@/app/binders'
import { CollectionPage } from '@/app/collection'
import { CompletenessPage } from '@/app/completeness'
import { useAuthStore, useIsSignedIn } from '@/app/stores/auth'

function Splash() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
      {t('common.loading')}
    </div>
  )
}

export function AppRoutes() {
  const signedIn = useIsSignedIn()
  const loading = useAuthStore((state) => state.loading)

  // The splash is what the trade of the refresh cookie for an access token
  // looks like: one request, on load, before anyone can be shown anything.
  if (loading) return <Splash />

  if (!signedIn) {
    return (
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<CollectionPage />} />
      <Route path="/completeness" element={<CompletenessPage />} />
      <Route path="/binders" element={<BindersPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
