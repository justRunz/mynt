import type { NextFunction, Request, Response } from 'express'

import { readAccessToken } from '../modules/auth/tokens.js'

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
 * Establishes who is asking, from a token this server signed itself.
 *
 * This is the one place identity enters the server. A route that took a user id
 * from its own body would let anyone write as anyone -- the row level security
 * policy would refuse it, which is the point of having a second line, but the
 * first line is here.
 *
 * Verification is a signature check and nothing else: no database round trip, no
 * session table, no shared state. That is what makes it cheap enough to sit in
 * front of every request, and it is also why an access token cannot be revoked
 * and is therefore short-lived. The refresh half carries that weight instead.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }

  // Null for every failure alike -- bad signature, expired, wrong issuer, not a
  // token at all. "Signature invalid" against "expired" tells someone probing
  // which half of a forgery to fix, and no client has anything different to do
  // about the difference.
  const userId = await readAccessToken(token)
  if (userId === null) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }

  req.userId = userId
  next()
}

/**
 * The signed-in caller, as a value a controller can hold.
 *
 * Express types userId as optional because it is: the property exists on every
 * Request, set on none of them until this middleware runs. Controllers used to
 * answer that with `req.userId!`, which tells the compiler to trust a promise
 * nothing enforces.
 *
 * This enforces it. The throw is unreachable while every route lives under the
 * /api mount -- and it is exactly the bug worth catching loudly if one ever does
 * not, because such a route would run with no identity at all.
 */
export function requireUserId(req: Request): string {
  const { userId } = req
  if (!userId) throw new Error('route reached without authenticate; check the mount')
  return userId
}
