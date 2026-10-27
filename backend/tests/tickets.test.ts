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
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    comment: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
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

  it('returns a customers ticket with internal comments fully excluded', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })
    prismaMock.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      comments: [
        {
          id: 'public-comment',
          body: 'Visible reply',
          isInternal: false,
          author: { id: 'agent-1', name: 'Agent' },
        },
        {
          id: 'internal-comment',
          body: 'Private agent note',
          isInternal: true,
          author: { id: 'agent-1', name: 'Agent' },
        },
      ],
    })

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1', customerId: customer.id },
        select: expect.objectContaining({
          comments: expect.objectContaining({
            where: { isInternal: false },
          }),
        }),
      }),
    )
    expect(payload.data.ticket.comments).toEqual([
      expect.objectContaining({ id: 'public-comment', body: 'Visible reply' }),
    ])
    expect(JSON.stringify(payload)).not.toContain('Private agent note')
    expect(JSON.stringify(payload)).not.toContain('"isInternal"')
  })

  it('returns 404 when a customer requests another customers ticket', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })
    prismaMock.ticket.findFirst.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/api/tickets/other-ticket`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
    })

    expect(response.status).toBe(404)
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'other-ticket', customerId: customer.id },
      }),
    )
  })

  it('allows staff to view internal comments on tickets in their scope', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })
    prismaMock.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      comments: [
        {
          id: 'internal-comment',
          body: 'Private agent note',
          isInternal: true,
          author: { id: agent.id, name: 'Agent' },
        },
      ],
    })

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=agent-token` },
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1', assigneeId: agent.id },
        select: expect.objectContaining({
          comments: expect.objectContaining({ where: undefined }),
        }),
      }),
    )
    expect(payload.data.ticket.comments[0]).toMatchObject({
      body: 'Private agent note',
      isInternal: true,
    })
  })

  it('does not allow customers to request internal comments', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/comments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=customer-token`,
      },
      body: JSON.stringify({ body: 'Private note', isInternal: true }),
    })

    expect(response.status).toBe(403)
    expect(prismaMock.ticket.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.comment.create).not.toHaveBeenCalled()
  })

  it('creates a public customer comment using the authenticated author id', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })
    prismaMock.ticket.findFirst.mockResolvedValue({ id: 'ticket-1' })
    prismaMock.comment.create.mockResolvedValue({
      id: 'comment-1',
      body: 'Customer reply',
      isInternal: false,
      author: { id: customer.id, name: 'Customer' },
    })

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/comments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=customer-token`,
      },
      body: JSON.stringify({ body: ' Customer reply ', authorId: 'other-user' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1', customerId: customer.id },
      }),
    )
    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          ticketId: 'ticket-1',
          authorId: customer.id,
          body: 'Customer reply',
          isInternal: false,
        },
      }),
    )
    expect(payload.data.comment).not.toHaveProperty('isInternal')
  })

  it('allows an assigned agent to add an internal note', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })
    prismaMock.ticket.findFirst.mockResolvedValue({ id: 'ticket-1' })
    prismaMock.comment.create.mockResolvedValue({
      id: 'comment-2',
      body: 'Internal note',
      isInternal: true,
      author: { id: agent.id, name: 'Agent' },
    })

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/comments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=agent-token`,
      },
      body: JSON.stringify({ body: 'Internal note', isInternal: true }),
    })

    expect(response.status).toBe(201)
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1', assigneeId: agent.id },
      }),
    )
    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorId: agent.id,
          isInternal: true,
        }),
      }),
    )
  })

  it('prevents customers from changing ticket status', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=customer-token`,
      },
      body: JSON.stringify({ status: 'resolved' }),
    })

    expect(response.status).toBe(403)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('validates ticket statuses before performing a transaction', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=agent-token`,
      },
      body: JSON.stringify({ status: 'waiting' }),
    })

    expect(response.status).toBe(400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('updates status and records an audit log for an assigned agent', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })
    const transaction = {
      ticket: {
        findFirst: vi.fn().mockResolvedValue({ id: 'ticket-1', status: 'open' }),
        update: vi.fn().mockResolvedValue({
          id: 'ticket-1',
          status: 'in_progress',
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=agent-token`,
      },
      body: JSON.stringify({ status: 'in_progress' }),
    })

    expect(response.status).toBe(200)
    expect(transaction.ticket.findFirst).toHaveBeenCalledWith({
      where: { id: 'ticket-1', assigneeId: agent.id },
      select: { id: true, status: true },
    })
    expect(transaction.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1' },
        data: { status: 'in_progress' },
      }),
    )
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: 'ticket-1',
        userId: agent.id,
        action: 'ticket.status_changed',
        details: JSON.stringify({ from: 'open', to: 'in_progress' }),
      },
    })
    expect(await response.json()).toEqual({
      success: true,
      data: { ticket: expect.objectContaining({ status: 'in_progress' }) },
    })
  })

  it('does not let an agent update a ticket assigned to someone else', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })
    const transaction = {
      ticket: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=agent-token`,
      },
      body: JSON.stringify({ status: 'resolved' }),
    })

    expect(response.status).toBe(404)
    expect(transaction.ticket.update).not.toHaveBeenCalled()
    expect(transaction.auditLog.create).not.toHaveBeenCalled()
  })

  it('allows admins to update any ticket and audit the change', async () => {
    const admin = { id: 'admin-1', role: 'admin' }
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    const transaction = {
      ticket: {
        findFirst: vi.fn().mockResolvedValue({ id: 'ticket-1', status: 'open' }),
        update: vi.fn().mockResolvedValue({ id: 'ticket-1', status: 'closed' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ status: 'closed' }),
    })

    expect(response.status).toBe(200)
    expect(transaction.ticket.findFirst).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      select: { id: true, status: true },
    })
    expect(transaction.auditLog.create).toHaveBeenCalled()
  })

  it('prevents agents from assigning tickets', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/assignee`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=agent-token`,
      },
      body: JSON.stringify({ assigneeId: 'agent-2' }),
    })

    expect(response.status).toBe(403)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('validates assignment input before running a transaction', async () => {
    const admin = { id: 'admin-1', role: 'admin' }
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/assignee`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ assigneeId: 42 }),
    })

    expect(response.status).toBe(400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('assigns a ticket to an active agent and audits the change', async () => {
    const admin = { id: 'admin-1', role: 'admin' }
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    const transaction = {
      ticket: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ticket-1',
          assigneeId: null,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'ticket-1',
          assignee: { id: 'agent-2', name: 'Agent Two' },
        }),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'agent-2' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/assignee`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ assigneeId: 'agent-2' }),
    })

    expect(response.status).toBe(200)
    expect(transaction.ticket.findFirst).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      select: { id: true, assigneeId: true },
    })
    expect(transaction.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'agent-2', role: 'agent', isActive: true },
      select: { id: true },
    })
    expect(transaction.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ticket-1' },
        data: { assigneeId: 'agent-2' },
      }),
    )
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: 'ticket-1',
        userId: admin.id,
        action: 'ticket.assigned',
        details: JSON.stringify({ from: null, to: 'agent-2' }),
      },
    })
  })

  it('rejects assignments to inactive users and does not update the ticket', async () => {
    const admin = { id: 'admin-1', role: 'admin' }
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    const transaction = {
      ticket: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ticket-1',
          assigneeId: null,
        }),
        update: vi.fn(),
      },
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      auditLog: { create: vi.fn() },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/assignee`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ assigneeId: 'inactive-user' }),
    })

    expect(response.status).toBe(422)
    expect(transaction.ticket.update).not.toHaveBeenCalled()
    expect(transaction.auditLog.create).not.toHaveBeenCalled()
  })

  it('unassigns a ticket and audits the previous agent', async () => {
    const admin = { id: 'admin-1', role: 'admin' }
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    const transaction = {
      ticket: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'ticket-1',
          assigneeId: 'agent-2',
        }),
        update: vi.fn().mockResolvedValue({ id: 'ticket-1', assignee: null }),
      },
      user: { findFirst: vi.fn() },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/assignee`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ assigneeId: null }),
    })

    expect(response.status).toBe(200)
    expect(transaction.user.findFirst).not.toHaveBeenCalled()
    expect(transaction.ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { assigneeId: null },
      }),
    )
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: 'ticket-1',
        userId: admin.id,
        action: 'ticket.unassigned',
        details: JSON.stringify({ from: 'agent-2', to: null }),
      },
    })
  })

  it('lets an agent claim an unassigned open ticket and audits the claim', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })
    const transaction = {
      ticket: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'ticket-1',
          status: 'open',
          assignee: { id: agent.id, name: 'Agent' },
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/claim`, {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE_NAME}=agent-token` },
    })

    expect(response.status).toBe(200)
    expect(transaction.ticket.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ticket-1',
        assigneeId: null,
        status: 'open',
      },
      data: { assigneeId: agent.id },
    })
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: 'ticket-1',
        userId: agent.id,
        action: 'ticket.claimed',
        details: JSON.stringify({ from: null, to: agent.id }),
      },
    })
  })

  it('prevents customers from claiming tickets', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/claim`, {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
    })

    expect(response.status).toBe(403)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('returns a conflict when an open ticket has already been claimed', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })
    const transaction = {
      ticket: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue({ id: 'ticket-1' }),
      },
      auditLog: { create: vi.fn() },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/tickets/ticket-1/claim`, {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE_NAME}=agent-token` },
    })

    expect(response.status).toBe(409)
    expect(transaction.auditLog.create).not.toHaveBeenCalled()
  })

  it('returns not found when claiming a nonexistent ticket', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })
    const transaction = {
      ticket: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      auditLog: { create: vi.fn() },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/tickets/missing-ticket/claim`, {
      method: 'POST',
      headers: { cookie: `${SESSION_COOKIE_NAME}=agent-token` },
    })

    expect(response.status).toBe(404)
    expect(transaction.auditLog.create).not.toHaveBeenCalled()
  })
})
