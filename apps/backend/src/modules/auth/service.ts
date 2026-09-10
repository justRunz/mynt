import { randomUUID } from 'node:crypto'

import { and, eq, isNull } from 'drizzle-orm'

import type { Tx } from '../../db/index.js'
import { oneTimeTokens, refreshTokens, users } from '../../db/schema.js'
import { DomainError, PG, postgresErrorCode } from '../../errors.js'
import { hashPassword, verifyPassword } from './passwords.js'
import {
  ACCESS_TTL_SECONDS,
  EMAIL_VERIFICATION_TTL_HOURS,
  PASSWORD_RESET_TTL_HOURS,
  hashOpaqueToken,
  hoursFromNow,
  mintOpaqueToken,
  refreshExpiry,
  signAccessToken,
} from './tokens.js'
import type { Session, SignInOutcome } from './types.js'

/**
 * Creating and renewing sessions.
 *
 * Every function here runs unscoped -- as the server itself rather than as a
 * collector -- because that is the situation authentication is: it reads an
 * account in order to find out who is asking, which is the one thing a scoped
 * transaction cannot do. See dbQueryUnscoped, and the test that it reaches
 * auth.users and nothing else.
 */

const EMAIL_VERIFICATION = 'EMAIL_VERIFICATION'
const PASSWORD_RESET = 'PASSWORD_RESET'

/**
 * Issues a link token, and revokes the ones it replaces.
 *
 * Outstanding tokens of the same purpose are marked spent rather than deleted:
 * asking for a second link has to invalidate the first, or a message forwarded
 * or left in an old mailbox keeps working for as long as it has left to live.
 * Kept rather than removed, so a click on the superseded link is a token that
 * was used, not a token that never was.
 */
async function issueLinkToken(
  tx: Tx,
  userId: string,
  purpose: string,
  ttlHours: number,
): Promise<string> {
  const now = new Date()
  await tx
    .update(oneTimeTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(oneTimeTokens.userId, userId),
        eq(oneTimeTokens.purpose, purpose),
        isNull(oneTimeTokens.usedAt),
      ),
    )

  const { token, tokenHash } = mintOpaqueToken()
  await tx
    .insert(oneTimeTokens)
    .values({ userId, purpose, tokenHash, expiresAt: hoursFromNow(ttlHours, now) })
  return token
}

/**
 * Mints a session and records its refresh half.
 *
 * familyId identifies the chain descending from one sign-in: a fresh one when
 * somebody signs in, the existing one when a token is rotated, so a whole
 * device's succession can be revoked together.
 */
async function issueSession(tx: Tx, userId: string, familyId: string): Promise<Session> {
  const { token, tokenHash } = mintOpaqueToken()
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
export async function signUp(
  tx: Tx,
  email: string,
  password: string,
): Promise<{ userId: string; verificationToken: string }> {
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
    // On users, the only unique column is the email address.
    if (postgresErrorCode(error) === PG.UNIQUE_VIOLATION) {
      throw new DomainError('email_taken')
    }
    throw error
  }

  // No session. The address is unproven until somebody opens the mailbox it
  // names, and handing out a session first would make the confirmation a
  // formality that could be skipped by simply never clicking.
  return {
    userId,
    verificationToken: await issueLinkToken(
      tx,
      userId,
      EMAIL_VERIFICATION,
      EMAIL_VERIFICATION_TTL_HOURS,
    ),
  }
}

/**
 * Signs in, or refuses without saying which half was wrong.
 *
 * "No such account" and "wrong password" are one answer on purpose, and the same
 * answer has to take the same time -- which is why the hash goes to
 * verifyPassword even when the lookup found nothing. Sign-up is the deliberate
 * exception: it has to say the address is taken, or nobody could ever recover
 * from a forgotten account.
 *
 * An unverified address comes back as an outcome rather than a thrown error,
 * because answering it means issuing a fresh link -- and a throw would roll that
 * insert back with the transaction, leaving the collector told to check a mailbox
 * nothing was sent to.
 *
 * Resending on every attempt is deliberate. The first message gets lost, filed as
 * spam, or expires while somebody is away, and without this there would be no way
 * back into an account that exists. It is not a way to send mail to strangers:
 * the correct password is required to reach this line at all.
 */
export async function signIn(
  tx: Tx,
  email: string,
  password: string,
): Promise<SignInOutcome> {
  const [account] = await tx
    .select({
      userId: users.userId,
      passwordHash: users.passwordHash,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.email, email))

  if (!(await verifyPassword(account?.passwordHash ?? null, password))) {
    throw new DomainError('invalid_credentials')
  }

  if (account!.emailVerifiedAt === null) {
    return {
      verified: false,
      verificationToken: await issueLinkToken(
        tx,
        account!.userId,
        EMAIL_VERIFICATION,
        EMAIL_VERIFICATION_TTL_HOURS,
      ),
    }
  }

  return { verified: true, session: await issueSession(tx, account!.userId, randomUUID()) }
}

