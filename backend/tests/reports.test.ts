import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { once } from 'node:events'
import { TicketCategory, TicketPriority, TicketStatus, UserRole } from '@prisma/client'
import { calculateDateRange, calculateResolutionStats } from '../src/routes/reports.js'

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    ticket: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    department: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    session: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  }

  return { prismaMock }
})

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}))

import app from '../src/app.js'

describe('Reports & Analytics API (Phase 5)', () => {
  let server: Server
  let baseUrl: string

  const adminUser = {
    id: 'user-admin-1',
    role: UserRole.admin,
    name: 'Admin User',
    departmentId: null,
  }

  const headUser = {
    id: 'user-head-1',
    role: UserRole.head,
    name: 'Executive Head',
    departmentId: null,
  }

  const deptHeadUser = {
    id: 'user-dept-head-1',
    role: UserRole.department_head,
    name: 'Dept Head User',
    departmentId: 'dept-support-1',
  }

  const agentUser = {
    id: 'user-agent-1',
    role: UserRole.agent,
    name: 'Support Agent User',
    departmentId: 'dept-support-1',
  }

  const customerUser = {
    id: 'user-cust-1',
    role: UserRole.customer,
    name: 'Customer User',
    departmentId: null,
  }

  const sampleTickets = [
    {
      id: 'ticket-1',
      ticketNumber: 'TICK-1001',
      subject: 'Login failed',
      category: TicketCategory.account,
      priority: TicketPriority.high,
      status: TicketStatus.open,
      departmentId: 'dept-support-1',
      createdAt: new Date('2026-11-01T10:00:00Z'),
      updatedAt: new Date('2026-11-01T10:00:00Z'),
      department: { id: 'dept-support-1', name: 'Support' },
      customer: { id: 'user-cust-1', name: 'Customer One', email: 'cust1@example.com' },
      assignee: null,
    },
    {
      id: 'ticket-2',
      ticketNumber: 'TICK-1002',
      subject: 'Payment double charge',
      category: TicketCategory.billing,
      priority: TicketPriority.urgent,
      status: TicketStatus.resolved,
      departmentId: 'dept-support-1',
      createdAt: new Date('2026-11-01T10:00:00Z'),
      updatedAt: new Date('2026-11-01T14:00:00Z'), // 4 hours resolution
      department: { id: 'dept-support-1', name: 'Support' },
      customer: { id: 'user-cust-1', name: 'Customer One', email: 'cust1@example.com' },
      assignee: { id: agentUser.id, name: agentUser.name, email: 'agent@example.com' },
    },
    {
      id: 'ticket-3',
      ticketNumber: 'TICK-1003',
      subject: 'Feature request',
      category: TicketCategory.general,
      priority: TicketPriority.low,
      status: TicketStatus.closed,
      departmentId: 'dept-billing-1',
      createdAt: new Date('2026-11-02T10:00:00Z'),
      updatedAt: new Date('2026-11-02T16:00:00Z'), // 6 hours resolution
      department: { id: 'dept-billing-1', name: 'Billing' },
      customer: null,
      guestName: 'Guest John',
      guestEmail: 'john@example.com',
      assignee: null,
    },
  ]

  beforeEach(async () => {
    vi.resetAllMocks()

    server = app.listen(0)
    await once(server, 'listening')
    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  afterEach(async () => {
    if (server) {
      server.close()
      await once(server, 'close')
    }
  })

  function mockSession(user: any) {
    prismaMock.session.findFirst.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60000),
      user: {
        id: user.id,
        role: user.role,
      },
    })
    prismaMock.user.findUnique.mockResolvedValue(user)
  }

  // -------------------------------------------------------------------------
  // 1. Pure Calculation Unit Tests
  // -------------------------------------------------------------------------
  describe('Resolution & Date Calculation Helpers', () => {
    it('calculates resolution rate and average resolution time accurately', () => {
      const stats = calculateResolutionStats(sampleTickets)
      expect(stats.total).toBe(3)
      expect(stats.open).toBe(1)
      expect(stats.resolved).toBe(1)
      expect(stats.closed).toBe(1)
      // 2 resolved/closed out of 3 total = 66.7%
      expect(stats.resolutionRate).toBe(66.7)
      // Ticket 2: 4 hours, Ticket 3: 6 hours. Average = (4 + 6) / 2 = 5.0 hours
      expect(stats.averageResolutionHours).toBe(5.0)
      expect(stats.averageResolutionFormatted).toBe('5h 0m')
    })

    it('handles zero tickets safely without division by zero', () => {
      const stats = calculateResolutionStats([])
      expect(stats.total).toBe(0)
      expect(stats.resolutionRate).toBe(0)
      expect(stats.averageResolutionHours).toBe(0)
      expect(stats.averageResolutionFormatted).toBe('0h 0m')
    })

    it('calculates date ranges for different presets', () => {
      const today = calculateDateRange('today')
      expect(today.preset).toBe('today')
      expect(today.from.getTime()).toBeLessThanOrEqual(today.to.getTime())

      const last7 = calculateDateRange('last_7_days')
      expect(last7.preset).toBe('last_7_days')
      const diffDays7 = Math.round((last7.to.getTime() - last7.from.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays7).toBe(7)

      const custom = calculateDateRange('custom', '2026-11-01', '2026-11-05')
      expect(custom.preset).toBe('custom')
      expect(custom.from.toISOString().slice(0, 10)).toBe('2026-11-01')
      expect(custom.to.toISOString().slice(0, 10)).toBe('2026-11-05')
    })
  })

  // -------------------------------------------------------------------------
  // 2. Authentication & Role Permissions
  // -------------------------------------------------------------------------
  describe('Authentication & Role Access Control', () => {
    it('returns 401 Unauthorized for unauthenticated requests', async () => {
      const res = await fetch(`${baseUrl}/api/reports/overview`)
      expect(res.status).toBe(401)
    })

    it('returns 403 Forbidden for customer role', async () => {
      mockSession(customerUser)
      const res = await fetch(`${baseUrl}/api/reports/overview`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(403)
    })

    it('allows Admin and Head full access to organization-wide overview', async () => {
      mockSession(adminUser)
      prismaMock.ticket.findMany.mockResolvedValue(sampleTickets)

      const res = await fetch(`${baseUrl}/api/reports/overview?preset=last_30_days`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.summary.total).toBe(3)
    })

    it('restricts Department Head to their own department when querying another department', async () => {
      mockSession(deptHeadUser)

      // Dept head belongs to 'dept-support-1', trying to view 'dept-billing-1'
      const res = await fetch(`${baseUrl}/api/reports/overview?departmentId=dept-billing-1`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.message).toContain('Forbidden: You can only view reports for your own department')
    })

    it('scopes Department Head query automatically to their own department', async () => {
      mockSession(deptHeadUser)
      prismaMock.ticket.findMany.mockResolvedValue([sampleTickets[0], sampleTickets[1]])

      const res = await fetch(`${baseUrl}/api/reports/overview`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(200)

      expect(prismaMock.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: 'dept-support-1',
          }),
        }),
      )
    })

    it('restricts Agent from accessing reports of other departments', async () => {
      mockSession(agentUser)

      const res = await fetch(`${baseUrl}/api/reports/overview?departmentId=dept-other-99`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.success).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 3. Ticket Reports Table & Search
  // -------------------------------------------------------------------------
  describe('Ticket Reports Endpoint (/api/reports/tickets)', () => {
    it('returns paginated tickets with resolution metrics and search support', async () => {
      mockSession(adminUser)
      prismaMock.$transaction.mockResolvedValue([sampleTickets, sampleTickets.length])

      const res = await fetch(`${baseUrl}/api/reports/tickets?page=1&pageSize=10&search=charge`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.tickets.length).toBe(3)
      expect(data.data.pagination.total).toBe(3)
      // Check resolution hours calculation
      const resolvedTicket = data.data.tickets.find((t: any) => t.id === 'ticket-2')
      expect(resolvedTicket.resolutionHours).toBe(4)
      const openTicket = data.data.tickets.find((t: any) => t.id === 'ticket-1')
      expect(openTicket.resolutionHours).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // 4. Department Reports Endpoint (/api/reports/departments)
  // -------------------------------------------------------------------------
  describe('Department Reports Endpoint (/api/reports/departments)', () => {
    it('returns aggregated metrics per department for Admin', async () => {
      mockSession(adminUser)
      prismaMock.department.findMany.mockResolvedValue([
        {
          id: 'dept-support-1',
          name: 'Support',
          description: 'Tech support',
          head: { id: deptHeadUser.id, name: deptHeadUser.name, email: 'head@example.com' },
          _count: { members: 5 },
        },
      ])
      prismaMock.ticket.findMany.mockResolvedValue([sampleTickets[0], sampleTickets[1]])

      const res = await fetch(`${baseUrl}/api/reports/departments`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.departments.length).toBe(1)
      expect(data.data.departments[0].name).toBe('Support')
      expect(data.data.departments[0].total).toBe(2)
      expect(data.data.departments[0].resolved).toBe(1)
      expect(data.data.departments[0].resolutionRate).toBe(50)
    })

    it('scopes Department Head only to their department in department reports', async () => {
      mockSession(deptHeadUser)
      prismaMock.department.findMany.mockResolvedValue([
        {
          id: 'dept-support-1',
          name: 'Support',
          description: 'Tech support',
          head: { id: deptHeadUser.id, name: deptHeadUser.name, email: 'head@example.com' },
          _count: { members: 5 },
        },
      ])
      prismaMock.ticket.findMany.mockResolvedValue([])

      const res = await fetch(`${baseUrl}/api/reports/departments`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(200)
      expect(prismaMock.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dept-support-1' },
        }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // 5. Agent Performance Reports Endpoint (/api/reports/agents)
  // -------------------------------------------------------------------------
  describe('Agent Performance Reports Endpoint (/api/reports/agents)', () => {
    it('returns performance stats per agent', async () => {
      mockSession(adminUser)
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: agentUser.id,
          name: agentUser.name,
          email: 'agent@example.com',
          role: UserRole.agent,
          department: { id: 'dept-support-1', name: 'Support' },
        },
      ])
      prismaMock.ticket.findMany.mockResolvedValue([sampleTickets[1]])

      const res = await fetch(`${baseUrl}/api/reports/agents`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.agents.length).toBe(1)
      expect(data.data.agents[0].name).toBe(agentUser.name)
      expect(data.data.agents[0].totalAssigned).toBe(1)
      expect(data.data.agents[0].resolved).toBe(1)
      expect(data.data.agents[0].resolutionRate).toBe(100)
      expect(data.data.agents[0].averageResolutionHours).toBe(4)
    })
  })

  // -------------------------------------------------------------------------
  // 6. Excel (.xlsx) Export
  // -------------------------------------------------------------------------
  describe('Excel Export Endpoint (/api/reports/export)', () => {
    it('generates and streams valid Excel (.xlsx) for ticket reports', async () => {
      mockSession(adminUser)
      prismaMock.ticket.findMany.mockResolvedValue(sampleTickets)

      const res = await fetch(`${baseUrl}/api/reports/export?type=tickets`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      expect(res.headers.get('content-disposition')).toContain('attachment; filename="meladesk-tickets-report-')

      const buffer = await res.arrayBuffer()
      // Excel files start with PK (Zip format: PK\x03\x04 = 0x50, 0x4B, 0x03, 0x04)
      const bytes = new Uint8Array(buffer)
      expect(bytes[0]).toBe(0x50) // 'P'
      expect(bytes[1]).toBe(0x4b) // 'K'
      expect(bytes.length).toBeGreaterThan(1000)
    })

    it('generates valid Excel (.xlsx) for department reports', async () => {
      mockSession(adminUser)
      prismaMock.department.findMany.mockResolvedValue([
        {
          id: 'dept-support-1',
          name: 'Support',
          head: { name: 'Support Head', email: 'head@example.com' },
          _count: { members: 3 },
        },
      ])
      prismaMock.ticket.findMany.mockResolvedValue(sampleTickets)

      const res = await fetch(`${baseUrl}/api/reports/export?type=departments`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      const buffer = await res.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      expect(bytes[0]).toBe(0x50)
      expect(bytes[1]).toBe(0x4b)
    })

    it('generates valid Excel (.xlsx) for agent performance reports', async () => {
      mockSession(adminUser)
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: agentUser.id,
          name: agentUser.name,
          email: 'agent@example.com',
          role: UserRole.agent,
          department: { name: 'Support' },
        },
      ])
      prismaMock.ticket.findMany.mockResolvedValue([sampleTickets[1]])

      const res = await fetch(`${baseUrl}/api/reports/export?type=agents`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      const buffer = await res.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      expect(bytes[0]).toBe(0x50)
      expect(bytes[1]).toBe(0x4b)
    })

    it('generates valid Excel (.xlsx) for overview summary', async () => {
      mockSession(adminUser)
      prismaMock.ticket.findMany.mockResolvedValue(sampleTickets)

      const res = await fetch(`${baseUrl}/api/reports/export?type=overview`, {
        headers: { Cookie: 'mela_desk_session=valid-token' },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      const buffer = await res.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      expect(bytes[0]).toBe(0x50)
      expect(bytes[1]).toBe(0x4b)
    })
  })
})
