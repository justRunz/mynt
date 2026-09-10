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
 * The SQLSTATEs this server acts on, under the names Postgres gives them.
 *
 * Kept once, here, because the same five characters were being redeclared in
 * every service -- and under different names: 23503 was FOREIGN_KEY_VIOLATION in
 * one file and NOT_FOUND in another. A value copied three times is three places
 * for it to drift.
 *
 * The names are Postgres's, not ours, so they say what the database refused and
 * nothing about what that means to a collector. That meaning differs by case --
 * a unique violation is a taken hole in one table and a taken address in another
 * -- and it is written where each is caught, not here.
 */
export const PG = {
  /** A unique constraint: two rows claiming the same key. */
  UNIQUE_VIOLATION: '23505',
  /** A foreign key pointing at nothing -- and the code this project's triggers
   *  raise for a row the caller's policies hide. */
  FOREIGN_KEY_VIOLATION: '23503',
  /** A check constraint, or a trigger raising in its name. */
  CHECK_VIOLATION: '23514',
  /** Not allowed: in practice, a row level security policy refusing a write. */
  INSUFFICIENT_PRIVILEGE: '42501',
} as const

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

/**
 * The constraint a failure names, when it names one.
 *
 * A SQLSTATE says what kind of thing went wrong; the constraint says which rule.
 * Both foreign keys on coins report 23503, and so does the trigger that hides
 * someone else's page -- three different answers for the collector, told apart
 * by a name the database assigned rather than by a message anybody wrote.
 *
 * Undefined when the failure came from a plpgsql raise, which carries no
 * constraint. That absence is itself informative.
 */
export function postgresErrorConstraint(error: unknown): string | undefined {
  const cause = (error as { cause?: unknown }).cause ?? error
  return (cause as { constraint?: string }).constraint
}
