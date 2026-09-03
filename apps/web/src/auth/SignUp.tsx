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

export function SignUp() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setErrorKey(null)
    // The nickname rides in user metadata; the create_profile trigger reads it
    // when it inserts the profile row.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname } },
    })
    if (error) setErrorKey(authErrorKey(error))
    else setSent(true)
    setBusy(false)
  }

  return (
    <AuthLayout title={t('auth.signUp.title')}>
      {sent ? (
        <FormNotice>{t('auth.signUp.checkEmail', { email })}</FormNotice>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field
            label={t('auth.fields.nickname')}
            autoComplete="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <Field
            label={t('auth.fields.email')}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label={t('auth.fields.password')}
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormError messageKey={errorKey} />
          <Button type="submit" disabled={busy}>
            {busy ? t('common.loading') : t('auth.signUp.submit')}
          </Button>
        </form>
      )}

      <p className="mt-5 border-t border-rule pt-4 text-sm text-muted">
        {t('auth.signUp.haveAccount')}{' '}
        <Link
          to="/sign-in"
          className="text-ink underline decoration-field underline-offset-4
                     hover:decoration-ink"
        >
          {t('auth.signUp.signIn')}
        </Link>
      </p>
    </AuthLayout>
  )
}
