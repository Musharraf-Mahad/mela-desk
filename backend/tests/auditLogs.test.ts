import { once } from 'node:events'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    session: { findFirst: vi.fn() },
    auditLog: {
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

describe('audit log routes', () => {
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

  it('requires authentication to access audit logs', async () => {
    const response = await fetch(`${baseUrl}/api/audit-logs`)

    expect(response.status).toBe(401)
    expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled()
  })

  it('restricts audit logs to admins', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })

    const response = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=agent-token` },
    })

    expect(response.status).toBe(403)
    expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled()
  })

  it('returns filtered, paginated logs with safe related fields', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    const logs = [
      {
        id: 'audit-1',
        ticketId: 'ticket-1',
        userId: admin.id,
        action: 'ticket.status_changed',
        details: '{"from":"open","to":"resolved"}',
        createdAt: '2026-10-27T12:00:00.000Z',
        user: { id: admin.id, name: 'Admin' },
        ticket: { id: 'ticket-1', subject: 'Need help' },
      },
    ]
    prismaMock.$transaction.mockResolvedValue([logs, 1])

    const response = await fetch(
      `${baseUrl}/api/audit-logs?ticketId=ticket-1&userId=admin-1&action=ticket.status_changed&page=2&pageSize=10`,
      { headers: { cookie: `${SESSION_COOKIE_NAME}=admin-token` } },
    )

    expect(response.status).toBe(200)
    const where = {
      ticketId: 'ticket-1',
      userId: 'admin-1',
      action: 'ticket.status_changed',
    }
    expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
        select: expect.objectContaining({
          id: true,
          details: true,
          user: { select: { id: true, name: true } },
          ticket: { select: { id: true, subject: true } },
        }),
      }),
    )
    expect(prismaMock.auditLog.count).toHaveBeenCalledWith({ where })
    expect(await response.json()).toEqual({
      success: true,
      data: {
        auditLogs: logs,
        pagination: {
          page: 2,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      },
    })
  })

  it('rejects invalid filters before querying audit data', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })

    const response = await fetch(`${baseUrl}/api/audit-logs?page=0&pageSize=101`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=admin-token` },
    })

    expect(response.status).toBe(400)
    expect(prismaMock.auditLog.findMany).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('reports database failures instead of returning a success response', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    prismaMock.$transaction.mockRejectedValue(new Error('database unavailable'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=admin-token` },
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      message: 'Unable to list audit logs',
    })
    expect(errorSpy).toHaveBeenCalledWith(
      'Audit log lookup failed:',
      expect.any(Error),
    )
  })
})
