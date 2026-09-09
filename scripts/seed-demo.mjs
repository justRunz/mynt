/**
 * Fills the new database with a collection worth looking at.
 *
 * Local development only. It writes as the owner, bypassing row level
 * security, which is exactly what a fixture needs and exactly what the server
 * must never do.
 *
 *   pnpm db:demo
 *
 * The account has a fixed id, so the demo collection survives re-seeding and so
 * the ids in a bug report mean the same thing on two machines. It used to be
 * read out of the running Supabase stack, back when two databases had to agree
 * on who this person was; there is one database now.
 */

import { execFileSync } from 'node:child_process'

import { hash } from '@node-rs/argon2'

const CONTAINER = 'mynt_db'
const EMAIL = process.env.DEMO_EMAIL ?? 'demo@mynt.test'

/**
 * Hashed the same way the server hashes one, so this account signs in through
 * the real sign-in route rather than through a shortcut.
 *
 * It used to be the literal string 'seeded-not-a-real-hash', which was honest
 * while GoTrue still held the passwords and useless the moment it stopped: the
 * demo collection existed and nobody could open it.
 */
const PASSWORD = process.env.DEMO_PASSWORD ?? 'collection de démonstration'
const ARGON2ID = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 }

const NICKNAME = 'Démo'

/** Deterministic, so two runs produce the same collection. */
let seed = 20260829
const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = (list) => list[Math.floor(random() * list.length)]

const psql = (args, input) =>
  execFileSync('docker', ['exec', '-i', CONTAINER, 'psql', ...args], {
    input,
    encoding: 'utf8',
  })

/** Fixed, and recognisable in a query result. Version 4 in shape rather than
 *  the uuidv7 the column defaults to: a seeded row should look seeded. */
const USER_ID = '5eed0000-0000-4000-8000-000000000000'

const COUNTRIES = {
  // Country to its first minting year, so a generated coin always exists in
  // the catalog. Picking a year a country never struck would insert nothing
  // and leave the collection quietly short.
  FR: 1999, BE: 1999, ES: 1999, NL: 1999, FI: 1999,
  DE: 2002, IT: 2002, PT: 2002, GR: 2002, AT: 2002, IE: 2002, LU: 2002,
  SI: 2007, HR: 2023,
}
const VALUES = [1, 2, 5, 10, 20, 50, 100, 200]
const GRADES = [null, 'VERY_FINE', 'EXTREMELY_FINE', 'ABOUT_UNCIRCULATED', 'UNCIRCULATED']
const NOTES = [
  null, null, null, null,
  'Trouvée en brocante',
  'Rendue en monnaie à la boulangerie',
  'Reçue dans un lot',
  'Bord légèrement usé',
  'Première de ce pays',
]

const CURRENT_YEAR = new Date().getFullYear()
const quote = (value) => (value === null ? 'null' : `'${String(value).replace(/'/g, "''")}'`)

async function main() {
  const passwordHash = await hash(PASSWORD, ARGON2ID)
  const binderId = '5eed0000-0000-4000-8000-000000000001'
  const pageIds = [1, 2, 3].map((n) => `5eed0000-0000-4000-8000-00000000000${n + 1}`)

  const lines = []
  const say = (sql) => lines.push(sql)

  // Re-runnable: the account cascades to everything it owns. Matched on the
  // address as well as the id, so the account seeded under the old Supabase
  // uuid is cleaned up rather than left beside the new one.
  say(`delete from auth.users where user_id = ${quote(USER_ID)} or email = ${quote(EMAIL)};`)
  say(`insert into auth.users (user_id, email, password_hash, email_verified_at)
       values (${quote(USER_ID)}, ${quote(EMAIL)}, ${quote(passwordHash)}, now());`)
  // Updated rather than inserted: the trigger on auth.users has already put the
  // row there, and writing it again would violate the primary key.
  say(`update user_info set nickname = ${quote(NICKNAME)} where user_id = ${quote(USER_ID)};`)

  say(`insert into binders (binder_id, user_id, name)
       values (${quote(binderId)}, ${quote(USER_ID)}, 'Classeur Europe');`)
  for (const [index, pageId] of pageIds.entries()) {
    say(`insert into pages (page_id, binder_id, page_number, row_count, column_count)
         values (${quote(pageId)}, ${quote(binderId)}, ${index + 1}, 4, 5);`)
  }

  // Every hole on the first two sheets, in order, then the jar.
  const slots = []
  for (const pageId of pageIds.slice(0, 2)) {
    for (let row = 1; row <= 4; row++) {
      for (let column = 1; column <= 5; column++) slots.push({ pageId, row, column })
    }
  }

  const codes = Object.keys(COUNTRIES)
  const coins = []
  for (let i = 0; i < 58; i++) {
    const code = pick(codes)
    const since = COUNTRIES[code]
    coins.push({
      code,
      value: pick(VALUES),
      year: since + Math.floor(random() * (CURRENT_YEAR - since + 1)),
      grade: pick(GRADES),
      notes: pick(NOTES),
      slot: slots[i] ?? null,
    })
  }
  // Duplicates are the daily reality of this hobby, so make sure some exist.
  for (let i = 0; i < 4; i++) {
    coins.push({ ...coins[i * 3], slot: null, notes: 'Double' })
  }

  for (const coin of coins) {
    // The coin type is resolved by its natural key rather than by an id the
    // script would have to look up first. The unique constraint on the catalog
    // guarantees the subquery matches at most one row.
    say(`insert into coins (user_id, coin_type_id, grade_code, notes, page_id, slot_row, slot_column)
         select ${quote(USER_ID)},
                coin_type_id, ${quote(coin.grade)}, ${quote(coin.notes)},
                ${quote(coin.slot?.pageId ?? null)},
                ${coin.slot ? coin.slot.row : 'null'},
                ${coin.slot ? coin.slot.column : 'null'}
           from coin_types
          where country_code = ${quote(coin.code)}
            and face_value_cents = ${coin.value}
            and year = ${coin.year};`)
  }

  // One statement, so a failure halfway leaves nothing behind.
  psql(['-U', 'postgres', '-d', 'mynt', '-q', '-v', 'ON_ERROR_STOP=1', '-1'],
       lines.join('\n'))

  const count = (what) =>
    psql(['-U', 'postgres', '-d', 'mynt', '-tAc', what]).trim()

  console.log(`Compte       ${EMAIL}`)
  console.log(`Mot de passe ${PASSWORD}`)
  console.log(`Identifiant  ${USER_ID}`)
  console.log(
    `Collection   ${count(`select count(*) from coins where user_id = '${USER_ID}'`)} pièces, ` +
      `dont ${count(
        `select count(*) from coins where user_id = '${USER_ID}' and page_id is not null`,
      )} rangées`,
  )
  console.log(`Classeur     « Classeur Europe », 3 pages de 4 × 5`)
}

await main()
