import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserRole, TicketPriority, TicketCategory, TicketStatus } from '@prisma/client'

const { prismaMock, argon2Mock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    session: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    ticket: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
  argon2Mock: {
    argon2id: 2,
    hash: vi.fn(),
    verify: vi.fn(),
  },
}))

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('argon2', () => ({ default: argon2Mock }))
vi.mock('../src/lib/ticketEvents.js', () => ({
  publishTicketEvent: vi.fn(),
  closeTicketEventConnections: vi.fn(),
  subscribeToTicketEvents: vi.fn(() => vi.fn()),
}))
vi.mock('../src/lib/ticketNotifications.js', () => ({
  sendTicketEmailNotification: vi.fn().mockResolvedValue(undefined),
}))

import app from '../src/app.js'
import { SESSION_COOKIE_NAME } from '../src/lib/session.js'

describe('Department Management, Scoped Workflows & Head Overview', () => {
  let server: Server
  let baseUrl: string

  beforeEach(async () => {
    vi.resetAllMocks()
    prismaMock.$transaction.mockImplementation(async (operation) =>
      typeof operation === 'function' ? operation(prismaMock) : Promise.all(operation),
    )
    prismaMock.ticket.groupBy.mockResolvedValue([])
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

  // -------------------------------------------------------------------------
  // 1. Department CRUD (Admin)
  // -------------------------------------------------------------------------
  describe('Department CRUD (Admin)', () => {
    it('creates a department with an active head and logs audit', async () => {
      const adminToken = 'admin-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'admin-1', role: UserRole.admin, isActive: true },
      })

      prismaMock.user.findFirst.mockResolvedValue({ id: 'user-head-1', isActive: true, role: UserRole.agent })
      prismaMock.department.create.mockResolvedValue({
        id: 'dept-1',
        name: 'Technical Support',
        description: 'Handles tech issues',
        headId: 'user-head-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        head: { id: 'user-head-1', name: 'Tech Lead', email: 'lead@example.com', role: UserRole.department_head, isActive: true },
        _count: { members: 1, tickets: 0 },
      })
      prismaMock.user.update.mockResolvedValue({ id: 'user-head-1', role: UserRole.department_head, departmentId: 'dept-1' })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-1' })

      const res = await fetch(`${baseUrl}/api/departments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Technical Support',
          description: 'Handles tech issues',
          headId: 'user-head-1',
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.department.name).toBe('Technical Support')
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'department.created' }),
        }),
      )
    })

    it('updates department details and audits the change', async () => {
      const adminToken = 'admin-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'admin-1', role: UserRole.admin, isActive: true },
      })

      prismaMock.department.findUnique.mockResolvedValue({
        id: 'dept-1',
        name: 'Technical Support',
        headId: 'user-head-1',
      })
      prismaMock.department.update.mockResolvedValue({
        id: 'dept-1',
        name: 'Tier 2 Support',
        description: 'Advanced tech issues',
        headId: 'user-head-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        head: { id: 'user-head-1', name: 'Tech Lead', email: 'lead@example.com', role: UserRole.department_head, isActive: true },
        _count: { members: 1, tickets: 0 },
      })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-2' })

      const res = await fetch(`${baseUrl}/api/departments/dept-1`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Tier 2 Support',
          description: 'Advanced tech issues',
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.department.name).toBe('Tier 2 Support')
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'department.updated' }),
        }),
      )
    })

    it('safely deletes a department by disassociating users and tickets', async () => {
      const adminToken = 'admin-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'admin-1', role: UserRole.admin, isActive: true },
      })

      prismaMock.department.findUnique.mockResolvedValue({ id: 'dept-1', name: 'Old Dept' })
      prismaMock.user.updateMany.mockResolvedValue({ count: 2 })
      prismaMock.ticket.updateMany.mockResolvedValue({ count: 5 })
      prismaMock.department.delete.mockResolvedValue({ id: 'dept-1', name: 'Old Dept' })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-3' })

      const res = await fetch(`${baseUrl}/api/departments/dept-1`, {
        method: 'DELETE',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
        where: { departmentId: 'dept-1' },
        data: { departmentId: null },
      })
      expect(prismaMock.ticket.updateMany).toHaveBeenCalledWith({
        where: { departmentId: 'dept-1' },
        data: { departmentId: null },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'department.deleted' }),
        }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // 2. Member Management (Admin)
  // -------------------------------------------------------------------------
  describe('Department Member Management (Admin)', () => {
    it('adds an active agent to a department and audits the action', async () => {
      const adminToken = 'admin-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'admin-1', role: UserRole.admin, isActive: true },
      })

      prismaMock.department.findUnique.mockResolvedValue({ id: 'dept-1', name: 'Billing' })
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'agent-1',
        name: 'Bob Agent',
        role: UserRole.agent,
        isActive: true,
        departmentId: null,
      })
      prismaMock.user.update.mockResolvedValue({ id: 'agent-1', departmentId: 'dept-1' })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-4' })

      const res = await fetch(`${baseUrl}/api/departments/dept-1/members`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
        body: JSON.stringify({ userId: 'agent-1' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { departmentId: 'dept-1' },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'department.member_added' }),
        }),
      )
    })

    it('removes an agent from a department and audits the action', async () => {
      const adminToken = 'admin-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'admin-1', role: UserRole.admin, isActive: true },
      })

      prismaMock.department.findUnique.mockResolvedValue({ id: 'dept-1', name: 'Billing', headId: null })
      prismaMock.user.findFirst.mockResolvedValue({ id: 'agent-1', name: 'Bob Agent' })
      prismaMock.user.update.mockResolvedValue({ id: 'agent-1', departmentId: null })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-5' })

      const res = await fetch(`${baseUrl}/api/departments/dept-1/members/agent-1`, {
        method: 'DELETE',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { departmentId: null },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'department.member_removed' }),
        }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // 3. Department Head Scoping & Cross-Department Protection
  // -------------------------------------------------------------------------
  describe('Department Head Scoping & Cross-Department Protection', () => {
    it('returns only the department head own department on GET /api/departments/my', async () => {
      const dhToken = 'dh-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'dh-user-1', role: UserRole.department_head, isActive: true },
      })
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'dh-user-1',
        departmentId: 'dept-tech',
        headedDepartment: { id: 'dept-tech' },
      })

      prismaMock.department.findUnique.mockResolvedValue({
        id: 'dept-tech',
        name: 'Technical Support',
        head: { id: 'dh-user-1', name: 'Tech Head', email: 'tech@head.com', role: UserRole.department_head, isActive: true },
        members: [{ id: 'ag-1', name: 'Agent 1', email: 'ag1@example.com', role: UserRole.agent, isActive: true }],
      })

      prismaMock.ticket.groupBy.mockResolvedValue([
        { status: 'open', _count: { status: 3 } },
        { status: 'in_progress', _count: { status: 2 } },
      ])

      const res = await fetch(`${baseUrl}/api/departments/my`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${dhToken}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.department.name).toBe('Technical Support')
      expect(body.data.workload.open).toBe(3)
      expect(body.data.workload.inProgress).toBe(2)
      expect(body.data.workload.total).toBe(5)
    })

    it('rejects a Department Head trying to view another department details with 403', async () => {
      const dhToken = 'dh-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'dh-user-1', role: UserRole.department_head, isActive: true },
      })
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'dh-user-1',
        departmentId: 'dept-tech',
        headedDepartment: { id: 'dept-tech' },
      })

      const res = await fetch(`${baseUrl}/api/departments/dept-billing`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${dhToken}` },
      })

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toContain('view other departments')
    })

    it('rejects a Department Head trying to view members of another department with 403', async () => {
      const dhToken = 'dh-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'dh-user-1', role: UserRole.department_head, isActive: true },
      })
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'dh-user-1',
        departmentId: 'dept-tech',
        headedDepartment: { id: 'dept-tech' },
      })

      const res = await fetch(`${baseUrl}/api/departments/dept-billing/members`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${dhToken}` },
      })

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toContain('members of other departments')
    })
  })

  // -------------------------------------------------------------------------
  // 4. Ticket Assignment & Department Enforcement
  // -------------------------------------------------------------------------
  describe('Ticket Assignment & Department Alignment', () => {
    it('allows a Department Head to assign a ticket in their department to an agent in their department', async () => {
      const dhToken = 'dh-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'dh-user-1', role: UserRole.department_head, isActive: true },
      })

      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        assigneeId: null,
        departmentId: 'dept-tech',
      })

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'dh-user-1',
        departmentId: 'dept-tech',
        headedDepartment: { id: 'dept-tech' },
      })

      prismaMock.user.findFirst.mockResolvedValue({
        id: 'agent-tech-1',
        role: UserRole.agent,
        isActive: true,
        departmentId: 'dept-tech',
      })

      prismaMock.ticket.update.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TKT-000001',
        subject: 'Tech Issue',
        description: 'Broken app',
        category: TicketCategory.technical,
        priority: TicketPriority.high,
        status: TicketStatus.open,
        departmentId: 'dept-tech',
        assignee: { id: 'agent-tech-1', name: 'Tech Agent' },
        customer: { id: 'cust-1', name: 'Customer One' },
      })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-6' })

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/assignee`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${dhToken}`,
        },
        body: JSON.stringify({ assigneeId: 'agent-tech-1' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.ticket.assignee.id).toBe('agent-tech-1')
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'ticket.assigned' }),
        }),
      )
    })

    it('rejects a Department Head assigning a ticket belonging to another department with 403', async () => {
      const dhToken = 'dh-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'dh-user-1', role: UserRole.department_head, isActive: true },
      })

      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-billing-1',
        assigneeId: null,
        departmentId: 'dept-billing',
      })

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'dh-user-1',
        departmentId: 'dept-tech',
        headedDepartment: { id: 'dept-tech' },
      })

      const res = await fetch(`${baseUrl}/api/tickets/ticket-billing-1/assignee`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${dhToken}`,
        },
        body: JSON.stringify({ assigneeId: 'agent-tech-1' }),
      })

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toContain('outside your department')
    })

    it('rejects assignment of a ticket to an agent outside the ticket department with 422', async () => {
      const adminToken = 'admin-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'admin-1', role: UserRole.admin, isActive: true },
      })

      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        assigneeId: null,
        departmentId: 'dept-tech',
      })

      // Assignee belongs to dept-billing, not dept-tech
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'agent-billing-1',
        role: UserRole.agent,
        isActive: true,
        departmentId: 'dept-billing',
      })

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/assignee`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
        body: JSON.stringify({ assigneeId: 'agent-billing-1' }),
      })

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toContain('department')
    })

    it('allows Admin to update ticket department and clears assignee if assignee is not in new department', async () => {
      const adminToken = 'admin-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'admin-1', role: UserRole.admin, isActive: true },
      })

      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        departmentId: 'dept-tech',
        assigneeId: 'agent-tech-1',
        assignee: { departmentId: 'dept-tech' },
      })
      prismaMock.department.findUnique.mockResolvedValue({ id: 'dept-billing', name: 'Billing' })

      prismaMock.ticket.update.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TKT-000001',
        subject: 'Invoice Query',
        description: 'Payment issue',
        category: TicketCategory.billing,
        priority: TicketPriority.normal,
        status: TicketStatus.open,
        departmentId: 'dept-billing',
        assignee: null,
      })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'audit-7' })

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/department`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
        },
        body: JSON.stringify({ departmentId: 'dept-billing' }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.ticket.departmentId).toBe('dept-billing')
      expect(prismaMock.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ departmentId: 'dept-billing', assigneeId: null }),
        }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // 5. Head Role Read-Only Operational Oversight
  // -------------------------------------------------------------------------
  describe('Head Role Read-Only Operational Oversight', () => {
    it('allows Head to access organization overview across all departments', async () => {
      const headToken = 'head-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'head-user-1', role: UserRole.head, isActive: true },
      })

      prismaMock.department.findMany.mockResolvedValue([
        {
          id: 'dept-1',
          name: 'Tech',
          head: { id: 'h-1', name: 'Lead 1', email: 'l1@example.com' },
          _count: { members: 3, tickets: 10 },
        },
        {
          id: 'dept-2',
          name: 'Billing',
          head: { id: 'h-2', name: 'Lead 2', email: 'l2@example.com' },
          _count: { members: 2, tickets: 5 },
        },
      ])

      prismaMock.ticket.groupBy
        .mockResolvedValueOnce([
          { departmentId: 'dept-1', status: 'open', _count: { status: 4 } },
          { departmentId: 'dept-1', status: 'in_progress', _count: { status: 6 } },
          { departmentId: 'dept-2', status: 'open', _count: { status: 2 } },
        ])
        .mockResolvedValueOnce([
          { status: 'open', _count: { status: 6 } },
          { status: 'in_progress', _count: { status: 6 } },
        ])

      prismaMock.user.findMany.mockResolvedValue([
        {
          id: 'ag-1',
          name: 'Agent 1',
          email: 'ag1@example.com',
          role: UserRole.agent,
          department: { id: 'dept-1', name: 'Tech' },
          _count: { assignedTickets: 4 },
        },
      ])

      const res = await fetch(`${baseUrl}/api/departments/overview`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${headToken}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.departments.length).toBe(2)
      expect(body.data.totalTickets).toBe(12)
      expect(body.data.agents.length).toBe(1)
    })

    it('rejects Head from modifying department details with 403', async () => {
      const headToken = 'head-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'head-user-1', role: UserRole.head, isActive: true },
      })

      const res = await fetch(`${baseUrl}/api/departments/dept-1`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${headToken}`,
        },
        body: JSON.stringify({ name: 'Unauthorized Change' }),
      })

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toBe('Insufficient permissions')
    })

    it('rejects Head from assigning tickets with 403', async () => {
      const headToken = 'head-session'
      prismaMock.session.findFirst.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'head-user-1', role: UserRole.head, isActive: true },
      })

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/assignee`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${headToken}`,
        },
        body: JSON.stringify({ assigneeId: 'agent-1' }),
      })

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toBe('Insufficient permissions')
    })
  })
})
