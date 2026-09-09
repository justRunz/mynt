import { eq } from 'drizzle-orm'
import pg from 'pg'
import { afterAll, beforeEach, describe, expect, test } from 'vitest'

import { closeDb, dbQueryAs, dbQueryUnscoped } from '../../db/index.js'
import { refreshTokens, userInfo } from '../../db/schema.js'
import { DomainError } from '../../errors.js'
import { readAccessToken } from './tokens.js'
import { rotateSession, signIn, signOut, signUp } from './service.js'

/**
 * The session lifecycle against a real database.
 *
 * Rotation, reuse detection and revocation are all statements about rows, so
 * there is nothing here a mock could assert that would still be true of
 * Postgres.
 */

const EMAIL = 'auth-suite@mynt.test'
const PASSWORD = 'quatre mots ordinaires suffisent'

/** The refusal a service meant, as opposed to something that broke. */
async function refused(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (error) {
    if (error instanceof DomainError) return error.code
    throw error
  }
  throw new Error('the service was expected to refuse, and did not')
}

/**
 * The owner, for teardown only.
 *
 * mynt_app holds select, insert and update on auth.users and no delete -- the
 * server has never needed to remove an account. A test is not a reason to widen
 * that, so the fixture cleans up with the privileges a fixture should have.
 */
const owner = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL })

async function clean() {
  await owner.query(`delete from auth.users where email like '%@mynt.test'`)
}

beforeEach(clean)
afterAll(async () => {
  await clean()
  await Promise.all([owner.end(), closeDb()])
})

describe('signing up', () => {
  test('an account arrives whole, in both schemas', async () => {
    const session = await dbQueryUnscoped((tx) => signUp(tx, EMAIL, PASSWORD))

    // The service writes auth.users only. The user_info row is the trigger's
    // doing, and this is the assertion that it actually fires.
    //
    // Read as the new collector rather than through the unscoped door, which
    // cannot see user_info at all -- and that refusal is the second half of what
    // is being asserted: the account exists, and it exists behind the policy.
    const profile = await dbQueryAs(session.userId, (tx) =>
      tx.select().from(userInfo).where(eq(userInfo.userId, session.userId)),
    )
    expect(profile).toHaveLength(1)
    expect(await readAccessToken(session.accessToken)).toBe(session.userId)
  })

  test('the same address twice is refused', async () => {
    await dbQueryUnscoped((tx) => signUp(tx, EMAIL, PASSWORD))
    expect(await refused(() => dbQueryUnscoped((tx) => signUp(tx, EMAIL, PASSWORD)))).toBe(
      'email_taken',
    )
  })

  test('and case does not make it a different address', async () => {
    // citext in the database. Asserted because the alternative -- two accounts
    // for one person, depending on how they typed it -- is silent.
    await dbQueryUnscoped((tx) => signUp(tx, EMAIL, PASSWORD))
    expect(
      await refused(() =>
        dbQueryUnscoped((tx) => signUp(tx, EMAIL.toUpperCase(), PASSWORD)),
      ),
    ).toBe('email_taken')
  })
})

describe('signing in', () => {
  beforeEach(async () => {
    await dbQueryUnscoped((tx) => signUp(tx, EMAIL, PASSWORD))
  })

  test('the right password opens a session', async () => {
    const session = await dbQueryUnscoped((tx) => signIn(tx, EMAIL, PASSWORD))
    expect(await readAccessToken(session.accessToken)).toBe(session.userId)
  })

  test('a wrong password and an unknown address give the same answer', async () => {
    // One message on purpose: telling them apart says whether an address is
    // registered, which is not this endpoint's business.
    expect(await refused(() => dbQueryUnscoped((tx) => signIn(tx, EMAIL, 'pas le bon')))).toBe(
      'invalid_credentials',
    )
    expect(
      await refused(() => dbQueryUnscoped((tx) => signIn(tx, 'personne@mynt.test', PASSWORD))),
    ).toBe('invalid_credentials')
  })
})

describe('rotating', () => {
  test('spending a token yields a different one', async () => {
    const first = await dbQueryUnscoped((tx) => signUp(tx, EMAIL, PASSWORD))
    const second = await dbQueryUnscoped((tx) => rotateSession(tx, first.refreshToken))

    expect(second).not.toBeNull()
    expect(second!.refreshToken).not.toBe(first.refreshToken)
    expect(second!.userId).toBe(first.userId)
  })

  test('spending it twice revokes the whole chain', async () => {
    const first = await dbQueryUnscoped((tx) => signUp(tx, EMAIL, PASSWORD))
    const second = await dbQueryUnscoped((tx) => rotateSession(tx, first.refreshToken))

    // The theft, as it actually looks: somebody presents a token that has
    // already been spent. Which of the two holders is legitimate is unknowable.
    expect(await dbQueryUnscoped((tx) => rotateSession(tx, first.refreshToken))).toBeNull()

    // So the successor dies too -- including the one the honest client is
    // holding. Both are sent back to the password, which is the point.
    expect(await dbQueryUnscoped((tx) => rotateSession(tx, second!.refreshToken))).toBeNull()

    const left = await dbQueryUnscoped((tx) =>
      tx.select().from(refreshTokens).where(eq(refreshTokens.userId, first.userId)),
    )
    expect(left).toHaveLength(0)
  })

  test('an expired token is refused and cleared away', async () => {
    const session = await dbQueryUnscoped((tx) => signUp(tx, EMAIL, PASSWORD))
    await dbQueryUnscoped((tx) =>
      tx
        .update(refreshTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(refreshTokens.userId, session.userId)),
    )

    expect(await dbQueryUnscoped((tx) => rotateSession(tx, session.refreshToken))).toBeNull()
    expect(
      await dbQueryUnscoped((tx) =>
        tx.select().from(refreshTokens).where(eq(refreshTokens.userId, session.userId)),
      ),
    ).toHaveLength(0)
  })

  test('a token nobody issued is refused without ceremony', async () => {
    await dbQueryUnscoped((tx) => signUp(tx, EMAIL, PASSWORD))
    expect(await dbQueryUnscoped((tx) => rotateSession(tx, 'inventé'))).toBeNull()
  })
})

describe('signing out', () => {
  test('it ends this chain and leaves the other devices alone', async () => {
    // Two sign-ins for one person: two families, which is what a phone and a
    // laptop are.
    const phone = await dbQueryUnscoped((tx) => signUp(tx, EMAIL, PASSWORD))
    const laptop = await dbQueryUnscoped((tx) => signIn(tx, EMAIL, PASSWORD))

    await dbQueryUnscoped((tx) => signOut(tx, phone.refreshToken))

    expect(await dbQueryUnscoped((tx) => rotateSession(tx, phone.refreshToken))).toBeNull()
    expect(
      await dbQueryUnscoped((tx) => rotateSession(tx, laptop.refreshToken)),
    ).not.toBeNull()
  })

  test('signing out with a token nobody issued does nothing at all', async () => {
    const session = await dbQueryUnscoped((tx) => signUp(tx, EMAIL, PASSWORD))
    await dbQueryUnscoped((tx) => signOut(tx, 'inventé'))
    expect(await dbQueryUnscoped((tx) => rotateSession(tx, session.refreshToken))).not.toBeNull()
  })
})
