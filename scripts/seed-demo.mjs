/**
 * Seeds a demo account with a collection worth looking at.
 *
 * Local development only: it talks to the local Supabase stack with the
 * published anon key and creates a throwaway account. Never point it at a
 * hosted project.
 *
 *   node scripts/seed-demo.mjs
 */

const API = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const EMAIL = process.env.DEMO_EMAIL ?? 'demo@mynt.test'
const PASSWORD = process.env.DEMO_PASSWORD ?? 'mynt2026'
const NICKNAME = 'Démo'

/** Deterministic pseudo-random, so two runs produce the same collection. */
let seed = 20260829
const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = (list) => list[Math.floor(random() * list.length)]

async function call(path, { method = 'GET', token, body, prefer } = {}) {
  const headers = { apikey: ANON, 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (prefer) headers.Prefer = prefer
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function signUpOrSignIn() {
  try {
    const session = await call('/auth/v1/signup', {
      method: 'POST',
      body: { email: EMAIL, password: PASSWORD, data: { nickname: NICKNAME } },
    })
    if (session.access_token) return session
  } catch (error) {
    if (!String(error).includes('already')) throw error
  }
  return call('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  })
}

const COUNTRIES = ['FR', 'DE', 'ES', 'IT', 'BE', 'PT', 'NL', 'GR', 'AT', 'FI', 'IE', 'SI', 'HR', 'LU']
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

async function main() {
  const session = await signUpOrSignIn()
  const token = session.access_token
  const profileId = session.user?.id ?? (await call('/auth/v1/user', { token })).id

  // Start from a clean slate so the script can be re-run.
  await call(`/rest/v1/coin?profile_id=eq.${profileId}`, { method: 'DELETE', token })
  await call(`/rest/v1/binder?profile_id=eq.${profileId}`, { method: 'DELETE', token })

  const [binder] = await call('/rest/v1/binder', {
    method: 'POST',
    token,
    prefer: 'return=representation',
    body: { profile_id: profileId, name: 'Classeur Europe', sort_order: 0 },
  })

  const pages = []
  for (const number of [1, 2, 3]) {
    const [page] = await call('/rest/v1/page', {
      method: 'POST',
      token,
      prefer: 'return=representation',
      body: { binder_id: binder.id, number, row_count: 4, column_count: 5 },
    })
    pages.push(page)
  }

  // Every free slot on the first two pages, in order.
  const slots = []
  for (const page of pages.slice(0, 2)) {
    for (let row = 1; row <= page.row_count; row++) {
      for (let column = 1; column <= page.column_count; column++) {
        slots.push({ page_id: page.id, slot_row: row, slot_column: column })
      }
    }
  }

  // PostgREST caps a plain select, so page through explicit ranges -- the same
  // trap the app already handles in app/catalog.ts.
  const catalog = []
  for (let offset = 0; ; offset += 1000) {
    const batch = await call(
      `/rest/v1/coin_type?select=id,country_code,face_value_cents,year&order=id.asc&offset=${offset}&limit=1000`,
      { token },
    )
    catalog.push(...batch)
    if (batch.length < 1000) break
  }
  const byCountry = new Map()
  for (const type of catalog) {
    if (!COUNTRIES.includes(type.country_code)) continue
    if (!VALUES.includes(type.face_value_cents)) continue
    const list = byCountry.get(type.country_code) ?? []
    list.push(type)
    byCountry.set(type.country_code, list)
  }

  const missing = COUNTRIES.filter((code) => !byCountry.has(code))
  if (missing.length > 0) {
    throw new Error(`Catalogue incomplet, pays absents : ${missing.join(', ')}`)
  }

  const rows = []
  const TOTAL = 58
  for (let i = 0; i < TOTAL; i++) {
    const country = pick(COUNTRIES)
    const type = pick(byCountry.get(country))
    const slot = i < slots.length ? slots[i] : null
    rows.push({
      profile_id: profileId,
      coin_type_id: type.id,
      grade: pick(GRADES),
      notes: pick(NOTES),
      // PostgREST rejects a batch whose objects do not share the same keys.
      page_id: slot?.page_id ?? null,
      slot_row: slot?.slot_row ?? null,
      slot_column: slot?.slot_column ?? null,
    })
  }

  // Duplicates are the daily reality of this hobby, so make sure some exist.
  for (let i = 0; i < 4; i++) {
    const source = rows[i * 3]
    rows.push({ ...source, page_id: null, slot_row: null, slot_column: null, notes: 'Double' })
  }

  await call('/rest/v1/coin', { method: 'POST', token, body: rows })

  const all = await call('/rest/v1/coin?select=id,page_id', { token })
  const filed = all.filter((c) => c.page_id !== null).length

  console.log(`Compte      ${EMAIL}`)
  console.log(`Mot de passe ${PASSWORD}`)
  console.log(`Collection  ${all.length} pièces, dont ${filed} rangées`)
  console.log(`Classeur    « ${binder.name} », ${pages.length} pages de 4 × 5`)
}

main().catch((error) => {
  console.error(String(error))
  process.exit(1)
})
