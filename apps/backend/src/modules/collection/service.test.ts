import { eq } from 'drizzle-orm'
import pg from 'pg'
import { afterAll, beforeEach, describe, expect, test } from 'vitest'

import { closeDb, dbQueryAs } from '../../db/index.js'
import { binders, coins, pages } from '../../db/schema.js'
import { DomainError } from '../../errors.js'
import {
  addCoin,
  deleteCoin,
  fileCoin,
  listCoins,
  movePair,
  unfileCoin,
  updateCoin,
} from './service.js'

/**
 * The writes, against a real database.
 *
 * Almost every assertion here is about a refusal, and every refusal comes from
 * the schema rather than from the service -- a policy, a constraint or a
 * trigger. What is under test is that they still reach the collector as
 * something the interface can act on, instead of as a 500.
 */

const ALICE = 'aaaaaaaa-0000-4000-8000-000000000001'
const BOB = 'bbbbbbbb-0000-4000-8000-000000000002'

const owner = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL })

async function refused(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (error) {
    if (error instanceof DomainError) return error.code
    throw error
  }
  throw new Error('the write was expected to be refused, and was not')
}

let coinTypeId = 0
let otherTypeId = 0
/** A four by five sheet in Bob's binder, for everything about somebody else's. */
let hisPageId = ''
/** The same, in Alice's. */
let herPageId = ''

async function makeSheet(userId: string): Promise<string> {
  const [binder] = await dbQueryAs(userId, (tx) =>
    tx.insert(binders).values({ userId, name: 'classeur' }).returning(),
  )
  const [page] = await dbQueryAs(userId, (tx) =>
    tx
      .insert(pages)
      .values({ binderId: binder!.binderId, pageNumber: 1, rowCount: 4, columnCount: 5 })
      .returning(),
  )
  return page!.pageId
}

beforeEach(async () => {
  await owner.query('delete from auth.users where user_id = any($1)', [[ALICE, BOB]])
  for (const [id, email] of [[ALICE, 'alice-w@mynt.test'], [BOB, 'bob-w@mynt.test']]) {
    await owner.query(
      `insert into auth.users (user_id, email, password_hash) values ($1, $2, 'x')`,
      [id, email],
    )
  }
  const types = await owner.query(
    `insert into coin_types (country_code, face_value_cents, year, variant)
     values ('FR', 200, 2003, 'test-a'), ('FR', 200, 2003, 'test-b')
     on conflict (country_code, face_value_cents, year, variant) do update
        set year = excluded.year
     returning coin_type_id`,
  )
  ;[coinTypeId, otherTypeId] = types.rows.map((row) => row.coin_type_id)
  herPageId = await makeSheet(ALICE)
  hisPageId = await makeSheet(BOB)
})

afterAll(async () => {
  await owner.query('delete from auth.users where user_id = any($1)', [[ALICE, BOB]])
  await Promise.all([owner.end(), closeDb()])
})

/** Adds one of Alice's coins, optionally in a hole, and hands back its id. */
function hers(location: { pageId: string; row: number; column: number } | null = null) {
  return dbQueryAs(ALICE, (tx) => addCoin(tx, ALICE, { coinTypeId, gradeCode: null, location }))
}

describe('adding', () => {
  test('a coin belongs to whoever the token said, and to nobody else', async () => {
    await hers()
    expect(await dbQueryAs(ALICE, (tx) => listCoins(tx))).toHaveLength(1)
    expect(await dbQueryAs(BOB, (tx) => listCoins(tx))).toHaveLength(0)
  })

  test('it can be filed in the same write it is created by', async () => {
    // One statement rather than two, so there is no instant in which the coin
    // exists and is nowhere.
    await hers({ pageId: herPageId, row: 1, column: 1 })
    const [coin] = await dbQueryAs(ALICE, (tx) => listCoins(tx))
    expect(coin!.location?.pageId).toBe(herPageId)
  })

  test('a grade the grades table has never heard of is refused', async () => {
    expect(
      await refused(() =>
        dbQueryAs(ALICE, (tx) =>
          addCoin(tx, ALICE, { coinTypeId, gradeCode: 'PARFAITE', location: null }),
        ),
      ),
    ).toBe('unknown_grade')
  })

  test('and so is a catalog entry that does not exist', async () => {
    expect(
      await refused(() =>
        dbQueryAs(ALICE, (tx) =>
          addCoin(tx, ALICE, { coinTypeId: 999_999, gradeCode: null, location: null }),
        ),
      ),
    ).toBe('unknown_coin_type')
  })

  test('a coin cannot be added straight into somebody else s sheet', async () => {
    expect(
      await refused(() =>
        dbQueryAs(ALICE, (tx) =>
          addCoin(tx, ALICE, {
            coinTypeId,
            gradeCode: null,
            location: { pageId: hisPageId, row: 1, column: 1 },
          }),
        ),
      ),
    ).toBe('not_found')
  })
})

