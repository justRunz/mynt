import type { NextFunction, Request, Response } from 'express'

/**
 * The last word on failure.
 *
 * A thrown error must not reach the client as a stack trace or a SQL string: a
 * database message names tables and columns, which is free reconnaissance. It is
 * logged in full here and answered with nothing.
 *
 * This is also where domain failures will earn their status codes -- a coin aimed
 * at a taken hole is a 409, not a 500 -- so that no route needs its own catch.
 * Nothing maps yet because nothing is thrown yet; the writes bring the first.
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
  console.error(error)
  res.status(500).json({ error: 'internal' })
}
