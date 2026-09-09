import { asc } from 'drizzle-orm'
import { GRADES } from '@mynt/core/grades'
import { afterAll, expect, test } from 'vitest'

import { closeDb, dbQueryAs } from './index.js'
import { grades } from './schema.js'

/**
 * The front end's list of grades, checked against the database's.
 *
 * This used to be a type-level assertion: grades were a Postgres enum, an enum
 * has a generated TypeScript type, and the two could be compared at compile
 * time. They are rows now -- which bought the ability to ever remove one -- and
 * rows have no type, so the check moved here.
 *
 * It reads the real table rather than a fixture. A test that agreed with a copy
 * of the list would agree with itself.
 */

// The policy on grades is `using (true)`, so any identity sees the same rows.
const ANYONE = '11111111-1111-1111-1111-111111111111'

afterAll(() => closeDb())

test('the grades the app offers are the grades the database accepts', async () => {
  const rows = await dbQueryAs(ANYONE, (tx) =>
    tx.select({ gradeCode: grades.gradeCode }).from(grades).orderBy(asc(grades.rank)),
  )

  // Order included: GRADES is declared worst to best and the rank column carries
  // the same order, which is what "SUP and above" filters read.
  expect(rows.map((row) => row.gradeCode)).toEqual([...GRADES])
})
