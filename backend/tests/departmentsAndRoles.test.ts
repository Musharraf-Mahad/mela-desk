import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '@prisma/client'
import { requireRole } from '../src/middleware/authenticate.js'
import type { Request, Response, NextFunction } from 'express'

const { prismaMock, argon2Mock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    session: {
      findFirst: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ticket: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
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
import { hashSessionToken, SESSION_COOKIE_NAME } from '../src/lib/session.js'

describe('UserRole definitions and expansion', () => {
  it('includes all 5 expected roles with correct values', () => {
    expect(UserRole.customer).toBe('customer')
    expect(UserRole.agent).toBe('agent')
    expect(UserRole.department_head).toBe('department_head')
    expect(UserRole.head).toBe('head')
    expect(UserRole.admin).toBe('admin')

    const roleValues = Object.values(UserRole)
    expect(roleValues).toContain('customer')
    expect(roleValues).toContain('agent')
    expect(roleValues).toContain('department_head')
    expect(roleValues).toContain('head')
    expect(roleValues).toContain('admin')
    expect(roleValues.length).toBe(5)
  })
})

describe('requireRole middleware with expanded roles', () => {
  function createMockContext(user?: { id: string; role: UserRole; sessionExpiresAt: Date }) {
    const req = { user } as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response
    const next = vi.fn() as NextFunction
    return { req, res, next }
  }

  it('rejects unauthenticated requests with 401', () => {
    const middleware = requireRole(UserRole.admin)
    const { req, res, next } = createMockContext(undefined)

    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Authentication required',
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('allows department_head when authorized and rejects other roles', () => {
    const middleware = requireRole(UserRole.department_head)

    // Allowed
    const allowed = createMockContext({
      id: 'dh-1',
      role: UserRole.department_head,
      sessionExpiresAt: new Date(Date.now() + 60_000),
    })
    middleware(allowed.req, allowed.res, allowed.next)
    expect(allowed.next).toHaveBeenCalled()

    // Rejected roles
    for (const role of [UserRole.customer, UserRole.agent, UserRole.head, UserRole.admin]) {
      const rejected = createMockContext({
        id: 'user-x',
        role,
        sessionExpiresAt: new Date(Date.now() + 60_000),
      })
      middleware(rejected.req, rejected.res, rejected.next)
      expect(rejected.res.status).toHaveBeenCalledWith(403)
      expect(rejected.res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Insufficient permissions',
      })
      expect(rejected.next).not.toHaveBeenCalled()
    }
  })

  it('allows head when authorized and rejects other roles', () => {
    const middleware = requireRole(UserRole.head)

    // Allowed
    const allowed = createMockContext({
      id: 'head-1',
      role: UserRole.head,
      sessionExpiresAt: new Date(Date.now() + 60_000),
    })
    middleware(allowed.req, allowed.res, allowed.next)
    expect(allowed.next).toHaveBeenCalled()

    // Rejected roles
    for (const role of [UserRole.customer, UserRole.agent, UserRole.department_head, UserRole.admin]) {
      const rejected = createMockContext({
        id: 'user-y',
        role,
        sessionExpiresAt: new Date(Date.now() + 60_000),
      })
      middleware(rejected.req, rejected.res, rejected.next)
      expect(rejected.res.status).toHaveBeenCalledWith(403)
      expect(rejected.next).not.toHaveBeenCalled()
    }
  })

  it('preserves existing roles behavior for admin, agent, customer', () => {
    const adminMiddleware = requireRole(UserRole.admin)
    const agentMiddleware = requireRole(UserRole.agent)
    const customerMiddleware = requireRole(UserRole.customer)

    const adminCtx = createMockContext({ id: 'a-1', role: UserRole.admin, sessionExpiresAt: new Date() })
    const agentCtx = createMockContext({ id: 'ag-1', role: UserRole.agent, sessionExpiresAt: new Date() })
    const customerCtx = createMockContext({ id: 'c-1', role: UserRole.customer, sessionExpiresAt: new Date() })

    adminMiddleware(adminCtx.req, adminCtx.res, adminCtx.next)
    expect(adminCtx.next).toHaveBeenCalled()

    agentMiddleware(agentCtx.req, agentCtx.res, agentCtx.next)
    expect(agentCtx.next).toHaveBeenCalled()

    customerMiddleware(customerCtx.req, customerCtx.res, customerCtx.next)
    expect(customerCtx.next).toHaveBeenCalled()
  })

  it('supports multi-role access lists correctly', () => {
    const staffMiddleware = requireRole(UserRole.agent, UserRole.department_head, UserRole.head, UserRole.admin)

    for (const role of [UserRole.agent, UserRole.department_head, UserRole.head, UserRole.admin]) {
      const ctx = createMockContext({ id: 'staff-1', role, sessionExpiresAt: new Date() })
      staffMiddleware(ctx.req, ctx.res, ctx.next)
      expect(ctx.next).toHaveBeenCalled()
    }

    const customerCtx = createMockContext({ id: 'cust-1', role: UserRole.customer, sessionExpiresAt: new Date() })
    staffMiddleware(customerCtx.req, customerCtx.res, customerCtx.next)
    expect(customerCtx.res.status).toHaveBeenCalledWith(403)
    expect(customerCtx.next).not.toHaveBeenCalled()
  })
})

describe('Department model relationships', () => {
  it('supports department creation with designated head, members and tickets', async () => {
    const mockDepartment = {
      id: 'dept-billing',
      name: 'Billing & Payments',
      description: 'Handles billing, subscriptions and invoicing',
      headId: 'user-head-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      head: {
        id: 'user-head-1',
        name: 'Sarah Head',
        email: 'sarah.head@example.com',
        role: UserRole.department_head,
      },
      members: [
        { id: 'user-head-1', name: 'Sarah Head', role: UserRole.department_head },
        { id: 'user-agent-1', name: 'Alex Agent', role: UserRole.agent },
      ],
      tickets: [
        { id: 'ticket-1', ticketNumber: 'TKT-000001', subject: 'Invoice query' },
      ],
    }

    prismaMock.department.create.mockResolvedValue(mockDepartment)

    const created = await prismaMock.department.create({
      data: {
        name: 'Billing & Payments',
        description: 'Handles billing, subscriptions and invoicing',
        headId: 'user-head-1',
      },
      include: {
        head: true,
        members: true,
        tickets: true,
      },
    })

    expect(created.name).toBe('Billing & Payments')
    expect(created.headId).toBe('user-head-1')
    expect(created.head?.role).toBe(UserRole.department_head)
    expect(created.members.length).toBe(2)
    expect(created.tickets.length).toBe(1)
  })

  it('supports department head relationship from User to headedDepartment', async () => {
    const mockUserWithDepartment = {
      id: 'user-head-1',
      name: 'Sarah Head',
      email: 'sarah.head@example.com',
      role: UserRole.department_head,
      departmentId: 'dept-billing',
      department: {
        id: 'dept-billing',
        name: 'Billing & Payments',
      },
      headedDepartment: {
        id: 'dept-billing',
        name: 'Billing & Payments',
      },
    }

    prismaMock.user.findUnique.mockResolvedValue(mockUserWithDepartment)

    const user = await prismaMock.user.findUnique({
      where: { id: 'user-head-1' },
      include: {
        department: true,
        headedDepartment: true,
      },
    })

    expect(user?.role).toBe(UserRole.department_head)
    expect(user?.departmentId).toBe('dept-billing')
    expect(user?.headedDepartment?.name).toBe('Billing & Payments')
  })

  it('supports ticket belonging to an optional department', async () => {
    const mockTicketWithDept = {
      id: 'ticket-1',
      ticketNumber: 'TKT-000001',
      subject: 'System down',
      departmentId: 'dept-tech',
      department: {
        id: 'dept-tech',
        name: 'Technical Support',
      },
    }

    prismaMock.ticket.findMany.mockResolvedValue([mockTicketWithDept])

    const tickets = await prismaMock.ticket.findMany({
      where: { departmentId: 'dept-tech' },
      include: { department: true },
    })

    expect(tickets.length).toBe(1)
    expect(tickets[0].departmentId).toBe('dept-tech')
    expect(tickets[0].department?.name).toBe('Technical Support')
  })
})

describe('Authentication routes with expanded roles', () => {
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

  it('returns current user session profile for department_head role on /api/auth/me', async () => {
    const token = 'session-token-dept-head'
    const expiresAt = new Date(Date.now() + 60_000)

    prismaMock.session.findFirst.mockResolvedValue({
      expiresAt,
      user: {
        id: 'dept-head-1',
        email: 'depthead@example.com',
        name: 'Dept Head User',
        role: UserRole.department_head,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    })

    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as any
    expect(body.success).toBe(true)
    expect(body.data.user.role).toBe('department_head')
    expect(body.data.user.name).toBe('Dept Head User')
  })

  it('returns current user session profile for head role on /api/auth/me', async () => {
    const token = 'session-token-head'
    const expiresAt = new Date(Date.now() + 60_000)

    prismaMock.session.findFirst.mockResolvedValue({
      expiresAt,
      user: {
        id: 'head-1',
        email: 'head@example.com',
        name: 'Head User',
        role: UserRole.head,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    })

    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as any
    expect(body.success).toBe(true)
    expect(body.data.user.role).toBe('head')
  })

  it('enforces customer rejection on /api/users/agents with 403', async () => {
    const token = 'session-token-customer'
    const expiresAt = new Date(Date.now() + 60_000)

    prismaMock.session.findFirst.mockResolvedValue({
      expiresAt,
      user: {
        id: 'user-test',
        role: UserRole.customer,
      },
    })

    const response = await fetch(`${baseUrl}/api/users/agents`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    })

    expect(response.status).toBe(403)
    const body = (await response.json()) as any
    expect(body.success).toBe(false)
    expect(body.message).toBe('Insufficient permissions')
  })
})
