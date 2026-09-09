import { z } from 'zod'

/**
 * What a request body has to look like before any of it is believed.
 *
 * Validation is not the same job as authentication and happens first: a body
 * that is not the right shape never reaches a query, so nothing downstream has
 * to consider the possibility. The types the service works with come from here,
 * which is why they are inferred rather than written twice.
 */
export const credentialsSchema = z.object({
  // Trimmed and lowered before it is checked, so a pasted address with a
  // trailing space is the same account. The column is citext, so the database
  // agrees regardless -- this only keeps what is stored tidy.
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),

  // Ten characters, not eight. Length is the only thing a rule can usefully ask
  // for: composition rules push people towards P@ssw0rd1, which is short and
  // guessed, rather than towards four ordinary words, which is neither.
  //
  // The ceiling is not a strength rule. Argon2 will happily hash ten megabytes
  // and take a minute doing it, which is a way to exhaust the server one request
  // at a time.
  password: z.string().min(10).max(200),
})

export type Credentials = z.infer<typeof credentialsSchema>

/**
 * A token out of a link in an email.
 *
 * Bounded rather than left open: it arrives in a query string that anybody can
 * edit, and a megabyte of text should be refused before it reaches a hash
 * function or a query.
 */
export const linkTokenSchema = z.object({
  token: z.string().min(1).max(500),
})

export const emailSchema = credentialsSchema.pick({ email: true })

export const resetPasswordSchema = linkTokenSchema.extend(
  credentialsSchema.pick({ password: true }).shape,
)
