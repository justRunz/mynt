import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import type { TranslationKey } from '../i18n/types'
import { supabase } from '../lib/supabase'
import { AuthLayout, FormError } from './AuthLayout'
import { authErrorKey } from './authErrors'
import { endRecovery } from './authStore'

/** Reached through the link in the reset email, once Supabase has opened a
 *  recovery session for the user. */
export function UpdatePassword() {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setErrorKey(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) setErrorKey(authErrorKey(error))
    else endRecovery()
    setBusy(false)
  }

  return (
    <AuthLayout title={t('auth.updatePassword.title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label={t('auth.fields.newPassword')}
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError messageKey={errorKey} />
        <Button type="submit" disabled={busy}>
          {busy ? t('common.loading') : t('auth.updatePassword.submit')}
        </Button>
      </form>
    </AuthLayout>
  )
}
