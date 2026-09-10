import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createApp } from './app.js'
import { closeDb } from './db/index.js'

/**
 * The server over real HTTP.
 *
 * Everything else in the suite calls services, which is right for rules that
 * live in the database. What is tested here only exists on the wire: status
 * codes from middleware that runs before any service, and response headers.
 */

let server: Server
let base = ''

beforeAll(async () => {
  server = createApp().listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await closeDb()
})

function post(path: string, body: string) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

describe('a body the parser refuses', () => {
  test('JSON that does not parse is the client\'s mistake, not a crash', async () => {
    const response = await post('/binders', '{"name": "oups"')
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid_request' })
  })

  test('a body over the limit is too large, not a crash', async () => {
    const response = await post('/binders', JSON.stringify({ name: 'x'.repeat(200_000) }))
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'payload_too_large' })
  })
})
