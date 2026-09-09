import { useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Button } from '@/app/ui/button'
import { Field } from '@/app/ui/field'
import type { TranslationKey } from '@/app/i18n/types'
import { signUp } from '@/app/stores/auth'
import { AuthLayout, FormError } from './components/auth-layout'
import { authErrorKey } from './lib/auth-errors'

export function SignUp() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setErrorKey(null)
    // Signed straight in, with no confirmation step in between. Verifying an
    // address needs somewhere to send the mail from, which this app does not yet
    // have; until it does, pretending to have sent one would be worse than not
    // claiming to.
    try {
      await signUp(email, password)
    } catch (error) {
      setErrorKey(authErrorKey(error))
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t('auth.signUp.title')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label={t('auth.fields.email')}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {/* Ten characters, matching the server. Length is the only rule worth
            asking for: composition rules push people towards P@ssw0rd1, which
            is short and guessed, rather than four ordinary words, which is
            neither. */}
        <Field
          label={t('auth.fields.password')}
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError messageKey={errorKey} />
        <Button type="submit" disabled={busy}>
          {busy ? t('common.loading') : t('auth.signUp.submit')}
        </Button>
      </form>

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
