import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findFirst: vi.fn(),
    },
    ticket: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}))

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }))

import app from '../src/app.js'
import { SESSION_COOKIE_NAME, hashSessionToken } from '../src/lib/session.js'

const customer = { id: 'customer-1', role: 'customer' }
const agent = { id: 'agent-1', role: 'agent' }

describe('ticket routes', () => {
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

  it('requires an authenticated session to create a ticket', async () => {
    const response = await fetch(`${baseUrl}/api/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'Need help',
        description: 'Please help',
        category: 'technical',
        priority: 'normal',
      }),
    })

    expect(response.status).toBe(401)
    expect(prismaMock.ticket.create).not.toHaveBeenCalled()
  })

  it('validates ticket details before creating a record', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })

    const response = await fetch(`${baseUrl}/api/tickets`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=customer-token`,
      },
      body: JSON.stringify({
        subject: '',
        description: '',
        category: 'not-a-category',
        priority: 'critical',
      }),
    })

    expect(response.status).toBe(400)
    expect(prismaMock.session.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tokenHash: hashSessionToken('customer-token'),
        }),
      }),
    )
    expect(prismaMock.ticket.create).not.toHaveBeenCalled()
  })

  it('creates a ticket for the authenticated customer, not a supplied owner', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })
    prismaMock.ticket.create.mockResolvedValue({
      id: 'ticket-1',
      subject: 'Need help',
      customer: { id: customer.id, name: 'Customer' },
    })

    const response = await fetch(`${baseUrl}/api/tickets`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=customer-token`,
      },
      body: JSON.stringify({
        subject: ' Need help ',
        description: ' Please help ',
        category: 'technical',
        priority: 'high',
        customerId: 'another-customer',
      }),
    })

    expect(response.status).toBe(201)
    expect(prismaMock.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          subject: 'Need help',
          description: 'Please help',
          category: 'technical',
          priority: 'high',
          customerId: customer.id,
        },
      }),
    )
    expect(await response.json()).toEqual({
      success: true,
      data: { ticket: expect.objectContaining({ id: 'ticket-1' }) },
    })
  })

  it('prevents agents from creating customer tickets', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })

    const response = await fetch(`${baseUrl}/api/tickets`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=agent-token`,
      },
      body: JSON.stringify({
        subject: 'Need help',
        description: 'Please help',
        category: 'technical',
        priority: 'normal',
      }),
    })

    expect(response.status).toBe(403)
    expect(prismaMock.ticket.create).not.toHaveBeenCalled()
  })

  it('limits customer ticket lists to their own tickets', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })
    prismaMock.ticket.findMany.mockResolvedValue([])
    prismaMock.ticket.count.mockResolvedValue(0)
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const response = await fetch(`${baseUrl}/api/tickets?status=open&page=2&pageSize=5`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
    })

    expect(response.status).toBe(200)
    expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'open', customerId: customer.id },
        skip: 5,
        take: 5,
      }),
    )
    expect(await response.json()).toEqual({
      success: true,
      data: {
        tickets: [],
        pagination: { page: 2, pageSize: 5, total: 0, totalPages: 0 },
      },
    })
  })

  it('limits agent ticket lists to tickets assigned to that agent', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })
    prismaMock.ticket.findMany.mockResolvedValue([])
    prismaMock.ticket.count.mockResolvedValue(0)
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const response = await fetch(`${baseUrl}/api/tickets`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=agent-token` },
    })

    expect(response.status).toBe(200)
    expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assigneeId: agent.id },
      }),
    )
  })

  it('rejects invalid ticket filters', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })

    const response = await fetch(`${baseUrl}/api/tickets?status=unknown`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
    })

    expect(response.status).toBe(400)
    expect(prismaMock.ticket.findMany).not.toHaveBeenCalled()
  })
})