describe('editing and removing', () => {
  test("somebody else's coin is not refused, it is absent", async () => {
    const his = await dbQueryAs(BOB, (tx) =>
      addCoin(tx, BOB, { coinTypeId, gradeCode: null, location: null }),
    )

    // Zero rows touched. "No such coin" and "not yours" are one answer, which is
    // as much as anyone should be able to learn from an id they guessed.
    expect(
      await refused(() =>
        dbQueryAs(ALICE, (tx) =>
          updateCoin(tx, his, {
            coinTypeId,
            gradeCode: null,
            acquiredOn: null,
            notes: 'à moi',
          }),
        ),
      ),
    ).toBe('not_found')

    expect(await refused(() => dbQueryAs(ALICE, (tx) => deleteCoin(tx, his)))).toBe('not_found')
    expect(await dbQueryAs(BOB, (tx) => listCoins(tx))).toHaveLength(1)
  })

  test('an edit changes what a coin is and leaves where it sits alone', async () => {
    const coinId = await hers({ pageId: herPageId, row: 2, column: 3 })
    await dbQueryAs(ALICE, (tx) =>
      updateCoin(tx, coinId, {
        coinTypeId: otherTypeId,
        gradeCode: 'UNCIRCULATED',
        acquiredOn: '2026-01-15',
        notes: 'trouvée dans un rouleau',
      }),
    )

    const [coin] = await dbQueryAs(ALICE, (tx) => listCoins(tx))
    expect(coin!.gradeCode).toBe('UNCIRCULATED')
    expect(coin!.acquiredOn).toBe('2026-01-15')
    // Untouched, which is the point of filing having its own route.
    expect(coin!.location?.row).toBe(2)
    expect(coin!.location?.column).toBe(3)
  })
})

describe('filing', () => {
  test('two coins cannot share a hole', async () => {
    await hers({ pageId: herPageId, row: 1, column: 1 })
    const second = await hers()

    expect(
      await refused(() =>
        dbQueryAs(ALICE, (tx) => fileCoin(tx, second, { pageId: herPageId, row: 1, column: 1 })),
      ),
    ).toBe('slot_taken')
  })

  test('a hole outside the sheet is refused', async () => {
    const coinId = await hers()
    // Row five of a four-row sheet. The database knows the dimensions; nothing
    // in the server does, which is why this is the trigger's answer.
    expect(
      await refused(() =>
        dbQueryAs(ALICE, (tx) => fileCoin(tx, coinId, { pageId: herPageId, row: 5, column: 1 })),
      ),
    ).toBe('slot_out_of_bounds')
  })

  test("somebody else's sheet is simply not there", async () => {
    const coinId = await hers()
    expect(
      await refused(() =>
        dbQueryAs(ALICE, (tx) => fileCoin(tx, coinId, { pageId: hisPageId, row: 1, column: 1 })),
      ),
    ).toBe('not_found')
  })

  test('unfiling sends a coin to the jar, which is a place', async () => {
    const coinId = await hers({ pageId: herPageId, row: 1, column: 1 })
    await dbQueryAs(ALICE, (tx) => unfileCoin(tx, coinId))

    const [coin] = await dbQueryAs(ALICE, (tx) => listCoins(tx))
    expect(coin!.location).toBeNull()
  })
})

describe('exchanging two coins', () => {
  test('they swap holes in one statement', async () => {
    const first = await hers({ pageId: herPageId, row: 1, column: 1 })
    const second = await hers({ pageId: herPageId, row: 1, column: 2 })

    // Neither could move on its own: each destination is occupied by the other.
    await dbQueryAs(ALICE, (tx) =>
      movePair(tx, {
        first: { coinId: first, pageId: herPageId, row: 1, column: 2 },
        second: { coinId: second, pageId: herPageId, row: 1, column: 1 },
      }),
    )

    const placed = await dbQueryAs(ALICE, (tx) => listCoins(tx))
    const at = (id: string) => placed.find((coin) => coin.coinId === id)!
    expect([at(first).location?.row, at(first).location?.column]).toEqual([1, 2])
    expect([at(second).location?.row, at(second).location?.column]).toEqual([1, 1])
  })

  test('one of them being somebody else s moves neither', async () => {
    const mine = await hers({ pageId: herPageId, row: 1, column: 1 })
    const his = await dbQueryAs(BOB, (tx) =>
      addCoin(tx, BOB, {
        coinTypeId,
        gradeCode: null,
        location: { pageId: hisPageId, row: 1, column: 1 },
      }),
    )

    // place_pair is security invoker, so his coin is invisible: the update
    // touches nothing and the function raises rather than moving half a pair.
    expect(
      await refused(() =>
        dbQueryAs(ALICE, (tx) =>
          movePair(tx, {
            first: { coinId: mine, pageId: herPageId, row: 2, column: 2 },
            second: { coinId: his, pageId: hisPageId, row: 2, column: 1 },
          }),
        ),
      ),
    ).toBe('not_found')

    // And the half that was allowed did not happen either.
    const [coin] = await dbQueryAs(ALICE, (tx) =>
      tx.select().from(coins).where(eq(coins.coinId, mine)),
    )
    expect([coin!.slotRow, coin!.slotColumn]).toEqual([1, 1])
  })
})
