import { once } from 'node:events'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    session: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

import app from '../src/app.js'

describe('JSON request body errors', () => {
  let server: Server
  let baseUrl: string

  beforeEach(async () => {
    server = app.listen(0)
    await once(server, 'listening')
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  it('returns a structured JSON error for malformed JSON', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"email":',
    })

    expect(response.status).toBe(400)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({
      success: false,
      message: 'Malformed JSON request body',
    })
  })

  it('returns a structured JSON error when the request body exceeds the limit', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'a'.repeat(1024 * 101) }),
    })

    expect(response.status).toBe(413)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({
      success: false,
      message: 'JSON request body exceeds the allowed size',
    })
  })
})