/**
 * Confirms an address, and signs the collector in.
 *
 * Following the link is proof they can read the mailbox, which is the only thing
 * the address was ever a claim about -- so asking for the password again would
 * add a step and prove nothing new.
 *
 * Every failure is one refusal: unknown token, already spent, expired, wrong
 * purpose. The distinctions matter to nobody holding a link that does not work,
 * and each one told apart is a fact given away.
 */
export async function verifyEmail(tx: Tx, presented: string): Promise<Session> {
  const [token] = await tx
    .select()
    .from(oneTimeTokens)
    .where(
      and(
        eq(oneTimeTokens.tokenHash, hashOpaqueToken(presented)),
        eq(oneTimeTokens.purpose, EMAIL_VERIFICATION),
      ),
    )

  if (!token || token.usedAt !== null || token.expiresAt.getTime() <= Date.now()) {
    throw new DomainError('invalid_link')
  }

  // Conditional on still being unspent, so two clicks arriving together cannot
  // both consume it: the second updates nothing and is refused.
  const spent = await tx
    .update(oneTimeTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(oneTimeTokens.tokenId, token.tokenId), isNull(oneTimeTokens.usedAt)))
    .returning({ tokenId: oneTimeTokens.tokenId })

  if (spent.length === 0) throw new DomainError('invalid_link')

  // Only if it was not already: re-confirming should not move the date, which is
  // a record of when this address was first proved.
  await tx
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(and(eq(users.userId, token.userId), isNull(users.emailVerifiedAt)))

  return issueSession(tx, token.userId, randomUUID())
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
    .where(eq(refreshTokens.tokenHash, hashOpaqueToken(presented)))

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
    .where(eq(refreshTokens.tokenHash, hashOpaqueToken(presented)))

  if (!existing) return

  await tx.delete(refreshTokens).where(eq(refreshTokens.familyId, existing.familyId))
}

/**
 * Starts a password reset, if there is an account to start it for.
 *
 * Returns null when there is not, and the route answers the same either way.
 * Telling the two apart would turn this form into a way of asking whether an
 * address is registered -- which is exactly the fact sign-in refuses to reveal,
 * and it would be odd to guard it there and hand it over here.
 *
 * No check that the address was ever confirmed. Somebody who can read the
 * mailbox is the person the address belongs to, whether or not they got round to
 * clicking the first link -- and refusing would strand an account whose
 * confirmation went missing.
 */
export async function requestPasswordReset(tx: Tx, email: string): Promise<string | null> {
  const [account] = await tx
    .select({ userId: users.userId })
    .from(users)
    .where(eq(users.email, email))

  if (!account) return null

  return issueLinkToken(tx, account.userId, PASSWORD_RESET, PASSWORD_RESET_TTL_HOURS)
}

/**
 * Sets a new password, and closes every session the old one opened.
 *
 * The revocation is most of the point. A reset is what somebody does when they
 * believe the password is known to someone else, and leaving that someone's
 * session running would make the whole exercise decorative -- they would keep
 * their access and simply lose the ability to sign in again.
 *
 * It confirms the address at the same time, if it was not already. Reading the
 * mailbox is the same proof the verification link asks for; requiring it twice
 * would strand an account whose first message went missing.
 *
 * No session comes back. Every session just ended, including the caller's, and
 * handing one straight out would contradict the sentence above.
 */
export async function resetPassword(
  tx: Tx,
  presented: string,
  password: string,
): Promise<void> {
  const [token] = await tx
    .select()
    .from(oneTimeTokens)
    .where(
      and(
        eq(oneTimeTokens.tokenHash, hashOpaqueToken(presented)),
        eq(oneTimeTokens.purpose, PASSWORD_RESET),
      ),
    )

  if (!token || token.usedAt !== null || token.expiresAt.getTime() <= Date.now()) {
    throw new DomainError('invalid_link')
  }

  const spent = await tx
    .update(oneTimeTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(oneTimeTokens.tokenId, token.tokenId), isNull(oneTimeTokens.usedAt)))
    .returning({ tokenId: oneTimeTokens.tokenId })

  if (spent.length === 0) throw new DomainError('invalid_link')

  await tx
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.userId, token.userId))

  await tx
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(and(eq(users.userId, token.userId), isNull(users.emailVerifiedAt)))

  // Every device, deleted rather than marked spent: there is nothing to
  // reconstruct afterwards, and a row that can never be presented again is a row
  // worth being rid of.
  await tx.delete(refreshTokens).where(eq(refreshTokens.userId, token.userId))
}
