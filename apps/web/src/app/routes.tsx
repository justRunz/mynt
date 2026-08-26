import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ResetPassword } from '../auth/ResetPassword'
import { SignIn } from '../auth/SignIn'
import { SignUp } from '../auth/SignUp'
import { UpdatePassword } from '../auth/UpdatePassword'
import { useAuth } from '../auth/authContext'
import { Home } from './Home'

function Splash() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
      {t('common.loading')}
    </div>
  )
}

export function AppRoutes() {
  const { session, loading, recovering } = useAuth()

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
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
