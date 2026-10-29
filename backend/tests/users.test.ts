import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock, argon2Mock } = vi.hoisted(() => ({
  prismaMock: {
    session: {
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
  argon2Mock: {
    argon2id: 2,
    hash: vi.fn(),
  },
}))

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }))
vi.mock('argon2', () => ({ default: argon2Mock }))

import app from '../src/app.js'
import { SESSION_COOKIE_NAME } from '../src/lib/session.js'

const admin = { id: 'admin-1', role: 'admin' }
const agent = { id: 'agent-1', role: 'agent' }

describe('user directory routes', () => {
  let server: Server
  let baseUrl: string

  beforeEach(async () => {
    vi.resetAllMocks()
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

  it('requires an authenticated admin to create an agent', async () => {
    const response = await fetch(`${baseUrl}/api/users/agents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'New Agent',
        email: 'agent@example.com',
        password: 'a-secure-agent-password',
      }),
    })

    expect(response.status).toBe(401)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(argon2Mock.hash).not.toHaveBeenCalled()
  })

  it('prevents agents from creating agent accounts', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })

    const response = await fetch(`${baseUrl}/api/users/agents`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=agent-token`,
      },
      body: JSON.stringify({
        name: 'New Agent',
        email: 'agent@example.com',
        password: 'a-secure-agent-password',
      }),
    })

    expect(response.status).toBe(403)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(argon2Mock.hash).not.toHaveBeenCalled()
  })

  it('validates agent input before hashing or creating an account', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })

    const response = await fetch(`${baseUrl}/api/users/agents`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({
        name: ' ',
        email: 'invalid-email',
        password: 'short',
      }),
    })

    expect(response.status).toBe(400)
    expect(argon2Mock.hash).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('creates an agent with a password hash and records an audit event', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    argon2Mock.hash.mockResolvedValue('argon2id-agent-hash')
    const createdAgent = {
      id: 'agent-2',
      name: 'New Agent',
      email: 'new.agent@example.com',
      role: 'agent',
      isActive: true,
    }
    const transaction = {
      user: { create: vi.fn().mockResolvedValue(createdAgent) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/users/agents`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({
        name: ' New Agent ',
        email: 'NEW.AGENT@example.com',
        password: 'a-secure-agent-password',
      }),
    })

    expect(response.status).toBe(201)
    expect(argon2Mock.hash).toHaveBeenCalledWith('a-secure-agent-password', {
      type: argon2Mock.argon2id,
    })
    expect(transaction.user.create).toHaveBeenCalledWith({
      data: {
        name: 'New Agent',
        email: 'new.agent@example.com',
        passwordHash: 'argon2id-agent-hash',
        role: 'agent',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    })
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: admin.id,
        action: 'user.agent_created',
        details: JSON.stringify({ agentId: createdAgent.id }),
      },
    })
    const payload = await response.json()
    expect(payload).toEqual({
      success: true,
      data: { agent: createdAgent },
    })
    expect(JSON.stringify(payload)).not.toContain('argon2id-agent-hash')
  })

  it('requires an admin to reset an agent password', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })

    const response = await fetch(`${baseUrl}/api/users/agents/agent-1/password`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=agent-token`,
      },
      body: JSON.stringify({ password: 'a-new-secure-agent-password' }),
    })

    expect(response.status).toBe(403)
    expect(argon2Mock.hash).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('rejects short passwords before hashing', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })

    const response = await fetch(`${baseUrl}/api/users/agents/agent-1/password`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ password: 'short' }),
    })

    expect(response.status).toBe(400)
    expect(argon2Mock.hash).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('resets an agent password, revokes sessions, and writes an audit event', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    argon2Mock.hash.mockResolvedValue('new-agent-argon2id-hash')
    const transaction = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'agent-1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/users/agents/agent-1/password`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ password: 'a-new-secure-agent-password' }),
    })

    expect(response.status).toBe(200)
    expect(argon2Mock.hash).toHaveBeenCalledWith('a-new-secure-agent-password', {
      type: argon2Mock.argon2id,
    })
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: { passwordHash: 'new-agent-argon2id-hash' },
    })
    expect(transaction.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'agent-1' },
    })
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: admin.id,
        action: 'user.agent_password_reset',
        details: JSON.stringify({ agentId: 'agent-1' }),
      },
    })
    expect(await response.json()).toEqual({
      success: true,
      message: 'Agent password reset; existing sessions were revoked',
    })
  })

  it('returns 404 when asked to reset a non-agent account', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    argon2Mock.hash.mockResolvedValue('new-agent-argon2id-hash')
    const transaction = {
      user: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
      session: { deleteMany: vi.fn() },
      auditLog: { create: vi.fn() },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/users/agents/not-agent/password`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ password: 'a-new-secure-agent-password' }),
    })

    expect(response.status).toBe(404)
    expect(transaction.user.update).not.toHaveBeenCalled()
    expect(transaction.session.deleteMany).not.toHaveBeenCalled()
    expect(transaction.auditLog.create).not.toHaveBeenCalled()
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

  it('returns agents including inactive agents when requested', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    const agents = [
      { id: 'agent-1', name: 'Agent One', email: 'one@example.com', role: 'agent', isActive: true },
      { id: 'agent-2', name: 'Agent Two', email: 'two@example.com', role: 'agent', isActive: false },
    ]
    prismaMock.$transaction.mockResolvedValue([agents, 2])

    const response = await fetch(`${baseUrl}/api/users/agents?includeInactive=true`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=admin-token` },
    })

    expect(response.status).toBe(200)
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: 'agent' },
      select: { id: true, name: true, email: true, role: true, isActive: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 20,
    })
    expect(prismaMock.user.count).toHaveBeenCalledWith({
      where: { role: 'agent' },
    })
    expect(await response.json()).toEqual({
      success: true,
      data: {
        agents,
        pagination: {
          page: 1,
          pageSize: 20,
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

  it('requires an authenticated session to list customers', async () => {
    const response = await fetch(`${baseUrl}/api/users/customers`)

    expect(response.status).toBe(401)
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it('allows only admins to access the customer directory', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })

    const response = await fetch(`${baseUrl}/api/users/customers`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=agent-token` },
    })

    expect(response.status).toBe(403)
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it('returns a paginated customer list with ticket count and safe fields', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    const customers = [
      {
        id: 'cust-1',
        name: 'Customer One',
        email: 'cust1@example.com',
        role: 'customer',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        _count: { tickets: 3 },
      },
    ]
    prismaMock.$transaction.mockResolvedValue([customers, 1])

    const response = await fetch(`${baseUrl}/api/users/customers?page=1&pageSize=10`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=admin-token` },
    })

    expect(response.status).toBe(200)
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: { role: 'customer' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { tickets: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 10,
    })
    expect(prismaMock.user.count).toHaveBeenCalledWith({
      where: { role: 'customer' },
    })
    expect(await response.json()).toEqual({
      success: true,
      data: {
        customers,
        pagination: {
          page: 1,
          pageSize: 10,
          total: 1,
          totalPages: 1,
        },
      },
    })
  })

  it('rejects invalid customer pagination', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })

    const response = await fetch(`${baseUrl}/api/users/customers?page=0`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=admin-token` },
    })

    expect(response.status).toBe(400)
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it('requires an admin to update account status', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: agent })

    const response = await fetch(`${baseUrl}/api/users/user-2/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=agent-token`,
      },
      body: JSON.stringify({ isActive: false }),
    })

    expect(response.status).toBe(403)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('rejects invalid account status without updating the user', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })

    const response = await fetch(`${baseUrl}/api/users/user-2/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ isActive: 'invalid' }),
    })

    expect(response.status).toBe(400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('updates account status, revokes sessions on deactivation, and writes an audit event', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    const updatedUser = {
      id: 'agent-1',
      role: 'agent',
      isActive: false,
    }
    const transaction = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'agent-1',
          role: 'agent',
          isActive: true,
        }),
        update: vi.fn().mockResolvedValue(updatedUser),
        count: vi.fn(),
      },
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    prismaMock.$transaction.mockImplementation(async (callback) => callback(transaction))

    const response = await fetch(`${baseUrl}/api/users/agent-1/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ isActive: false }),
    })

    expect(response.status).toBe(200)
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: { isActive: false },
      select: { id: true, role: true, isActive: true },
    })
    expect(transaction.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'agent-1' },
    })
    expect(transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: admin.id,
        action: 'user.deactivated',
        details: JSON.stringify({
          targetUserId: 'agent-1',
          role: 'agent',
        }),
      },
    })
    expect(await response.json()).toEqual({
      success: true,
      data: { user: updatedUser },
    })
  })

  it('prevents self-deactivation by the authenticated admin', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })

    const response = await fetch(`${baseUrl}/api/users/admin-1/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ isActive: false }),
    })

    expect(response.status).toBe(409)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('prevents deactivation of the last active admin', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: { id: 'admin-2', role: 'admin' } })
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      isActive: true,
    })
    prismaMock.user.count.mockResolvedValue(1)

    const response = await fetch(`${baseUrl}/api/users/admin-1/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ isActive: false }),
    })

    expect(response.status).toBe(409)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.session.deleteMany).not.toHaveBeenCalled()
  })

  it('returns 404 for a missing account', async () => {
    prismaMock.session.findFirst.mockResolvedValue({ user: admin })
    prismaMock.user.findFirst.mockResolvedValue(null)

    const response = await fetch(`${baseUrl}/api/users/missing-user/status`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=admin-token`,
      },
      body: JSON.stringify({ isActive: false }),
    })

    expect(response.status).toBe(404)
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})
