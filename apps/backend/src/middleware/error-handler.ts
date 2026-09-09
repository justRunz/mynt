import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

import { DomainError } from '../errors.js'

/**
 * What HTTP makes of a failure.
 *
 * The services throw a code and stay out of this; one table here turns codes
 * into statuses, so the rule lives once and a service remains testable without
 * pretending to be a web request.
 */
const STATUS: Record<string, number> = {
  // The address is taken. Told plainly, unlike a failed sign-in: somebody who
  // has forgotten they already have an account has to be able to find out.
  email_taken: 409,
  // Deliberately one answer for a wrong password and an unknown address alike.
  invalid_credentials: 401,
}

/**
 * The last word on failure.
 *
 * Three kinds arrive here. A DomainError is a refusal the service meant, and its
 * code reaches the client because the front end translates it. A ZodError is a
 * malformed request, answered as 400 with no detail of which field -- the client
 * that sent it knows what it sent. Anything else is a bug.
 *
 * A bug must not reach the client as a stack trace or a SQL string: a database
 * message names tables and columns, which is free reconnaissance. It is logged
 * in full here and answered with nothing.
 *
 * Express 5 routes rejected promises here on its own, so an async handler needs
 * no wrapper to be caught.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof DomainError) {
    // A code with no entry is a code somebody forgot to place. 500 rather than a
    // default of 400, because guessing would hide the omission.
    const status = STATUS[error.code]
    if (status !== undefined) {
      res.status(status).json({ error: error.code })
      return
    }
  }

  if (error instanceof ZodError) {
    res.status(400).json({ error: 'invalid_request' })
    return
  }

  console.error(error)
  res.status(500).json({ error: 'internal' })
}
