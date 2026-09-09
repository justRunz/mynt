/** What a successful sign-in, sign-up or refresh produces. */
export interface Session {
  userId: string
  /** Short-lived, signed, and never stored anywhere by this server. */
  accessToken: string
  /** Opaque, long-lived, single-use. Travels only in an httpOnly cookie. */
  refreshToken: string
  refreshExpiresAt: Date
  /** Seconds the access token remains valid, so the client can renew before it
   *  expires rather than after a request has already failed. */
  expiresIn: number
}

/**
 * What signing in produced.
 *
 * A union rather than a session or an exception, because "the password was right
 * but the address is unproven" is not a failure to report -- it is a state with a
 * fresh link attached, and the link has to survive the request.
 */
export type SignInOutcome =
  | { verified: true; session: Session }
  | { verified: false; verificationToken: string }
