/**
 * Failures a service is allowed to name.
 *
 * A service knows what went wrong -- the address is taken, the credentials do
 * not match -- and deliberately does not know what HTTP makes of that. It throws
 * a code; the error handler holds the one table that turns codes into statuses.
 * That way a rule lives in one place, and a service stays testable without
 * pretending to be a web request.
 *
 * The code is also what reaches the client, so it doubles as the key the front
 * end translates. Anything not thrown as one of these is a bug rather than a
 * refusal, and the handler answers it with nothing at all.
 */
export class DomainError extends Error {
  // Assigned rather than declared as a constructor parameter property: the
  // tsconfig sets erasableSyntaxOnly, so every construct has to survive types
  // simply being stripped, and parameter properties emit real code.
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'DomainError'
    this.code = code
  }
}

/**
 * The SQLSTATE under whatever wrapper it arrived in.
 *
 * Drizzle rethrows a database failure with the SQL as the message and the real
 * error as `cause`. Matching on the message would be matching on Drizzle's
 * formatting; the five-character code is the database's own vocabulary and does
 * not move when a message is reworded.
 */
export function postgresErrorCode(error: unknown): string | undefined {
  const cause = (error as { cause?: unknown }).cause ?? error
  return (cause as { code?: string }).code
}
