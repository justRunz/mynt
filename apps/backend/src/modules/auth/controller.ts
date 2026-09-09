import { Router, type CookieOptions, type Response } from 'express'

import { dbQueryUnscoped } from '../../db/index.js'
import { env } from '../../env.js'
import { credentialsSchema } from './schemas.js'
import { rotateSession, signIn, signOut, signUp } from './service.js'
import { REFRESH_TTL_DAYS } from './tokens.js'
import type { Session } from './types.js'

/**
 * Sessions over HTTP.
 *
 * Mounted above the authenticate middleware rather than under it, which is the
 * one exception in this server and has to be: these are the routes somebody
 * reaches while holding nothing. Every other route is below the middleware
 * precisely so it cannot be forgotten.
 */
export const authController = Router()

const REFRESH_COOKIE = 'mynt_refresh'

/**
 * Where the refresh token lives, and why not in the response body.
 *
 * httpOnly puts it out of reach of every script on the page, so a cross-site
 * scripting bug cannot read it -- which is the difference that matters, since
 * the access token is deliberately short-lived and this one is not.
 *
 * The path scopes it to these four routes: the browser never attaches it to a
 * read of the collection, so the long-lived half of a session is absent from
 * almost every request that is made.
 *
 * sameSite lax stops another site from making the browser spend it. Secure is
 * off in development only because localhost is not served over TLS; production
 * shares one origin and one certificate.
 */
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProduction,
  path: '/api/auth',
}

/**
 * The one place a session becomes a response.
 *
 * The refresh token goes into the cookie and never into the body; the access
 * token goes into the body and never into a cookie, because it is meant to be
 * held in memory and forgotten when the tab closes.
 */
function respondWithSession(res: Response, session: Session): void {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  })
  res.json({
    userId: session.userId,
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
  })
}

/** Answers a refusal identically whatever caused it, and takes the cookie back
 *  so a browser stops presenting something that will never work again. */
function refuseSession(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS)
  res.status(401).json({ error: 'invalid_refresh' })
}

authController.post('/sign-up', async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body)
  respondWithSession(res, await dbQueryUnscoped((tx) => signUp(tx, email, password)))
})

authController.post('/sign-in', async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body)
  respondWithSession(res, await dbQueryUnscoped((tx) => signIn(tx, email, password)))
})

/**
 * Renews a session from the cookie alone.
 *
 * This is also how the app finds out on load whether anyone is signed in. The
 * access token is held in memory and is therefore gone after a reload; the
 * cookie is what survives, so the first thing the front end does is ask here.
 */
authController.post('/refresh', async (req, res) => {
  const presented: unknown = req.cookies?.[REFRESH_COOKIE]
  if (typeof presented !== 'string') {
    refuseSession(res)
    return
  }

  const session = await dbQueryUnscoped((tx) => rotateSession(tx, presented))
  if (!session) {
    // rotateSession returns rather than throws, so a revoked family stays
    // revoked: a throw would roll its deletion back with the transaction.
    refuseSession(res)
    return
  }

  respondWithSession(res, session)
})

/**
 * Ends this device's session.
 *
 * Answers the same way whether or not the token meant anything, and never fails:
 * a sign-out that can error is a sign-out somebody is left unsure about.
 */
authController.post('/sign-out', async (req, res) => {
  const presented: unknown = req.cookies?.[REFRESH_COOKIE]
  if (typeof presented === 'string') {
    await dbQueryUnscoped((tx) => signOut(tx, presented))
  }
  res.clearCookie(REFRESH_COOKIE, COOKIE_OPTIONS)
  res.status(204).end()
})
