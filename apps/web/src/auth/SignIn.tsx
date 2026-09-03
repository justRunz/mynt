import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import type { TranslationKey } from '../i18n/types'
import { supabase } from '../lib/supabase'
import { AuthLayout, FormError } from './AuthLayout'
import { authErrorKey } from './authErrors'

export function SignIn() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setErrorKey(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErrorKey(authErrorKey(error))
    setBusy(false)
  }

  return (
    <AuthLayout title={t('auth.signIn.title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError messageKey={errorKey} />
        <Button type="submit" disabled={busy}>
          {busy ? t('common.loading') : t('auth.signIn.submit')}
        </Button>
      </form>

      <div className="mt-5 flex flex-col gap-2 border-t border-rule pt-4 text-sm">
        <Link to="/reset-password" className="text-muted hover:text-ink">
          {t('auth.signIn.forgot')}
        </Link>
        <p className="text-muted">
          {t('auth.signIn.noAccount')}{' '}
          <Link
            to="/sign-up"
            className="text-ink underline decoration-field underline-offset-4
                       hover:decoration-ink"
          >
            {t('auth.signIn.createAccount')}
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
