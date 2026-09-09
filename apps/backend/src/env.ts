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

  /**
   * Where GoTrue publishes the public half of its signing key.
   *
   * Supabase signs with ES256 now, not with a shared secret, so verifying means
   * fetching a key rather than holding one -- and nothing secret lives in this
   * server's environment for it.
   *
   * Temporary, and it is the whole reason step 2 works: the app stays signed in
   * through Supabase while its reads move here, so nothing breaks in between
   * and no fake identity header has to exist. It goes at step 4, when this
   * server issues its own tokens.
   */
  supabaseJwksUrl: required('SUPABASE_JWKS_URL'),
} as const
