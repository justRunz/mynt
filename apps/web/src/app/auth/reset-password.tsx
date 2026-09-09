import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/app/ui/button'
import { Field } from '@/app/ui/field'
import type { TranslationKey } from '@/app/i18n/types'
import { resetPassword } from '@/app/stores/auth'
import { AuthLayout, FormError, FormNotice } from './components/auth-layout'
import { authErrorKey } from './lib/auth-errors'

/**
 * Where the link in the reset email lands.
 *
 * It does not sign anybody in, and that is not an omission: setting the password
 * revoked every session there was, this browser's included. Signing in with the
 * new one is the next step, and it is also the only confirmation that it was
 * typed as intended.
 */
export function ResetPassword() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token')

  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(
    token ? null : 'auth.errors.invalid_link',
  )
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setBusy(true)
    setErrorKey(null)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (error) {
      setErrorKey(authErrorKey(error))
    }
    setBusy(false)
  }

  return (
    <AuthLayout title={t('auth.updatePassword.title')}>
      {done ? (
        <FormNotice>{t('auth.updatePassword.done')}</FormNotice>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            label={t('auth.fields.newPassword')}
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            disabled={!token}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormError messageKey={errorKey} />
          <Button type="submit" disabled={busy || !token}>
            {busy ? t('common.loading') : t('auth.updatePassword.submit')}
          </Button>
        </form>
      )}

      <p className="mt-5 border-t border-rule pt-4 text-sm">
        <Link to="/sign-in" className="text-muted hover:text-ink">
          {t('auth.reset.backToSignIn')}
        </Link>
      </p>
    </AuthLayout>
  )
}
