import pg from 'pg'
import { afterAll, beforeEach, describe, expect, test } from 'vitest'

import { closeDb, dbQueryAs } from '../../db/index.js'
import { DomainError } from '../../errors.js'
import { createBinder, createPage, listBinders } from './service.js'

const ALICE = 'aaaaaaaa-0000-4000-8000-000000000011'
const BOB = 'bbbbbbbb-0000-4000-8000-000000000012'

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

const SHEET = { pageNumber: 1, rowCount: 4, columnCount: 5 }

beforeEach(async () => {
  await owner.query('delete from auth.users where user_id = any($1)', [[ALICE, BOB]])
  for (const [id, email] of [[ALICE, 'alice-b@mynt.test'], [BOB, 'bob-b@mynt.test']]) {
    await owner.query(
      `insert into auth.users (user_id, email, password_hash) values ($1, $2, 'x')`,
      [id, email],
    )
  }
})

afterAll(async () => {
  await owner.query('delete from auth.users where user_id = any($1)', [[ALICE, BOB]])
  await Promise.all([owner.end(), closeDb()])
})

describe('binders', () => {
  test('a binder belongs to the caller and appears to nobody else', async () => {
    await dbQueryAs(ALICE, (tx) => createBinder(tx, ALICE, { name: 'Europe' }))
    expect(await dbQueryAs(ALICE, (tx) => listBinders(tx))).toHaveLength(1)
    expect(await dbQueryAs(BOB, (tx) => listBinders(tx))).toHaveLength(0)
  })

  test('a sheet lands in it', async () => {
    const binderId = await dbQueryAs(ALICE, (tx) =>
      createBinder(tx, ALICE, { name: 'Europe' }),
    )
    await dbQueryAs(ALICE, (tx) => createPage(tx, binderId, SHEET))

    const [binder] = await dbQueryAs(ALICE, (tx) => listBinders(tx))
    expect(binder!.pages).toHaveLength(1)
    expect(binder!.pages[0]!.rowCount).toBe(4)
  })

  test('two sheets cannot both be page one', async () => {
    const binderId = await dbQueryAs(ALICE, (tx) =>
      createBinder(tx, ALICE, { name: 'Europe' }),
    )
    await dbQueryAs(ALICE, (tx) => createPage(tx, binderId, SHEET))

    expect(
      await refused(() => dbQueryAs(ALICE, (tx) => createPage(tx, binderId, SHEET))),
    ).toBe('page_number_taken')
  })

  test("a sheet cannot be slipped into somebody else's binder", async () => {
    // A page carries no owner of its own; the policy reaches Bob by joining
    // through the binder, and refuses the insert on the way in.
    const his = await dbQueryAs(BOB, (tx) => createBinder(tx, BOB, { name: 'le sien' }))
    expect(await refused(() => dbQueryAs(ALICE, (tx) => createPage(tx, his, SHEET)))).toBe(
      'not_found',
    )
    expect((await dbQueryAs(BOB, (tx) => listBinders(tx)))[0]!.pages).toHaveLength(0)
  })

  test('and a binder that never existed gives the very same answer', async () => {
    // Identical on purpose. If the two differed, anyone holding an id could ask
    // this route whether it is real -- which is the one thing the id protects.
    expect(
      await refused(() =>
        dbQueryAs(ALICE, (tx) =>
          createPage(tx, '00000000-0000-4000-8000-000000000000', SHEET),
        ),
      ),
    ).toBe('not_found')
  })
})
