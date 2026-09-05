import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ResetPassword } from '@/app/auth/reset-password'
import { SignIn } from '@/app/auth/sign-in'
import { SignUp } from '@/app/auth/sign-up'
import { UpdatePassword } from '@/app/auth/update-password'
import { BindersPage } from '@/app/binders'
import { CollectionPage } from '@/app/collection'
import { CompletenessPage } from '@/app/completeness'
import { useAuthStore } from '@/app/stores/auth'

function Splash() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
      {t('common.loading')}
    </div>
  )
}

export function AppRoutes() {
  const session = useAuthStore((state) => state.session)
  const loading = useAuthStore((state) => state.loading)
  const recovering = useAuthStore((state) => state.recovering)

  if (loading) return <Splash />

  // A recovery session is a signed-in session, so this has to come first:
  // otherwise the user lands on the app and never gets to set a new password.
  if (recovering) return <UpdatePassword />

  if (!session) {
    return (
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/update-password" element={<UpdatePassword />} />
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
