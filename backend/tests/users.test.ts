import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findFirst: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}))

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }))

import app from '../src/app.js'
import { SESSION_COOKIE_NAME } from '../src/lib/session.js'

const admin = { id: 'admin-1', role: 'admin' }
const agent = { id: 'agent-1', role: 'agent' }

describe('user directory routes', () => {
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

  it('requires an authenticated session to list agents', async () => {
    const response = await fetch(`${baseUrl}/api/users/agents`)

    expect(response.status).toBe(401)
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it('allows only admins to access the agent directory', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })

    const response = await fetch(`${baseUrl}/api/users/agents`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=agent-token` },
    })

    expect(response.status).toBe(403)
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it('returns a paginated active-agent list with safe selected fields', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    const agents = [
      { id: 'agent-1', name: 'Agent One', email: 'one@example.com' },
      { id: 'agent-2', name: 'Agent Two', email: 'two@example.com' },
    ]
    prismaMock.$transaction.mockResolvedValue([agents, 2])

    const response = await fetch(`${baseUrl}/api/users/agents?page=2&pageSize=2`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=admin-token` },
    })

    expect(response.status).toBe(200)
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: 'agent', isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 2,
      take: 2,
    })
    expect(prismaMock.user.count).toHaveBeenCalledWith({
      where: { role: 'agent', isActive: true },
    })
    expect(await response.json()).toEqual({
      success: true,
      data: {
        agents,
        pagination: {
          page: 2,
          pageSize: 2,
          total: 2,
          totalPages: 1,
        },
      },
    })
  })

  it('rejects invalid pagination and does not query the database', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })

    const response = await fetch(`${baseUrl}/api/users/agents?page=0&pageSize=101`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=admin-token` },
    })

    expect(response.status).toBe(400)
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
