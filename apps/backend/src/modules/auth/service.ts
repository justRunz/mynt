import { randomUUID } from 'node:crypto'

import { and, eq, isNull } from 'drizzle-orm'

import type { Tx } from '../../db/index.js'
import { refreshTokens, users } from '../../db/schema.js'
import { DomainError, postgresErrorCode } from '../../errors.js'
import { hashPassword, verifyPassword } from './passwords.js'
import {
  ACCESS_TTL_SECONDS,
  hashRefreshToken,
  mintRefreshToken,
  refreshExpiry,
  signAccessToken,
} from './tokens.js'
import type { Session } from './types.js'

/**
 * Creating and renewing sessions.
 *
 * Every function here runs unscoped -- as the server itself rather than as a
 * collector -- because that is the situation authentication is: it reads an
 * account in order to find out who is asking, which is the one thing a scoped
 * transaction cannot do. See dbQueryUnscoped, and the test that it reaches
 * auth.users and nothing else.
 */

/** Postgres unique_violation. Here it can only be the email address. */
const UNIQUE_VIOLATION = '23505'

/**
 * Mints a session and records its refresh half.
 *
 * familyId identifies the chain descending from one sign-in: a fresh one when
 * somebody signs in, the existing one when a token is rotated, so a whole
 * device's succession can be revoked together.
 */
async function issueSession(tx: Tx, userId: string, familyId: string): Promise<Session> {
  const { token, tokenHash } = mintRefreshToken()
  const expiresAt = refreshExpiry()

  await tx.insert(refreshTokens).values({ userId, familyId, tokenHash, expiresAt })

  return {
    userId,
    accessToken: await signAccessToken(userId),
    refreshToken: token,
    refreshExpiresAt: expiresAt,
    expiresIn: ACCESS_TTL_SECONDS,
  }
}

/**
 * Opens an account and signs it in.
 *
 * Only auth.users is written here. The public half -- the user_info row every
 * foreign key in the collection points at -- is attached by a trigger, so an
 * account cannot exist in one schema and not the other because this function
 * returned early or was rewritten carelessly.
 */
export async function signUp(tx: Tx, email: string, password: string): Promise<Session> {
  const passwordHash = await hashPassword(password)

  let userId: string
  try {
    const [created] = await tx
      .insert(users)
      .values({ email, passwordHash })
      .returning({ userId: users.userId })
    userId = created!.userId
  } catch (error) {
    // Let the database decide, rather than checking first: between a SELECT and
    // an INSERT another request can take the address, and the unique constraint
    // is the only check that cannot lose that race.
    if (postgresErrorCode(error) === UNIQUE_VIOLATION) {
      throw new DomainError('email_taken')
    }
    throw error
  }

  return issueSession(tx, userId, randomUUID())
}

/**
 * Signs in, or refuses without saying which half was wrong.
 *
 * "No such account" and "wrong password" are one answer on purpose, and the same
 * answer has to take the same time -- which is why the hash goes to
 * verifyPassword even when the lookup found nothing. Sign-up is the deliberate
 * exception: it has to say the address is taken, or nobody could ever recover
 * from a forgotten account.
 */
export async function signIn(tx: Tx, email: string, password: string): Promise<Session> {
  const [account] = await tx
    .select({ userId: users.userId, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))

  if (!(await verifyPassword(account?.passwordHash ?? null, password))) {
    throw new DomainError('invalid_credentials')
  }

  return issueSession(tx, account!.userId, randomUUID())
}

/**
 * Spends a refresh token and issues its successor, or refuses.
 *
 * Returns null rather than throwing, and that is load-bearing. Detecting a
 * reused token means revoking its whole family, which is a write that must
 * survive the request failing -- and a throw here would roll the transaction
 * back and undo the revocation, leaving the thief's branch alive. So the refusal
 * travels as a value and the transaction commits.
 *
 * Every failure looks identical from outside: unknown token, expired token and
 * detected theft all end in one 401, because the client has the same thing to do
 * about each and a prober learns nothing from the difference.
 */
export async function rotateSession(tx: Tx, presented: string): Promise<Session | null> {
  const [existing] = await tx
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(presented)))

  if (!existing) return null

  if (existing.usedAt !== null) {
    // A rotating token is spendable once. A second presentation proves two
    // copies exist, and nothing distinguishes the thief from the owner -- so
    // neither is trusted. Only the password gets anybody back in.
    console.warn(`refresh token reuse; revoking family ${existing.familyId}`)
    await tx.delete(refreshTokens).where(eq(refreshTokens.familyId, existing.familyId))
    return null
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    await tx.delete(refreshTokens).where(eq(refreshTokens.tokenId, existing.tokenId))
    return null
  }

  // Conditional on still being unspent, so two requests arriving together cannot
  // both rotate the same token: the second updates nothing and is refused.
  const spent = await tx
    .update(refreshTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(refreshTokens.tokenId, existing.tokenId), isNull(refreshTokens.usedAt)))
    .returning({ tokenId: refreshTokens.tokenId })

  if (spent.length === 0) return null

  return issueSession(tx, existing.userId, existing.familyId)
}

/**
 * Signs out, taking the whole family with it.
 *
 * The chain, not the single token: leaving the successors of a sign-out alive
 * would make it a gesture rather than an action. Other devices have their own
 * families and are untouched, which is the reason families exist.
 *
 * Silent when the token is unknown. Signing out is not a place to tell anyone
 * whether the thing they hold was ever real.
 */
export async function signOut(tx: Tx, presented: string): Promise<void> {
  const [existing] = await tx
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(presented)))

  if (!existing) return

  await tx.delete(refreshTokens).where(eq(refreshTokens.familyId, existing.familyId))
}
