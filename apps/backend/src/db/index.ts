import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import * as schema from './schema.js'

const connectionString = process.env.APP_DATABASE_URL
if (!connectionString) {
  throw new Error('APP_DATABASE_URL is required. See .env.example.')
}

/**
 * The pool connects as mynt_app, which owns no table.
 *
 * That is not a detail: a table's owner bypasses row level security silently,
 * so a server connecting with the role that created these tables would return
 * everyone's rows the first time a wrapper was forgotten. Connecting as a role
 * with no privilege of its own means the same mistake is refused outright --
 * "permission denied for table coins" -- rather than answered.
 */
const pool = new pg.Pool({ connectionString })

/**
 * Deliberately not exported.
 *
 * There is nothing else to import, so reaching the collection without saying
 * who is asking is not a mistake to avoid -- it is a thing that cannot be
 * written. Signing in will need its own way through, since it has to read an
 * account before anyone's identity is known; that will be a second function
 * with a name loud enough to be noticed in review, never this one made public.
 */
const db = drizzle(pool, { schema })

/** The handle inside a scoped transaction. Named so routes can be typed. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Runs a query as a given collector, and it is the only way to reach the
 * collection.
 *
 * A database connection has no identity -- it is a pipe, handed to whoever asks
 * next. So the identity is stated at the start of a transaction, read back by
 * the policies through auth.current_user_id(), and gone at commit. It has to be
 * gone: the same connection serves the next request, for someone else.
 *
 * A transaction is the only scope in which something can be said and reliably
 * evaporate, which is why every query costs one. Not an arbitrary constraint --
 * the only place the statement fits.
 */
export function dbQueryAs<T>(userId: string, run: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    // Parameterised, so an id from a request body cannot reshape the statement.
    const claims = JSON.stringify({ sub: userId })
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`)

    // SET LOCAL rather than SET: it falls off at commit. A role name cannot be
    // a parameter, and this one is a constant, so nothing from a request
    // reaches this line.
    await tx.execute(sql`set local role authenticated`)

    return run(tx)
  })
}

/** Lets a test process exit instead of waiting on an idle pool. */
export function closeDb(): Promise<void> {
  return pool.end()
}
