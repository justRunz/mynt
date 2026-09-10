import { asc, eq } from 'drizzle-orm'

import type { Tx } from '../../db/index.js'
import { binders, pages } from '../../db/schema.js'
import { DomainError, PG, postgresErrorCode } from '../../errors.js'
import type { Binder, CreateBinder, CreatePage } from './types.js'

/**
 * Every binder the collector owns, with its sheets.
 *
 * One query and a regroup, rather than one query per binder. The join returns a
 * row per sheet with the binder repeated; nesting them here is what makes this a
 * service rather than a thin wrapper over a select -- the caller receives the
 * shape it draws, not the shape the database stores.
 */
export async function listBinders(tx: Tx): Promise<Binder[]> {
  const rows = await tx
    .select({
      binderId: binders.binderId,
      name: binders.name,
      pageId: pages.pageId,
      pageNumber: pages.pageNumber,
      rowCount: pages.rowCount,
      columnCount: pages.columnCount,
    })
    .from(binders)
    // Left, so a binder with no sheets still comes back -- that is the state the
    // empty view exists for, and an inner join would hide it.
    .leftJoin(pages, eq(pages.binderId, binders.binderId))
    .orderBy(asc(binders.name), asc(pages.pageNumber))

  const byBinder = new Map<string, Binder>()

  for (const row of rows) {
    let binder = byBinder.get(row.binderId)
    if (!binder) {
      binder = { binderId: row.binderId, name: row.name, pages: [] }
      byBinder.set(row.binderId, binder)
    }
    // Null across the four page columns is the left join finding nothing, not a
    // sheet with missing values. One check answers for all four.
    if (row.pageId !== null) {
      binder.pages.push({
        pageId: row.pageId,
        pageNumber: row.pageNumber!,
        rowCount: row.rowCount!,
        columnCount: row.columnCount!,
      })
    }
  }

  return [...byBinder.values()]
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createBinder(
  tx: Tx,
  userId: string,
  input: CreateBinder,
): Promise<string> {
  const [created] = await tx
    .insert(binders)
    .values({ userId, name: input.name })
    .returning({ binderId: binders.binderId })
  return created!.binderId
}

/**
 * Adds a sheet to a binder.
 *
 * A page carries no owner of its own -- it belongs to a binder, which belongs to
 * someone -- so the policy reaches the owner by join and refuses an insert into
 * a binder that is not the caller's.
 *
 * That refusal and "no such binder" are answered identically, and deliberately.
 * Telling them apart would let anyone with a binder id learn whether it exists,
 * which is the one fact the id itself was supposed to protect.
 */
export async function createPage(
  tx: Tx,
  binderId: string,
  input: CreatePage,
): Promise<string> {
  try {
    const [created] = await tx
      .insert(pages)
      .values({
        binderId,
        pageNumber: input.pageNumber,
        rowCount: input.rowCount,
        columnCount: input.columnCount,
      })
      .returning({ pageId: pages.pageId })
    return created!.pageId
  } catch (error) {
    const code = postgresErrorCode(error)
    // Two sheets claiming the same number in one binder.
    if (code === PG.UNIQUE_VIOLATION) throw new DomainError('page_number_taken')
    // No such binder, or one that is not the caller's, which the policy refuses
    // on the way in. Answered identically -- see above.
    if (code === PG.FOREIGN_KEY_VIOLATION || code === PG.INSUFFICIENT_PRIVILEGE) {
      throw new DomainError('not_found')
    }
    throw error
  }
}
