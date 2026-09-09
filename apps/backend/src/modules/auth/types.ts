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
