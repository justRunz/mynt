import { SignJWT } from 'jose'
import { describe, expect, test } from 'vitest'

import {
  hashOpaqueToken,
  mintOpaqueToken,
  readAccessToken,
  refreshExpiry,
  REFRESH_TTL_DAYS,
  signAccessToken,
} from './tokens.js'

const ALICE = '11111111-1111-1111-1111-111111111111'

describe('access tokens', () => {
  test('a token says who it was minted for', async () => {
    expect(await readAccessToken(await signAccessToken(ALICE))).toBe(ALICE)
  })

  test('a tampered token says nobody', async () => {
    const token = await signAccessToken(ALICE)
    // Flip one character of the payload. The signature covers it, so this is
    // every forgery attempt at once.
    const [header, payload, signature] = token.split('.')
    const bent = `${header}.${payload!.slice(0, -1)}${payload!.at(-1) === 'A' ? 'B' : 'A'}.${signature}`
    expect(await readAccessToken(bent)).toBeNull()
  })

  test('a token signed with another key says nobody', async () => {
    // A well-formed JWT, correct issuer, correct subject, wrong secret. Nothing
    // about it is malformed -- only the signature fails.
    const forged = await new SignJWT()
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(ALICE)
      .setIssuer('mynt')
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('a'.repeat(32)))

    expect(await readAccessToken(forged)).toBeNull()
  })

  test('an expired token says nobody, however genuine', async () => {
    const stale = await new SignJWT()
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(ALICE)
      .setIssuer('mynt')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET!))

    expect(await readAccessToken(stale)).toBeNull()
  })

  test('and neither does something that is not a token at all', async () => {
    expect(await readAccessToken('')).toBeNull()
    expect(await readAccessToken('Bearer oops')).toBeNull()
  })
})

describe('opaque tokens', () => {
  test('two mints are never the same token', () => {
    const seen = new Set(Array.from({ length: 100 }, () => mintOpaqueToken().token))
    expect(seen.size).toBe(100)
  })

  test('the hash it hands back is the hash of the token it hands out', () => {
    const { token, tokenHash } = mintOpaqueToken()
    expect(hashOpaqueToken(token)).toBe(tokenHash)
  })

  test('the hash does not resemble the token', () => {
    // What the table stores must not be usable as what the cookie carries. Said
    // as a test because storing the token itself is a one-character mistake.
    const { token, tokenHash } = mintOpaqueToken()
    expect(tokenHash).not.toContain(token)
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('expiry is thirty days out', () => {
    const from = new Date('2026-01-01T00:00:00Z')
    expect(refreshExpiry(from).toISOString()).toBe('2026-01-31T00:00:00.000Z')
    expect(REFRESH_TTL_DAYS).toBe(30)
  })
})
