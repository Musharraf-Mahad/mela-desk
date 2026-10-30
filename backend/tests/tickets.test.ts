import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, publishTicketEventMock, sendTicketEmailNotificationMock } = vi.hoisted(() => ({
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
    user: {
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
  publishTicketEventMock: vi.fn(),
  sendTicketEmailNotificationMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('../src/lib/ticketEvents.js', () => ({
  publishTicketEvent: publishTicketEventMock,
}))
vi.mock('../src/lib/ticketNotifications.js', () => ({
  sendTicketEmailNotification: sendTicketEmailNotificationMock,
}))

import app from '../src/app.js'
import { SESSION_COOKIE_NAME, hashSessionToken } from '../src/lib/session.js'

const customer = { id: 'customer-1', role: 'customer' }
const agent = { id: 'agent-1', role: 'agent' }

describe('ticket routes', () => {
  let server: Server
  let baseUrl: string

  beforeEach(async () => {
    vi.resetAllMocks()
    prismaMock.user.findMany.mockResolvedValue([])
    sendTicketEmailNotificationMock.mockResolvedValue(undefined)
    prismaMock.$transaction.mockImplementation(async (operation) =>
      typeof operation === 'function' ? operation(prismaMock) : Promise.all(operation),
    )
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
      priority: 'high',
      customer: { id: customer.id, name: 'Customer' },
    })
    prismaMock.user.findMany.mockResolvedValue([{ id: agent.id }])

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
          ticketNumber: 'TKT-000001',
          customerId: customer.id,
        },
      }),
    )
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: 'ticket-1',
        userId: customer.id,
        action: 'ticket.created',
        details: JSON.stringify({ ticketNumber: 'TKT-000001', category: 'technical', priority: 'high' }),
      },
    })
    expect(await response.json()).toEqual({
      success: true,
      data: { ticket: expect.objectContaining({ id: 'ticket-1' }) },
    })
    expect(publishTicketEventMock).toHaveBeenCalledWith(
      [customer.id],
      expect.objectContaining({ type: 'ticket.created', ticketId: 'ticket-1' }),
    )
    expect(publishTicketEventMock).toHaveBeenCalledWith(
      [agent.id],
      expect.objectContaining({ type: 'ticket.created', ticketId: 'ticket-1' }),
    )
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

  it('searches matching subject and description within the customers own tickets', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const response = await fetch(
      `${baseUrl}/api/tickets?search=delivery%20delay&status=open`,
      { headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` } },
    )

    expect(response.status).toBe(200)
    expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'open',
          OR: [
            { ticketNumber: { contains: 'delivery delay' } },
            { subject: { contains: 'delivery delay' } },
            { description: { contains: 'delivery delay' } },
          ],
          customerId: customer.id,
        },
      }),
    )
    expect(prismaMock.ticket.count).toHaveBeenCalledWith({
      where: {
        status: 'open',
        OR: [
          { ticketNumber: { contains: 'delivery delay' } },
          { subject: { contains: 'delivery delay' } },
          { description: { contains: 'delivery delay' } },
        ],
        customerId: customer.id,
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

  it('requires an authenticated agent to browse the available ticket queue', async () => {
    const response = await fetch(`${baseUrl}/api/tickets/queue`)

    expect(response.status).toBe(401)
    expect(prismaMock.ticket.findMany).not.toHaveBeenCalled()
  })

  it('prevents customers from browsing the available ticket queue', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })

    const response = await fetch(`${baseUrl}/api/tickets/queue`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
    })

    expect(response.status).toBe(403)
    expect(prismaMock.ticket.findMany).not.toHaveBeenCalled()
  })

  it('lists only open unassigned tickets and supports queue filters and pagination', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })
    prismaMock.$transaction.mockResolvedValue([[], 0])

    const response = await fetch(
      `${baseUrl}/api/tickets/queue?category=technical&priority=high&search=delivery&page=2&pageSize=5`,
      { headers: { cookie: `${SESSION_COOKIE_NAME}=agent-token` } },
    )

    expect(response.status).toBe(200)
    const where = {
      category: 'technical',
      priority: 'high',
      status: 'open',
      assigneeId: null,
      OR: [
        { ticketNumber: { contains: 'delivery' } },
        { subject: { contains: 'delivery' } },
        { description: { contains: 'delivery' } },
      ],
    }
    expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: 5,
        take: 5,
      }),
    )
    expect(prismaMock.ticket.count).toHaveBeenCalledWith({ where })
    expect(await response.json()).toEqual({
      success: true,
      data: {
        tickets: [],
        pagination: { page: 2, pageSize: 5, total: 0, totalPages: 0 },
      },
    })
  })

  it('rejects invalid available-ticket queue filters', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })

    const response = await fetch(`${baseUrl}/api/tickets/queue?page=0`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=agent-token` },
    })

    expect(response.status).toBe(400)
    expect(prismaMock.ticket.findMany).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('rejects invalid ticket filters', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })

    const response = await fetch(`${baseUrl}/api/tickets?status=unknown`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
    })

    expect(response.status).toBe(400)
    expect(prismaMock.ticket.findMany).not.toHaveBeenCalled()
  })

  it('rejects empty or oversized ticket search terms', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })

    const emptySearchResponse = await fetch(`${baseUrl}/api/tickets?search=%20%20`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
    })
    const longSearchResponse = await fetch(
      `${baseUrl}/api/tickets?search=${'a'.repeat(101)}`,
      { headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` } },
    )

    expect(emptySearchResponse.status).toBe(400)
    expect(longSearchResponse.status).toBe(400)
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
    prismaMock.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      customerId: customer.id,
      assigneeId: agent.id,
      subject: 'Need help',
    })
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
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: 'ticket-1',
        userId: customer.id,
        action: 'ticket.comment_added',
        details: JSON.stringify({ commentId: 'comment-1' }),
      },
    })
    expect(payload.data.comment).not.toHaveProperty('isInternal')
    expect(publishTicketEventMock).toHaveBeenCalledWith(
      [agent.id],
      expect.objectContaining({ type: 'ticket.comment_added', ticketId: 'ticket-1' }),
    )
    expect(sendTicketEmailNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: [agent.id], subject: 'New reply on your ticket: Need help' }),
    )
  })

  it('allows an assigned agent to add an internal note', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })
    prismaMock.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      customerId: customer.id,
      assigneeId: agent.id,
      subject: 'Need help',
    })
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
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: {
        ticketId: 'ticket-1',
        userId: agent.id,
        action: 'ticket.internal_comment_added',
        details: JSON.stringify({ commentId: 'comment-2' }),
      },
    })
    expect(publishTicketEventMock).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ type: 'ticket.internal_comment_added', ticketId: 'ticket-1' }),
    )
    expect(sendTicketEmailNotificationMock).not.toHaveBeenCalled()
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
          subject: 'Need help',
          status: 'in_progress',
          customer: { id: customer.id },
          assignee: { id: agent.id },
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
    expect(publishTicketEventMock).toHaveBeenCalledWith(
      [customer.id, agent.id],
      expect.objectContaining({ type: 'ticket.status_changed', status: 'in_progress' }),
    )
    expect(sendTicketEmailNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: [customer.id], subject: 'Ticket status updated: Need help' }),
    )
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
          subject: 'Need help',
          customer: { id: customer.id },
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
    expect(publishTicketEventMock).toHaveBeenCalledWith(
      [customer.id, 'agent-2'],
      expect.objectContaining({ type: 'ticket.assigned', ticketId: 'ticket-1' }),
    )
    expect(sendTicketEmailNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [customer.id, 'agent-2'],
        subject: 'Ticket assigned: Need help',
      }),
    )
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

  it('allows retrieving a ticket using its public ticket number', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: customer })
    prismaMock.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      ticketNumber: 'TKT-000001',
      subject: 'Login issue',
      comments: [],
    })

    const response = await fetch(`${baseUrl}/api/tickets/TKT-000001`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
    })

    expect(response.status).toBe(200)
    expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ticketNumber: 'TKT-000001',
          customerId: customer.id,
        },
      }),
    )
    const json = await response.json()
    expect(json.data.ticket.ticketNumber).toBe('TKT-000001')
  })
})
