import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router-dom'

import { SignIn } from '@/app/auth/sign-in'
import { SignUp } from '@/app/auth/sign-up'
import { ForgotPassword } from '@/app/auth/forgot-password'
import { ResetPassword } from '@/app/auth/reset-password'
import { VerifyEmail } from '@/app/auth/verify-email'
import { BindersPage } from '@/app/binders'
import { CollectionPage } from '@/app/collection'
import { CompletenessPage } from '@/app/completeness'
import { useAuthStatus } from '@/app/stores/auth'

function Splash() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
      {t('common.loading')}
    </div>
  )
}

export function AppRoutes() {
  const status = useAuthStatus()

  // The splash is what the trade of the refresh cookie for an access token
  // looks like: one request, on load, before anyone can be shown anything.
  if (status === 'loading') return <Splash />

  // Offline counts as in: the persisted collection is shown, read-only, and the
  // session is renewed or found gone the moment the network answers again.
  if (status === 'signed-out') {
    return (
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
