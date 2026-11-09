import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { once } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { TicketCategory, TicketPriority, TicketStatus, UserRole } from '@prisma/client'
import { UPLOAD_DIR } from '../src/lib/fileStorage.js'

const { prismaMock, publishTicketEventMock, sendTicketEmailNotificationMock } = vi.hoisted(() => {
  const prismaMock = {
    ticket: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    attachment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    comment: {
      create: vi.fn(),
    },
    session: {
      findFirst: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  }

  return {
    prismaMock,
    publishTicketEventMock: vi.fn(),
    sendTicketEmailNotificationMock: vi.fn(),
  }
})

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}))

vi.mock('../src/lib/ticketEvents.js', () => ({
  publishTicketEvent: publishTicketEventMock,
}))

vi.mock('../src/lib/ticketNotifications.js', () => ({
  sendTicketEmailNotification: sendTicketEmailNotificationMock,
}))

import app from '../src/app.js'

describe('Customer File Attachments & Authorization', () => {
  let server: Server
  let baseUrl: string
  const SESSION_COOKIE_NAME = 'mela_desk_session'

  const customerUser = {
    id: 'customer-1',
    role: UserRole.customer,
    name: 'Abebe Customer',
    email: 'abebe@example.com',
    isActive: true,
  }

  const otherCustomerUser = {
    id: 'customer-2',
    role: UserRole.customer,
    name: 'Sara Other',
    email: 'sara@example.com',
    isActive: true,
  }

  const agentUser = {
    id: 'agent-1',
    role: UserRole.agent,
    name: 'Tigist Agent',
    email: 'tigist@example.com',
    isActive: true,
  }

  const adminUser = {
    id: 'admin-1',
    role: UserRole.admin,
    name: 'Admin Boss',
    email: 'admin@example.com',
    isActive: true,
  }

  beforeEach(async () => {
    vi.resetAllMocks()

    prismaMock.$transaction.mockImplementation(async (operation) =>
      typeof operation === 'function' ? operation(prismaMock) : Promise.all(operation),
    )
    prismaMock.$executeRaw.mockResolvedValue(1)
    prismaMock.$queryRaw.mockResolvedValue([{ last_value: 10 }])

    server = app.listen(0)
    await once(server, 'listening')
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    if (server) {
      server.close()
      await once(server, 'close')
    }
  })

  function mockSession(user: any) {
    prismaMock.session.findFirst.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: user.id,
        role: user.role,
      },
    })
    prismaMock.user.findUnique.mockResolvedValue(user)
  }

  // --------------------------------------------------------------------------
  // 1. Customer Uploads During Ticket Creation
  // --------------------------------------------------------------------------
  describe('Customer Create Ticket with Attachments', () => {
    it('creates a ticket with attached files via multipart/form-data', async () => {
      mockSession(customerUser)
      prismaMock.user.findMany.mockResolvedValue([])

      const createdTicket = {
        id: 'ticket-created-1',
        ticketNumber: 'TKT-000011',
        customerId: customerUser.id,
        subject: 'Hardware failure',
        description: 'Laptop does not boot up.',
        category: TicketCategory.technical,
        priority: TicketPriority.high,
        status: TicketStatus.open,
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: [],
      }
      prismaMock.ticket.create.mockResolvedValue(createdTicket)
      prismaMock.attachment.create.mockResolvedValue({ id: 'att-created-1' })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'log-1' })
      prismaMock.attachment.findMany.mockResolvedValue([
        {
          id: 'att-created-1',
          originalFilename: 'diagnostic.txt',
          mimeType: 'text/plain',
          fileSize: 22,
          createdAt: new Date(),
          uploadedBy: { id: customerUser.id, name: customerUser.name },
        },
      ])

      const formData = new FormData()
      formData.append('subject', 'Hardware failure')
      formData.append('description', 'Laptop does not boot up.')
      formData.append('category', 'technical')
      formData.append('priority', 'high')
      formData.append(
        'files',
        new Blob(['Boot error log 0x80070002'], { type: 'text/plain' }),
        'diagnostic.txt',
      )

      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=cust-token`,
        },
        body: formData,
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.ticket.ticketNumber).toBe('TKT-000011')
      expect(prismaMock.ticket.create).toHaveBeenCalled()
      expect(prismaMock.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ticketId: 'ticket-created-1',
            originalFilename: 'diagnostic.txt',
            uploadedById: customerUser.id,
          }),
        }),
      )
    })

    it('rejects ticket creation when dangerous file format is attached', async () => {
      mockSession(customerUser)

      const formData = new FormData()
      formData.append('subject', 'Suspicious file')
      formData.append('description', 'Please run this executable.')
      formData.append('category', 'general')
      formData.append('priority', 'normal')
      formData.append(
        'files',
        new Blob(['malicious payload'], { type: 'application/x-msdos-program' }),
        'virus.exe',
      )

      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=cust-token`,
        },
        body: formData,
      })

      expect(res.status).toBe(422)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(data.message).toMatch(/blocked for security reasons|not supported/i)
      expect(prismaMock.ticket.create).not.toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // 2. Customer Uploads During Ticket Details / Replies
  // --------------------------------------------------------------------------
  describe('Customer Uploads to Existing Tickets', () => {
    it('allows a customer to upload attachments to their own open ticket', async () => {
      mockSession(customerUser)
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TKT-000001',
        customerId: customerUser.id,
        assigneeId: agentUser.id,
        departmentId: null,
        status: TicketStatus.open,
      })
      prismaMock.attachment.count.mockResolvedValue(0)
      prismaMock.attachment.create.mockResolvedValue({
        id: 'att-1',
        originalFilename: 'screenshot.txt',
        mimeType: 'text/plain',
        fileSize: 18,
        createdAt: new Date(),
        uploadedBy: { id: customerUser.id, name: customerUser.name },
      })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'log-1' })

      const formData = new FormData()
      formData.append(
        'files',
        new Blob(['Additional context'], { type: 'text/plain' }),
        'screenshot.txt',
      )

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments`, {
        method: 'POST',
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=cust-token`,
        },
        body: formData,
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.attachments.length).toBe(1)
      expect(prismaMock.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ticketId: 'ticket-1',
            uploadedById: customerUser.id,
          }),
        }),
      )
    })

    it('prevents customers from uploading attachments to another customer ticket', async () => {
      mockSession(otherCustomerUser) // Sara tries to upload to Abebe's ticket
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TKT-000001',
        customerId: customerUser.id, // belongs to Abebe (customer-1)
        assigneeId: agentUser.id,
        departmentId: null,
        status: TicketStatus.open,
      })

      const formData = new FormData()
      formData.append(
        'files',
        new Blob(['Unauthorized content'], { type: 'text/plain' }),
        'unauthorized.txt',
      )

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments`, {
        method: 'POST',
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=other-token`,
        },
        body: formData,
      })

      expect(res.status).toBe(404)
      const data = await res.json()
      expect(data.success).toBe(false)
      expect(prismaMock.attachment.create).not.toHaveBeenCalled()
    })

    it('prevents customers from uploading attachments to a closed ticket', async () => {
      mockSession(customerUser)
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TKT-000001',
        customerId: customerUser.id,
        assigneeId: agentUser.id,
        departmentId: null,
        status: 'closed', // closed
      })

      const formData = new FormData()
      formData.append(
        'files',
        new Blob(['Late content'], { type: 'text/plain' }),
        'late.txt',
      )

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments`, {
        method: 'POST',
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=cust-token`,
        },
        body: formData,
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.message).toMatch(/closed ticket/i)
      expect(prismaMock.attachment.create).not.toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // 3. Customer Download & Access Scoping
  // --------------------------------------------------------------------------
  describe('Customer Attachment Access & Download Scoping', () => {
    it('allows a customer to download attachments on their own ticket', async () => {
      mockSession(customerUser)
      const testFilePath = path.join(UPLOAD_DIR, 'test-cust-download.txt')
      fs.writeFileSync(testFilePath, 'valid download content')

      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        customerId: customerUser.id,
        assigneeId: agentUser.id,
        departmentId: null,
      })
      prismaMock.attachment.findFirst.mockResolvedValue({
        id: 'att-1',
        ticketId: 'ticket-1',
        originalFilename: 'test.txt',
        mimeType: 'text/plain',
        fileSize: 22,
        storagePath: testFilePath,
      })

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments/att-1`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=cust-token` },
      })

      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toBe('valid download content')

      try {
        if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath)
      } catch {}
    })

    it('blocks a customer from downloading attachments on another customer ticket', async () => {
      mockSession(otherCustomerUser)
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        customerId: customerUser.id, // belongs to Abebe
        assigneeId: agentUser.id,
        departmentId: null,
      })

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments/att-1`, {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=other-token` },
      })

      expect(res.status).toBe(404)
    })
  })

  // --------------------------------------------------------------------------
  // 4. Staff & Admin Permissions Retained
  // --------------------------------------------------------------------------
  describe('Staff & Admin Retained Functionality', () => {
    it('allows assigned agent to upload attachments to a ticket', async () => {
      mockSession(agentUser)
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TKT-000001',
        customerId: customerUser.id,
        assigneeId: agentUser.id,
        departmentId: null,
        status: TicketStatus.open,
      })
      prismaMock.attachment.count.mockResolvedValue(0)
      prismaMock.attachment.create.mockResolvedValue({
        id: 'att-agent-1',
        originalFilename: 'resolution_guide.txt',
        mimeType: 'text/plain',
        fileSize: 30,
        createdAt: new Date(),
        uploadedBy: { id: agentUser.id, name: agentUser.name },
      })
      prismaMock.auditLog.create.mockResolvedValue({ id: 'log-1' })

      const formData = new FormData()
      formData.append(
        'files',
        new Blob(['Resolution steps for customer'], { type: 'text/plain' }),
        'resolution_guide.txt',
      )

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments`, {
        method: 'POST',
        headers: { Cookie: `${SESSION_COOKIE_NAME}=agent-token` },
        body: formData,
      })

      expect(res.status).toBe(201)
      expect(prismaMock.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            uploadedById: agentUser.id,
          }),
        }),
      )
    })

    it('allows admin to delete any attachment even if uploaded by customer', async () => {
      mockSession(adminUser)
      const testFilePath = path.join(UPLOAD_DIR, 'test-admin-delete.txt')
      fs.writeFileSync(testFilePath, 'dummy file')

      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        customerId: customerUser.id,
        status: 'open',
      })
      prismaMock.attachment.findFirst.mockResolvedValue({
        id: 'att-cust-1',
        ticketId: 'ticket-1',
        originalFilename: 'receipt.txt',
        storagePath: testFilePath,
        uploadedById: customerUser.id,
      })
      prismaMock.attachment.delete.mockResolvedValue({ id: 'att-cust-1' })

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments/att-cust-1`, {
        method: 'DELETE',
        headers: { Cookie: `${SESSION_COOKIE_NAME}=admin-token` },
      })

      expect(res.status).toBe(200)
      expect(prismaMock.attachment.delete).toHaveBeenCalledWith({ where: { id: 'att-cust-1' } })
    })
  })
})
