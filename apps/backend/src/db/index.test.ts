import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import pg from 'pg'

import { closeDb, dbQueryAs, dbQueryUnscoped } from './index.js'
import { binders, coins, coinTypes, pages, users } from './schema.js'

/**
 * The isolation boundary, asserted rather than trusted.
 *
 * Everything here was verified by hand while the schema was being written. A
 * test exists so that a later change -- a grant widened, a policy edited, a
 * role given INHERIT back -- fails here instead of quietly returning somebody
 * else's collection.
 */

/**
 * The Postgres error under Drizzle's wrapper.
 *
 * Drizzle rethrows failures with the SQL as the message, so asserting on that
 * would be testing Drizzle's formatting rather than the database's refusal. The
 * SQLSTATE underneath is what is worth pinning: it does not move when a message
 * is reworded or translated.
 */
async function refusal(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    const cause = (error as { cause?: unknown }).cause ?? error
    return cause as { code?: string; message?: string }
  }
  throw new Error('the database was expected to refuse, and did not')
}

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

/** The owner. Fixtures need privileges the server does not have, and setting
 *  state up is exactly the job that should bypass the policies. */
const owner = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL })

/** The application role, used only to prove what happens without the wrapper. */
const unscoped = new pg.Pool({ connectionString: process.env.TEST_APP_DATABASE_URL })

let coinTypeId = 0

beforeAll(async () => {
  await owner.query('delete from auth.users where user_id = any($1)', [[ALICE, BOB]])

  // One insert, not two: the trigger on auth.users attaches the user_info row.
  // This fixture used to write it by hand, and now cannot -- which is the
  // invariant working.
  for (const [id, email] of [[ALICE, 'alice@test'], [BOB, 'bob@test']]) {
    await owner.query(
      `insert into auth.users (user_id, email, password_hash) values ($1, $2, 'x')`,
      [id, email],
    )
  }

  const type = await owner.query(
    `insert into coin_types (country_code, face_value_cents, year)
     values ('FR', 200, 2003)
     on conflict (country_code, face_value_cents, year, variant) do update
        set year = excluded.year
     returning coin_type_id`,
  )
  coinTypeId = type.rows[0].coin_type_id
})

afterAll(async () => {
  await owner.query('delete from auth.users where user_id = any($1)', [[ALICE, BOB]])
  await Promise.all([owner.end(), unscoped.end(), closeDb()])
})

describe('reading', () => {
  test("a collector does not see another's coins", async () => {
    await dbQueryAs(ALICE, (tx) =>
      tx.insert(coins).values({ userId: ALICE, coinTypeId }),
    )

    // No filter on either side. The policy adds one, and it adds a different
    // one for each of them.
    const hers = await dbQueryAs(ALICE, (tx) => tx.select().from(coins))
    const his = await dbQueryAs(BOB, (tx) => tx.select().from(coins))

    expect(hers).toHaveLength(1)
    expect(his).toHaveLength(0)
  })

  test('the shared catalog stays visible to both', async () => {
    const hers = await dbQueryAs(ALICE, (tx) => tx.select().from(coinTypes))
    const his = await dbQueryAs(BOB, (tx) => tx.select().from(coinTypes))

    expect(hers.length).toBeGreaterThan(0)
    expect(his).toHaveLength(hers.length)
  })

  test('an identity with no account sees nothing but the catalog', async () => {
    const stranger = '99999999-9999-9999-9999-999999999999'
    expect(await dbQueryAs(stranger, (tx) => tx.select().from(coins))).toHaveLength(0)
    expect(
      (await dbQueryAs(stranger, (tx) => tx.select().from(coinTypes))).length,
    ).toBeGreaterThan(0)
  })
})

describe('writing', () => {
  test('a collector cannot file a coin under another name', async () => {
    const error = await refusal(() =>
      dbQueryAs(ALICE, (tx) => tx.insert(coins).values({ userId: BOB, coinTypeId })),
    )
    expect(error.code).toBe('42501')
    expect(error.message).toMatch(/row-level security/)
  })

  test('a collector cannot give a coin away', async () => {
    const [mine] = await dbQueryAs(ALICE, (tx) => tx.select().from(coins).limit(1))

    // USING lets this through -- the row is hers. WITH CHECK is what refuses,
    // because the row *afterwards* would be his.
    const error = await refusal(() =>
      dbQueryAs(ALICE, (tx) =>
        tx.update(coins).set({ userId: BOB }).where(eq(coins.coinId, mine!.coinId)),
      ),
    )
    expect(error.code).toBe('42501')
  })

  test('an unrestricted delete removes only your own rows', async () => {
    await dbQueryAs(BOB, (tx) => tx.insert(coins).values({ userId: BOB, coinTypeId }))

    // No where clause at all, which is the point: the table Bob empties is not
    // the same table Alice can see.
    await dbQueryAs(BOB, (tx) => tx.delete(coins))

    expect(await dbQueryAs(BOB, (tx) => tx.select().from(coins))).toHaveLength(0)
    expect(await dbQueryAs(ALICE, (tx) => tx.select().from(coins))).toHaveLength(1)
  })

  test('a coin cannot be filed into a page belonging to someone else', async () => {
    const [binder] = await dbQueryAs(BOB, (tx) =>
      tx.insert(binders).values({ userId: BOB, name: 'his' }).returning(),
    )
    const [page] = await dbQueryAs(BOB, (tx) =>
      tx
        .insert(pages)
        .values({ binderId: binder!.binderId, pageNumber: 1, rowCount: 4, columnCount: 5 })
        .returning(),
    )

    // The foreign key alone would accept this: referential integrity runs with
    // elevated privileges and does not consult the policies. The trigger reads
    // pages as the caller, so his page is simply not there.
    const [hers] = await dbQueryAs(ALICE, (tx) => tx.select().from(coins).limit(1))
    const error = await refusal(() =>
      dbQueryAs(ALICE, (tx) =>
        tx
          .update(coins)
          .set({ pageId: page!.pageId, slotRow: 1, slotColumn: 1 })
          .where(eq(coins.coinId, hers!.coinId)),
      ),
    )
    expect(error.message).toMatch(/page not found/)
  })
})

describe('the net under the wrapper', () => {
  test('reaching the collection without an identity is refused, not answered', async () => {
    // What the server would do if a query escaped dbQueryAs. It does not come
    // back empty -- an empty answer is a result, and results get believed.
    await expect(unscoped.query('select * from coins')).rejects.toThrow(
      /permission denied for table coins/,
    )
  })

  test('and so is writing', async () => {
    await expect(
      unscoped.query('insert into coins (user_id, coin_type_id) values ($1, $2)', [
        ALICE,
        coinTypeId,
      ]),
    ).rejects.toThrow(/permission denied for table coins/)
  })
})

describe('the door authentication uses', () => {
  test('it reaches the credentials, which is the whole reason it exists', async () => {
    // Sign-in has to find an account from an email address, before anybody's
    // identity is known. No scoped transaction can do that: auth.users is
    // granted to the server role and to no policy-bound costume.
    const rows = await dbQueryUnscoped((tx) =>
      tx.select().from(users).where(eq(users.userId, ALICE)),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.email).toBe('alice@test')
  })

  test('and it reaches nothing else', async () => {
    // The same function, one table over. If this ever returns rows instead of
    // throwing, the auth module has become a way into the collection.
    const error = await refusal(() => dbQueryUnscoped((tx) => tx.select().from(coins)))
    expect(error.code).toBe('42501')
    expect(error.message).toMatch(/permission denied for table coins/)
  })
})
