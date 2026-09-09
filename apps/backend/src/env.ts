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
   * Where the browser talks from, during development only.
   *
   * In production the app and the API share one origin -- Express serves the
   * built front end alongside /api -- so there is no cross-origin request to
   * allow and none of this applies.
   */
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',

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
} as const
