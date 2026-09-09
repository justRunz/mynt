import { createHash, randomBytes } from 'node:crypto'

import { SignJWT, jwtVerify } from 'jose'

import { env } from '../../env.js'

/**
 * The two halves of a session.
 *
 * HS256 with one secret, not the ES256 Supabase used. Asymmetric signing earns
 * its keep when the verifier is not the signer -- Supabase had to let anyone
 * check a token without being able to mint one. Here both are this process, so a
 * shared secret is the same guarantee with one key instead of two.
 */

const secret = new TextEncoder().encode(env.authSecret)

/** Pinned on the way out and required on the way back, so a JWT minted by some
 *  other service that happened onto the same secret is still not ours. */
const ISSUER = 'mynt'

/**
 * Fifteen minutes, because an access token cannot be withdrawn.
 *
 * Verifying it costs no database round trip, which is what makes reads cheap,
 * and is exactly why there is nothing to revoke: the server holds no record of
 * it. Short life is the only limit on a leaked one, so it is the compensation
 * for that speed rather than an arbitrary number.
 */
const ACCESS_TTL_MINUTES = 15
const ACCESS_TTL = `${ACCESS_TTL_MINUTES}m`

/** Handed to the client so it can renew before a request fails rather than
 *  after. */
export const ACCESS_TTL_SECONDS = ACCESS_TTL_MINUTES * 60

/** Thirty days, and rotating: the collector who opens the app once a month
 *  stays signed in, and a stolen token has a horizon. */
export const REFRESH_TTL_DAYS = 30

export function signAccessToken(userId: string): Promise<string> {
  return new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret)
}

/**
 * Who a token says is asking, or nobody.
 *
 * Null covers every failure without distinguishing them -- bad signature,
 * expired, wrong issuer, not a JWT at all. Telling a prober which half of a
 * forgery to fix is a favour worth withholding, and no caller has anything
 * different to do about it anyway.
 */
export async function readAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER })
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

/**
 * A fresh refresh token: the secret to hand out, and the hash to keep.
 *
 * 32 bytes from the system's CSPRNG. Opaque on purpose -- unlike the access
 * token it carries no claims, because its holder's identity is looked up rather
 * than asserted, and a token that says nothing cannot say something false.
 */
export function mintRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashRefreshToken(token) }
}

/**
 * The form that is safe to store, and the form every lookup uses.
 *
 * Plain SHA-256, no salt: a salt exists to stop one precomputed table from
 * cracking many hashes at once, which needs the inputs to be guessable. These
 * are 256 bits of randomness. There is no table to build.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function refreshExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
}
