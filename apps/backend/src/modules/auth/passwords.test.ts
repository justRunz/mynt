import { describe, expect, test } from 'vitest'

import { hashPassword, verifyPassword } from './passwords.js'

describe('passwords', () => {
  test('a hash verifies against the password that made it', async () => {
    const stored = await hashPassword('correcte pile de batterie agrafe')
    expect(await verifyPassword(stored, 'correcte pile de batterie agrafe')).toBe(true)
  })

  test('and against nothing else', async () => {
    const stored = await hashPassword('correcte pile de batterie agrafe')
    expect(await verifyPassword(stored, 'correcte pile de batterie agrafa')).toBe(false)
  })

  test('the same password hashed twice gives two different hashes', async () => {
    // The salt is generated per hash and travels inside the string. Two equal
    // hashes would mean two accounts sharing a password are visibly linked.
    const [a, b] = await Promise.all([hashPassword('même'), hashPassword('même')])
    expect(a).not.toBe(b)
    expect(await verifyPassword(b, 'même')).toBe(true)
  })

  test('the parameters are recorded in the hash, not assumed', async () => {
    expect(await hashPassword('x')).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
  })

  test('an account that does not exist costs what a wrong password costs', async () => {
    // Not a timing comparison -- those are flaky -- but a floor no early return
    // could clear. A verification against the decoy runs a real argon2id pass,
    // measured at roughly 8 ms here, the same as a genuine wrong password;
    // `return false` would take microseconds. Three is far below the one and far
    // above the other.
    const started = performance.now()
    expect(await verifyPassword(null, 'quoi que ce soit')).toBe(false)
    expect(performance.now() - started).toBeGreaterThan(3)
  })
})
