import {
  boolean,
  check,
  date,
  integer,
  pgSchema,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * A typed view of the database, not its definition.
 *
 * The SQL migrations under db/migrations are the source of truth; this file
 * describes the shape TypeScript should expect. drizzle-kit is never allowed to
 * write to the database -- no push, no migrate -- because it manages only what
 * it can express, and would drop the policies, the triggers and the roles it
 * knows nothing about. Only `pull` may run, and only to regenerate this file.
 *
 * The two can drift: add a column in SQL, forget it here, and TypeScript simply
 * will not know it exists. Regenerating after a migration has to become as
 * automatic as `pnpm db:types` used to be.
 */

// ---------------------------------------------------------------------------
// Credentials, in their own schema so that nothing in public joins to them
// ---------------------------------------------------------------------------

const auth = pgSchema('auth')

export const users = auth.table('users', {
  userId: uuid('user_id').primaryKey().default(sql`uuidv7()`),
  // citext in the database, so comparisons ignore case. Drizzle has no citext
  // type; text is the right shape on this side, and the rule is the database's
  // to enforce either way.
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  // A timestamp rather than a boolean: one says whether, the other says when.
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** The same person, seen from the application side, and the only owner every
 *  foreign key in the collection points at. */
export const userInfo = pgTable('user_info', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.userId, { onDelete: 'cascade' }),
  nickname: text('nickname'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// Shared catalog
// ---------------------------------------------------------------------------

export const countries = pgTable(
  'countries',
  {
    countryCode: text('country_code').primaryKey(),
    euroSince: smallint('euro_since').notNull(),
    circulating: boolean('circulating').notNull().default(true),
  },
  (table) => [check('country_code_shape', sql`${table.countryCode} ~ '^[A-Z]{2}$'`)],
)

export const coinTypes = pgTable(
  'coin_types',
  {
    coinTypeId: integer('coin_type_id').primaryKey().generatedAlwaysAsIdentity(),
    countryCode: text('country_code')
      .notNull()
      .references(() => countries.countryCode),
    faceValueCents: smallint('face_value_cents').notNull(),
    year: smallint('year').notNull(),
    // Never null: this value crosses into JavaScript and is concatenated into a
    // lookup key, where a null would land as the word "null".
    variant: text('variant').notNull().default(''),
  },
  (table) => [
    unique().on(table.countryCode, table.faceValueCents, table.year, table.variant),
    check(
      'known_face_value',
      sql`${table.faceValueCents} in (1, 2, 5, 10, 20, 50, 100, 200)`,
    ),
  ],
)

// ---------------------------------------------------------------------------
// Private data
// ---------------------------------------------------------------------------

/**
 * Condition grades, as a table rather than an enum.
 *
 * rank carries the order, worst to best, with gaps so a grade can be slotted
 * between two others by inserting a row. An enum sorted for free but could
 * never lose a value: "dropping an enum value is not implemented".
 */
export const grades = pgTable('grades', {
  gradeCode: text('grade_code').primaryKey(),
  rank: smallint('rank').notNull().unique(),
})

export const binders = pgTable('binders', {
  binderId: uuid('binder_id').primaryKey().default(sql`uuidv7()`),
  userId: uuid('user_id')
    .notNull()
    .references(() => userInfo.userId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
})

/** No userId: a page belongs to a binder, which belongs to someone. The policy
 *  reaches the owner by join rather than trusting a duplicated column. */
export const pages = pgTable(
  'pages',
  {
    pageId: uuid('page_id').primaryKey().default(sql`uuidv7()`),
    binderId: uuid('binder_id')
      .notNull()
      .references(() => binders.binderId, { onDelete: 'cascade' }),
    pageNumber: smallint('page_number').notNull(),
    rowCount: smallint('row_count').notNull(),
    columnCount: smallint('column_count').notNull(),
  },
  (table) => [unique().on(table.binderId, table.pageNumber)],
)

export const coins = pgTable(
  'coins',
  {
    coinId: uuid('coin_id').primaryKey().default(sql`uuidv7()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => userInfo.userId, { onDelete: 'cascade' }),
    coinTypeId: integer('coin_type_id')
      .notNull()
      .references(() => coinTypes.coinTypeId),
    gradeCode: text('grade_code').references(() => grades.gradeCode),
    acquiredOn: date('acquired_on'),
    notes: text('notes'),
    // Null is the jar: a coin waiting to be filed is a normal state. Deleting a
    // page sends its coins back there rather than destroying them.
    pageId: uuid('page_id').references(() => pages.pageId, { onDelete: 'set null' }),
    slotRow: smallint('slot_row'),
    slotColumn: smallint('slot_column'),
  },
  (table) => [
    // Deferrable in the database, which Drizzle cannot express here. place_pair
    // suspends it for its own transaction; see the migration.
    unique('coins_slot_key').on(table.pageId, table.slotRow, table.slotColumn),
  ],
)
