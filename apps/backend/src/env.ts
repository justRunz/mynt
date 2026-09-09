/**
 * Everything the server reads from its environment, checked at startup.
 *
 * Read here and nowhere else, so a missing variable stops the process on the
 * first line rather than surfacing as an authentication failure at three in the
 * morning. A server that starts and then cannot work is worse than one that
 * refuses to start.
 */

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required. See .env.example.`)
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 3001),

  /**
   * Where the app is served from.
   *
   * Two jobs, which is why it is one variable rather than two that could
   * disagree. It is the origin CORS permits in development, where the app is on
   * 5173 and this is on 3001 -- in production they share an origin and none of
   * that runs. And it is what every link in an email is built from, which is why
   * it has no default: a verification link pointing at localhost because a
   * variable was missing is a mail that cannot be told apart from a working one
   * until somebody clicks it.
   */
  appUrl: required('APP_URL'),

  /** Whether cookies may insist on TLS. Development is served over plain
   *  http on localhost, where a Secure cookie would simply never be set. */
  isProduction: process.env.NODE_ENV === 'production',

  /**
   * The key this server signs its own access tokens with.
   *
   * Symmetric, so the same value verifies them -- see modules/auth/tokens.ts for
   * why that is the right trade here. Whoever holds it can mint a token for any
   * account, which is the whole reason it is read from the environment and never
   * written down in the repository.
   *
   * The length check is not decoration: HS256 keys shorter than the 256-bit hash
   * are the standard way this algorithm is weakened, and a value someone typed
   * by hand in a hurry is exactly how that happens.
   */
  authSecret: (() => {
    const value = required('AUTH_SECRET')
    if (value.length < 32) {
      throw new Error('AUTH_SECRET must be at least 32 characters. See .env.example.')
    }
    return value
  })(),

  /**
   * Where mail goes.
   *
   * Mailpit locally, on a port that speaks SMTP and delivers nothing; a real
   * relay in production. Credentials are optional because the local one wants
   * none, and passing empty strings would make nodemailer attempt to
   * authenticate with them.
   */
  smtpHost: process.env.SMTP_HOST ?? '127.0.0.1',
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  mailFrom: process.env.MAIL_FROM ?? 'Mynt <no-reply@mynt.local>',
} as const
