import type { NextFunction, Request, Response } from 'express'
import { createRemoteJWKSet, jwtVerify } from 'jose'

import { env } from '../env.js'

/**
 * Fetched once and cached, then refetched only when a token arrives signed by a
 * key this has not seen -- which is what makes key rotation a non-event.
 */
const jwks = createRemoteJWKSet(new URL(env.supabaseJwksUrl))

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by authenticate, and the only place a route may learn who is
       *  asking. Never read an id from a body or a query string. */
      userId?: string
    }
  }
}

/**
 * Establishes who is asking, from the token GoTrue issued.
 *
 * This is the one place identity enters the server. A route that took a user id
 * from its own body would let anyone write as anyone -- the row level security
 * policy would refuse it, which is the point of having a second line, but the
 * first line is here.
 *
 * Verifying Supabase's token rather than inventing a development header is
 * deliberate: the app is genuinely signed in during this step, so the real path
 * is exercised from the start and there is no bypass that could survive into
 * production. Only the issuer changes at step 4.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }

  try {
    // jwtVerify checks the signature and the expiry. An expired token is not a
    // token, so this rejects rather than returning stale claims.
    const { payload } = await jwtVerify(token, jwks)
    if (typeof payload.sub !== 'string') {
      res.status(401).json({ error: 'unauthenticated' })
      return
    }
    req.userId = payload.sub
    next()
  } catch {
    // The reason is deliberately not passed on. "Signature invalid" against
    // "expired" tells someone probing which half of a forgery to fix.
    res.status(401).json({ error: 'unauthenticated' })
  }
}
