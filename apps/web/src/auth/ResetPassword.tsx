import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import type { TranslationKey } from '../i18n/types'
import { supabase } from '../lib/supabase'
import { AuthLayout, FormError, FormNotice } from './AuthLayout'
import { authErrorKey } from './authErrors'

export function ResetPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setErrorKey(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    if (error) setErrorKey(authErrorKey(error))
    // Reported as sent either way: whether an account exists for an address is
    // not something an unauthenticated visitor should be able to probe.
    else setSent(true)
    setBusy(false)
  }

  return (
    <AuthLayout title={t('auth.reset.title')}>
      {sent ? (
        <FormNotice>{t('auth.reset.sent', { email })}</FormNotice>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t('auth.reset.intro')}</p>
          <Field
            label={t('auth.fields.email')}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormError messageKey={errorKey} />
          <Button type="submit" disabled={busy}>
            {busy ? t('common.loading') : t('auth.reset.submit')}
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
