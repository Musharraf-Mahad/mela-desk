import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, argon2Mock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
  argon2Mock: {
    argon2id: 2,
    hash: vi.fn(),
    verify: vi.fn(),
  },
}))

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('argon2', () => ({ default: argon2Mock }))

import app from '../src/app.js'
import {
  hashSessionToken,
  SESSION_COOKIE_NAME,
} from '../src/lib/session.js'

const testUser = {
  id: 'user-1',
  name: 'Test Customer',
  email: 'customer@example.com',
  role: 'customer',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
}

describe('authentication routes', () => {
  let server: Server
  let baseUrl: string

  beforeEach(async () => {
    vi.resetAllMocks()
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

  it('rejects invalid registration input without querying the database', async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: 'not-an-email',
        password: 'short',
      }),
    })

    expect(response.status).toBe(400)
    expect(prismaMock.user.create).not.toHaveBeenCalled()
    expect(argon2Mock.hash).not.toHaveBeenCalled()
  })

  it('stores an Argon2id hash and never returns it during registration', async () => {
    argon2Mock.hash.mockResolvedValue('argon2id-hash')
    prismaMock.user.create.mockResolvedValue(testUser)

    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: ' Test Customer ',
        email: 'CUSTOMER@example.com',
        password: 'correct horse battery',
      }),
    })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(argon2Mock.hash).toHaveBeenCalledWith('correct horse battery', {
      type: argon2Mock.argon2id,
    })
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Test Customer',
          email: 'customer@example.com',
          passwordHash: 'argon2id-hash',
        }),
      }),
    )
    expect(payload).toEqual({
      success: true,
      data: { user: expect.objectContaining({ email: testUser.email }) },
    })
    expect(JSON.stringify(payload)).not.toContain('argon2id-hash')
  })

  it('creates a hashed server-side session and sets an HttpOnly cookie on login', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...testUser,
      passwordHash: 'argon2id-hash',
      isActive: true,
    })
    argon2Mock.verify.mockResolvedValue(true)
    prismaMock.session.create.mockResolvedValue({})

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'CUSTOMER@example.com',
        password: 'correct horse battery',
      }),
    })
    const setCookie = response.headers.get('set-cookie')
    const token = setCookie?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1]

    expect(response.status).toBe(200)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(prismaMock.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash: hashSessionToken(token!),
        userId: testUser.id,
        expiresAt: expect.any(Date),
      }),
    })
    expect(await response.json()).toEqual({
      success: true,
      data: { user: expect.objectContaining({ id: testUser.id }) },
    })
  })

  it('rejects an incorrect password without creating a session', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...testUser,
      passwordHash: 'argon2id-hash',
      isActive: true,
    })
    argon2Mock.verify.mockResolvedValue(false)

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: 'incorrect password',
      }),
    })

    expect(response.status).toBe(401)
    expect(prismaMock.session.create).not.toHaveBeenCalled()
  })

  it('requires a valid cookie for the current-user endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`)

    expect(response.status).toBe(401)
    expect(prismaMock.session.findFirst).not.toHaveBeenCalled()
  })

  it('returns the safe user for a valid session cookie', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: testUser })

    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=session-token` },
    })

    expect(response.status).toBe(200)
    expect(prismaMock.session.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenHash: hashSessionToken('session-token'),
          expiresAt: expect.objectContaining({ gt: expect.any(Date) }),
        }),
      }),
    )
    expect(await response.json()).toEqual({
      success: true,
      data: {
        user: {
          ...testUser,
          createdAt: testUser.createdAt.toISOString(),
        },
      },
    })
  })

  it('clears the cookie when a session is expired or revoked', async () => {
    prismaMock.session.findFirst.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=expired-token` },
    })

    expect(response.status).toBe(401)
    expect(response.headers.get('set-cookie')).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
  })

  it('revokes the stored session and clears the cookie on logout', async () => {
    prismaMock.session.deleteMany.mockResolvedValue({ count: 1 })

    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE_NAME}=session-token` },
    })

    expect(response.status).toBe(200)
    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken('session-token') },
    })
    expect(response.headers.get('set-cookie')).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(await response.json()).toEqual({
      success: true,
      message: 'Logged out successfully',
    })
  })
})
