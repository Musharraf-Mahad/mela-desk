import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { once } from 'node:events'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { TicketCategory, TicketPriority, TicketStatus, UserRole } from '@prisma/client'

const { prismaMock, publishTicketEventMock, sendDirectEmailMock } = vi.hoisted(() => {
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
      createMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    session: {
      findFirst: vi.fn(),
    },
    department: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
  }

  return {
    prismaMock,
    publishTicketEventMock: vi.fn(),
    sendDirectEmailMock: vi.fn(),
  }
})

vi.mock('../src/lib/prisma.js', () => ({
  prisma: prismaMock,
}))

vi.mock('../src/lib/ticketEvents.js', () => ({
  publishTicketEvent: publishTicketEventMock,
}))

vi.mock('../src/lib/ticketNotifications.js', () => ({
  sendDirectEmail: sendDirectEmailMock,
  sendTicketEmailNotification: vi.fn(),
}))

import app from '../src/app.js'
import { UPLOAD_DIR } from '../src/lib/fileStorage.js'

const SESSION_COOKIE_NAME = 'mela_desk_session'

describe('Phase 3: Public Ticket Portal & File Attachments', () => {
  let server: Server
  let baseUrl: string

  beforeEach(async () => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (operation) =>
      typeof operation === 'function' ? operation(prismaMock) : Promise.all(operation)
    )
    prismaMock.$executeRaw.mockResolvedValue(1)
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ counterValue: 0 }])
      .mockResolvedValueOnce([{ max_seq: 0 }])

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

  // ---------------------------------------------------------------------------
  // 1. Public Ticket Submission
  // ---------------------------------------------------------------------------
  describe('Public Ticket Submission', () => {
    it('creates a guest ticket with atomic ticket number and tracking token', async () => {
      prismaMock.ticket.create.mockResolvedValue({
        id: 'ticket-guest-1',
        ticketNumber: 'TKT-000001',
        subject: 'Cannot login to my account',
        category: TicketCategory.account,
        priority: TicketPriority.normal,
        status: TicketStatus.open,
        createdAt: new Date(),
        attachments: [],
      })
      prismaMock.user.findMany.mockResolvedValue([])

      const res = await fetch(`${baseUrl}/api/public/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: 'Jane Doe',
          guestEmail: 'jane@example.com',
          subject: 'Cannot login to my account',
          description: 'Forgot password and reset link is not arriving.',
          category: 'account',
        }),
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.ticketNumber).toBe('TKT-000001')
      expect(typeof body.data.trackingToken).toBe('string')
      expect(body.data.trackingToken.length).toBeGreaterThan(20)

      // Verifies ticket was stored with hashed token, not plain token
      expect(prismaMock.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guestName: 'Jane Doe',
            guestEmail: 'jane@example.com',
            customerId: null,
            priority: TicketPriority.normal,
            trackingTokenHash: expect.any(String),
          }),
        })
      )

      // Verifies audit log created without tracking token in plaintext
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId: 'ticket-guest-1',
          action: 'ticket.guest_created',
        }),
      })

      // Verifies email notification sent with ticket number & tracking token
      expect(sendDirectEmailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'jane@example.com',
          subject: expect.stringContaining('TKT-000001'),
        })
      )
    })

    it('validates required public submission fields and rejects invalid emails', async () => {
      const res = await fetch(`${baseUrl}/api/public/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: '',
          guestEmail: 'invalid-email',
          subject: '',
          description: '',
          category: 'invalid_cat',
        }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(prismaMock.ticket.create).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Public Ticket Tracking
  // ---------------------------------------------------------------------------
  describe('Public Ticket Tracking', () => {
    const rawToken = 'sample-secret-tracking-token-12345'
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    it('returns safe ticket details and public comments when provided valid tracking credentials', async () => {
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TKT-000001',
        subject: 'Cannot login to my account',
        description: 'Detailed description',
        category: TicketCategory.account,
        priority: TicketPriority.normal,
        status: TicketStatus.in_progress,
        guestName: 'Jane Doe',
        guestEmail: 'jane@example.com',
        createdAt: new Date('2026-11-01T10:00:00Z'),
        updatedAt: new Date('2026-11-01T12:00:00Z'),
        comments: [
          {
            id: 'comment-pub-1',
            body: 'We are investigating your reset link.',
            createdAt: new Date('2026-11-01T11:00:00Z'),
            author: { id: 'agent-1', name: 'Agent Smith', role: UserRole.agent },
          },
        ],
        attachments: [
          {
            id: 'att-1',
            originalFilename: 'error_screenshot.png',
            mimeType: 'image/png',
            fileSize: 12040,
            createdAt: new Date(),
          },
        ],
      })

      const res = await fetch(`${baseUrl}/api/public/tickets/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketNumber: 'TKT-000001',
          trackingToken: rawToken,
        }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.ticketNumber).toBe('TKT-000001')
      expect(body.data.status).toBe('in_progress')
      expect(body.data.comments.length).toBe(1)
      expect(body.data.comments[0].isStaff).toBe(true)

      // Verifies internal notes and tracking token hash are NEVER exposed
      expect(body.data.trackingTokenHash).toBeUndefined()
      expect(body.data.internalNotes).toBeUndefined()
    })

    it('rejects tracking requests with invalid tokens with 404', async () => {
      prismaMock.ticket.findFirst.mockResolvedValue(null)

      const res = await fetch(`${baseUrl}/api/public/tickets/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketNumber: 'TKT-000001',
          trackingToken: 'wrong-token-value',
        }),
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.success).toBe(false)
    })

    it('prevents access to another guest ticket even if ticket number is known', async () => {
      // Attacker guesses ticket number but uses arbitrary token
      prismaMock.ticket.findFirst.mockResolvedValue(null)

      const res = await fetch(`${baseUrl}/api/public/tickets/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketNumber: 'TKT-000002',
          trackingToken: 'attacker-token',
        }),
      })

      expect(res.status).toBe(404)
      expect(prismaMock.ticket.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            ticketNumber: 'TKT-000002',
            trackingTokenHash: crypto.createHash('sha256').update('attacker-token').digest('hex'),
          },
        })
      )
    })
  })

  // ---------------------------------------------------------------------------
  // 3. File Attachments: Security, Uploads & Content Verification
  // ---------------------------------------------------------------------------
  describe('File Attachments & Security', () => {
    it('uploads valid attachments for authenticated customer', async () => {
      const customer = { id: 'cust-1', role: UserRole.customer, isActive: true }
      prismaMock.session.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), user: customer })
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TKT-000001',
        customerId: 'cust-1',
        assigneeId: 'agent-1',
        departmentId: null,
        status: 'open',
      })
      prismaMock.attachment.count.mockResolvedValue(0)
      prismaMock.attachment.create.mockResolvedValue({
        id: 'att-new-1',
        originalFilename: 'diagnostic.txt',
        mimeType: 'text/plain',
        fileSize: 25,
        createdAt: new Date(),
        uploadedBy: { id: 'cust-1', name: 'Customer' },
      })

      // Construct multipart form data with valid text file
      const formData = new FormData()
      formData.append('file', new Blob(['system diagnostic logs OK'], { type: 'text/plain' }), 'diagnostic.txt')

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments`, {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=customer-token`,
        },
        body: formData,
      })

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.attachments.length).toBe(1)
      expect(body.data.attachments[0].originalFilename).toBe('diagnostic.txt')

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ticketId: 'ticket-1',
            userId: 'cust-1',
            action: 'attachment.uploaded',
          }),
        })
      )
    })

    it('rejects dangerous and executable file extensions (.exe, .sh, .html, .svg)', async () => {
      const customer = { id: 'cust-1', role: UserRole.customer, isActive: true }
      prismaMock.session.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), user: customer })
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TKT-000001',
        customerId: 'cust-1',
        assigneeId: null,
        departmentId: null,
        status: 'open',
      })
      prismaMock.attachment.count.mockResolvedValue(0)

      const formData = new FormData()
      formData.append('file', new Blob(['echo malicious'], { type: 'application/x-sh' }), 'exploit.sh')

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments`, {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
        body: formData,
      })

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/blocked for security reasons|not supported/i)
      expect(prismaMock.attachment.create).not.toHaveBeenCalled()
    })

    it('rejects files with disguised content failing magic number verification', async () => {
      const customer = { id: 'cust-1', role: UserRole.customer, isActive: true }
      prismaMock.session.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), user: customer })
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TKT-000001',
        customerId: 'cust-1',
        assigneeId: null,
        departmentId: null,
        status: 'open',
      })
      prismaMock.attachment.count.mockResolvedValue(0)

      // Fake PNG file that is actually plain text / html script
      const fakePngBuffer = Buffer.from('<script>alert("xss")</script>')
      const formData = new FormData()
      formData.append('file', new Blob([fakePngBuffer], { type: 'image/png' }), 'disguised.png')

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments`, {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
        body: formData,
      })

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/content verification/i)
      expect(prismaMock.attachment.create).not.toHaveBeenCalled()
    })

    it('rejects file uploads when max attachment count (5) is exceeded', async () => {
      const customer = { id: 'cust-1', role: UserRole.customer, isActive: true }
      prismaMock.session.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), user: customer })
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        ticketNumber: 'TKT-000001',
        customerId: 'cust-1',
        assigneeId: null,
        departmentId: null,
        status: 'open',
      })
      // Already has 5 attachments
      prismaMock.attachment.count.mockResolvedValue(5)

      const formData = new FormData()
      formData.append('file', new Blob(['some text content'], { type: 'text/plain' }), 'extra.txt')

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments`, {
        method: 'POST',
        headers: { cookie: `${SESSION_COOKIE_NAME}=customer-token` },
        body: formData,
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.message).toMatch(/cannot exceed 5/i)
    })

    it('prevents unauthorized customers from accessing or downloading another customer attachments', async () => {
      const otherCustomer = { id: 'cust-2', role: UserRole.customer, isActive: true }
      prismaMock.session.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), user: otherCustomer })
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        customerId: 'cust-1', // belongs to cust-1
        assigneeId: 'agent-1',
        departmentId: null,
      })

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments/att-1`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=other-token` },
      })

      expect(res.status).toBe(404)
    })

    it('enforces Department Head isolation for attachment access', async () => {
      const deptHead = { id: 'dh-1', role: UserRole.department_head, isActive: true, departmentId: 'dept-eng' }
      prismaMock.session.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), user: deptHead })
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'dh-1',
        departmentId: 'dept-eng',
        headedDepartment: { id: 'dept-eng' },
      })

      // Ticket belongs to dept-sales
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-sales-1',
        customerId: 'cust-1',
        assigneeId: 'agent-sales-1',
        departmentId: 'dept-sales',
      })

      const res = await fetch(`${baseUrl}/api/tickets/ticket-sales-1/attachments`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=dh-token` },
      })

      expect(res.status).toBe(404)
    })

    it('allows Admin to download and delete attachments', async () => {
      const admin = { id: 'admin-1', role: UserRole.admin, isActive: true }
      prismaMock.session.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), user: admin })
      prismaMock.ticket.findFirst.mockResolvedValue({
        id: 'ticket-1',
        customerId: 'cust-1',
        assigneeId: 'agent-1',
        departmentId: 'dept-1',
        status: 'open',
      })

      // Create a test file in upload dir
      const testFilePath = path.join(UPLOAD_DIR, 'test-delete.txt')
      fs.writeFileSync(testFilePath, 'dummy data for admin test')

      prismaMock.attachment.findFirst.mockResolvedValue({
        id: 'att-del-1',
        ticketId: 'ticket-1',
        originalFilename: 'delete_me.txt',
        storagePath: testFilePath,
        uploadedById: 'cust-1',
      })
      prismaMock.attachment.delete.mockResolvedValue({ id: 'att-del-1' })

      const res = await fetch(`${baseUrl}/api/tickets/ticket-1/attachments/att-del-1`, {
        method: 'DELETE',
        headers: { cookie: `${SESSION_COOKIE_NAME}=admin-token` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(prismaMock.attachment.delete).toHaveBeenCalledWith({ where: { id: 'att-del-1' } })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'attachment.deleted' }),
        })
      )
    })
  })
})
