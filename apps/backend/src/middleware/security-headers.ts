import type { NextFunction, Request, Response } from 'express'

import { env } from '../env.js'

/**
 * The response headers a browser needs to be told, on every response.
 *
 * Written out rather than pulled from helmet. Its defaults include a content
 * security policy, which would start governing the built front end the day this
 * server serves it -- a policy worth writing deliberately then, not inheriting
 * now as a side effect of hardening an API.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Take a declared Content-Type at its word. Without this a browser may sniff
  // a response and decide a JSON body is script.
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // Nothing here is meant to be framed, and a page that cannot be framed cannot
  // be dressed in someone else's to trick a click.
  res.setHeader('X-Frame-Options', 'DENY')

  // Password reset and address confirmation carry their token in the query
  // string. Sending no Referer means the address bar never follows the user to
  // another site.
  res.setHeader('Referrer-Policy', 'no-referrer')

  // HTTPS only from now on, for a year. Production only: on localhost, over
  // plain HTTP, it would be meaningless at best and sticky at worst.
  if (env.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  next()
}
