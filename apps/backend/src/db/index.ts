import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema.js";

const connectionString = process.env.APP_DATABASE_URL;
if (!connectionString) {
    throw new Error("APP_DATABASE_URL is required. See .env.example.");
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
const pool = new pg.Pool({ connectionString });

// An idle connection that Postgres drops -- a restart, a failover, a proxy's
// idle timeout -- is reported here, on the pool, because no query was waiting
// on it. With no listener that is an unhandled 'error' event, and Node ends the
// process for it. The pool has already discarded the connection and opens
// another on the next query, so there is nothing to do but say it happened.
pool.on("error", (error) => {
    console.error("Idle database connection lost:", error.message);
});

/**
 * Deliberately not exported.
 *
 * There is nothing else to import, so reaching the collection without saying
 * who is asking is not a mistake to avoid -- it is a thing that cannot be
 * written. Signing in needs its own way through, since it reads an account
 * before anyone's identity is known; that is dbQueryUnscoped below, named to be
 * noticed in review, never this handle made public.
 */
const db = drizzle(pool, { schema });

/** The handle inside a scoped transaction. Named so routes can be typed. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
export function dbQueryAs<T>(
    userId: string,
    run: (tx: Tx) => Promise<T>,
): Promise<T> {
    return db.transaction(async (tx) => {
        // Parameterised, so an id from a request body cannot reshape the statement.
        const claims = JSON.stringify({ sub: userId });
        await tx.execute(
            sql`select set_config('request.jwt.claims', ${claims}, true)`,
        );

        // SET LOCAL rather than SET: it falls off at commit. A role name cannot be
        // a parameter, and this one is a constant, so nothing from a request
        // reaches this line.
        await tx.execute(sql`set local role authenticated`);

        return run(tx);
    });
}

/**
 * Runs a query as the server itself, wearing no costume.
 *
 * Authentication cannot be scoped to a collector, because it is what decides
 * which collector it is: sign-in reads an account from an email address, and a
 * refresh reads a session from a cookie. Both happen before there is an identity
 * to state.
 *
 * The name is deliberately alarming, and reviewing a use of it is a two-second
 * job: it belongs in the auth module and nowhere else. Seeing it above a query
 * on coins should stop a reader cold.
 *
 * What keeps it honest is not discipline, though. mynt_app holds privileges on
 * auth.users and auth.refresh_tokens and on nothing else whatsoever -- and it
 * holds the authenticated role WITH INHERIT FALSE, so none of that role's access
 * arrives until the costume is actually put on. This function never puts it on.
 * A query against the collection through here does not come back empty, which
 * would be a result and would get believed; it fails with "permission denied for
 * table coins". There is a test for exactly that.
 */
export function dbQueryUnscoped<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
    return db.transaction(run);
}

/**
 * Whether the database answers, and nothing more.
 *
 * For the health route, which runs before anyone has signed in and so cannot go
 * through either function above. It takes no query and hands back no rows: the
 * one statement it can run is written here, which is what keeps it from being a
 * third way to the tables.
 */
export async function dbIsReachable(): Promise<boolean> {
    try {
        await pool.query("select 1");
        return true;
    } catch {
        return false;
    }
}

/** Lets a process exit instead of waiting on an idle pool: a test run, or the
 *  server on its way down. */
export function closeDb(): Promise<void> {
    return pool.end();
}
