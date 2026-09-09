import { ApiError } from '@/app/lib/api'

import type { TranslationKey } from '@/app/i18n/types'

/**
 * The server answers with a code; the screens show a sentence.
 *
 * An explicit map rather than a built `auth.errors.${code}` string, so a code
 * this app has never heard of degrades to a generic message instead of
 * rendering its own key name at the reader.
 *
 * The codes are ours now, which makes the list short and closed: they are
 * defined in the error handler and nowhere else, and nothing arrives here that
 * was not put there deliberately.
 */
const MESSAGES: Record<string, TranslationKey> = {
  invalid_credentials: 'auth.errors.invalid_credentials',
  email_taken: 'auth.errors.email_taken',
  email_not_verified: 'auth.errors.email_not_verified',
  invalid_link: 'auth.errors.invalid_link',
  // The only shape a sign-in or sign-up body can get wrong, in practice, is a
  // password below the minimum -- the address is already checked by the field.
  invalid_request: 'auth.errors.weak_password',
}

export function authErrorKey(error: unknown): TranslationKey {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? 'auth.errors.generic'
  return 'auth.errors.generic'
}
