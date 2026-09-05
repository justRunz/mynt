import { AuthError } from '@supabase/supabase-js'

import type { TranslationKey } from '@/app/i18n/types'

/**
 * GoTrue answers in English. Map the codes we can name onto translation keys
 * and fall back to a generic message rather than showing the raw English.
 *
 * An explicit map rather than a built `auth.errors.${code}` string, so an
 * unknown code degrades gracefully instead of rendering its own key name.
 */
const MESSAGES: Record<string, TranslationKey> = {
  invalid_credentials: 'auth.errors.invalid_credentials',
  email_not_confirmed: 'auth.errors.email_not_confirmed',
  user_already_exists: 'auth.errors.user_already_exists',
  weak_password: 'auth.errors.weak_password',
  over_email_send_rate_limit: 'auth.errors.over_email_send_rate_limit',
  same_password: 'auth.errors.same_password',
}

export function authErrorKey(error: unknown): TranslationKey {
  if (error instanceof AuthError && error.code) {
    return MESSAGES[error.code] ?? 'auth.errors.generic'
  }
  return 'auth.errors.generic'
}
