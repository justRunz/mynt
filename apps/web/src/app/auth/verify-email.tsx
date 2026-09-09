import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import type { TranslationKey } from '@/app/i18n/types'
import { verifyEmail } from '@/app/stores/auth'
import { AuthLayout, FormError, FormNotice } from './components/auth-layout'
import { authErrorKey } from './lib/auth-errors'

/**
 * Where the link in the confirmation email lands.
 *
 * On success there is nothing to show: the store gains a session and the router
 * replaces this screen with the collection. Only a failure has a page.
 */
export function VerifyEmail() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token')

  // A missing token is known during render, so it is the initial state rather
  // than something an effect sets afterwards -- there is nothing to synchronise
  // with, and setting it in the effect would start a second render for a fact
  // the first one already had.
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(
    token ? null : 'auth.errors.invalid_link',
  )

  // React runs effects twice in development under StrictMode, and the token is
  // spendable once -- so the second call would consume nothing and report a dead
  // link on a confirmation that had just succeeded.
  const attempted = useRef(false)

  useEffect(() => {
    if (!token || attempted.current) return
    attempted.current = true
    verifyEmail(token).catch((error: unknown) => setErrorKey(authErrorKey(error)))
  }, [token])

  return (
    <AuthLayout title={t('auth.verifyEmail.title')}>
      {errorKey ? (
        <FormError messageKey={errorKey} />
      ) : (
        <FormNotice>{t('auth.verifyEmail.pending')}</FormNotice>
      )}
      <p className="mt-5 border-t border-rule pt-4 text-sm">
        <Link to="/sign-in" className="text-muted hover:text-ink">
          {t('auth.verifyEmail.backToSignIn')}
        </Link>
      </p>
    </AuthLayout>
  )
}
