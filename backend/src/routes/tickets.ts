import { Prisma, TicketCategory, TicketPriority, TicketStatus, UserRole } from '@prisma/client'
import { Router } from 'express'
import fs from 'node:fs'
import { z } from 'zod'
import { authenticate, requireRole } from '../middleware/authenticate.js'
import { prisma } from '../lib/prisma.js'
import { publishTicketEvent } from '../lib/ticketEvents.js'
import { sendTicketEmailNotification } from '../lib/ticketNotifications.js'
import { allocateNextTicketNumber } from '../lib/ticketNumber.js'
import {
  parseMultipartFormData,
  saveAttachmentFile,
  MAX_ATTACHMENTS_PER_TICKET,
  type StoredAttachment,
} from '../lib/fileStorage.js'

const createTicketSchema = z.object({
  subject: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(10_000),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority),
  departmentId: z.string().trim().min(1).max(191).optional().nullable(),
})

const listTicketsSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  departmentId: z.string().trim().optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const listQueueSchema = z.object({
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  isInternal: z.boolean().optional(),
})

const updateTicketStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus),
})

const assignTicketSchema = z.object({
  assigneeId: z.string().trim().min(1).max(191).nullable(),
})

const updateTicketDepartmentSchema = z.object({
  departmentId: z.string().trim().nullable(),
})

const ticketSelect = {
  ticketNumber: true,
  id: true,
  subject: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  departmentId: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
  createdAt: true,
  updatedAt: true,
  customer: {
    select: {
      id: true,
      name: true,
    },
  },
  assignee: {
    select: {
      id: true,
      name: true,
    },
  },
  guestName: true,
  guestEmail: true,
  attachments: {
    select: {
      id: true,
      originalFilename: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      uploadedBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const

const commentSelect = {
  id: true,
  body: true,
  isInternal: true,
  createdAt: true,
  author: {
    select: {
      id: true,
      name: true,
    },
  },
} as const

async function resolveUserDepartmentId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true, headedDepartment: { select: { id: true } } },
  })
  return user?.headedDepartment?.id ?? user?.departmentId ?? null
}

const ticketsRouter = Router()

ticketsRouter.post(
  '/',
  authenticate,
  requireRole(UserRole.customer),
  async (req, res) => {
    const isMultipart = req.headers['content-type']?.includes('multipart/form-data')

    let parsedBody: z.infer<typeof createTicketSchema>
    let uploadedFiles: Array<{ originalFilename: string; buffer: Buffer; size: number; declaredMimeType: string }> = []

    if (isMultipart) {
      try {
        const { fields, files } = await parseMultipartFormData(req)
        const parsed = createTicketSchema.safeParse(fields)
        if (!parsed.success) {
          res.status(400).json({
            success: false,
            message: 'Invalid ticket details',
            errors: parsed.error.issues.map(({ path, message }) => ({
              field: path.join('.'),
              message,
            })),
          })
          return
        }
        parsedBody = parsed.data
        uploadedFiles = files
      } catch (err: unknown) {
        res.status(400).json({
          success: false,
          message: err instanceof Error ? err.message : 'Failed to parse form data',
        })
        return
      }
    } else {
      const parsed = createTicketSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Invalid ticket details',
          errors: parsed.error.issues.map(({ path, message }) => ({
            field: path.join('.'),
            message,
          })),
        })
        return
      }
      parsedBody = parsed.data
    }

    if (uploadedFiles.length > MAX_ATTACHMENTS_PER_TICKET) {
      res.status(400).json({
        success: false,
        message: `You can upload at most ${MAX_ATTACHMENTS_PER_TICKET} attachments per ticket.`,
      })
      return
    }

    const savedAttachments: StoredAttachment[] = []
    for (const file of uploadedFiles) {
      const saveResult = await saveAttachmentFile(file)
      if (!saveResult.success) {
        for (const a of savedAttachments) {
          try {
            if (fs.existsSync(a.storagePath)) fs.unlinkSync(a.storagePath)
          } catch {}
        }
        res.status(422).json({
          success: false,
          message: saveResult.error,
        })
        return
      }
      savedAttachments.push(saveResult.attachment)
    }

    try {
      const ticket = await prisma.$transaction(async (transaction) => {
        const ticketNumber = await allocateNextTicketNumber(transaction)
        const createdTicket = await transaction.ticket.create({
          data: {
            ...parsedBody,
            ticketNumber,
            customerId: req.user!.id,
          },
          select: ticketSelect,
        })

        for (const att of savedAttachments) {
          await transaction.attachment.create({
            data: {
              ticketId: createdTicket.id,
              originalFilename: att.originalFilename,
              storedFilename: att.storedFilename,
              mimeType: att.mimeType,
              fileSize: att.fileSize,
              storagePath: att.storagePath,
              uploadedById: req.user!.id,
            },
          })
          await transaction.auditLog.create({
            data: {
              ticketId: createdTicket.id,
              userId: req.user!.id,
              action: 'attachment.uploaded',
              details: JSON.stringify({
                originalFilename: att.originalFilename,
                fileSize: att.fileSize,
                mimeType: att.mimeType,
              }),
            },
          })
        }

        await transaction.auditLog.create({
          data: {
            ticketId: createdTicket.id,
            userId: req.user!.id,
            action: 'ticket.created',
            details: JSON.stringify({
              ticketNumber,
              category: parsedBody.category,
              priority: parsedBody.priority,
              ...(parsedBody.departmentId ? { departmentId: parsedBody.departmentId } : {}),
            }),
          },
        })

        if (savedAttachments.length > 0) {
          const freshAttachments = await transaction.attachment.findMany({
            where: { ticketId: createdTicket.id },
            select: ticketSelect.attachments.select,
          })
          return {
            ...createdTicket,
            attachments: freshAttachments,
          }
        }

        return createdTicket
      })

      publishTicketEvent([req.user!.id], {
        type: 'ticket.created',
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
      })
      try {
        const agents = await prisma.user.findMany({
          where: { role: UserRole.agent, isActive: true },
          select: { id: true },
        })
        publishTicketEvent(agents.map(({ id }) => id), {
          type: 'ticket.created',
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          priority: ticket.priority,
        })
      } catch (error) {
        console.error('New ticket live notification failed:', error)
      }

      res.status(201).json({
        success: true,
        data: { ticket },
      })
    } catch (error) {
      for (const a of savedAttachments) {
        try {
          if (fs.existsSync(a.storagePath)) fs.unlinkSync(a.storagePath)
        } catch {}
      }
      console.error('Ticket creation failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to create ticket',
      })
    }
  },
)

ticketsRouter.get('/', authenticate, async (req, res) => {
  const parsed = listTicketsSchema.safeParse(req.query)

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid ticket filters',
      errors: parsed.error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    })
    return
  }

  try {
    const { page, pageSize, search, departmentId, ...filters } = parsed.data

    let roleScopedFilter: Prisma.TicketWhereInput = {}
    if (req.user!.role === UserRole.customer) {
      roleScopedFilter = { customerId: req.user!.id }
    } else if (req.user!.role === UserRole.agent) {
      roleScopedFilter = { assigneeId: req.user!.id }
    } else if (req.user!.role === UserRole.department_head) {
      const myDeptId = await resolveUserDepartmentId(req.user!.id)
      roleScopedFilter = { departmentId: myDeptId ?? '__none__' }
    } else if (departmentId) {
      roleScopedFilter = { departmentId: departmentId === 'none' ? null : departmentId }
    }

    const where: Prisma.TicketWhereInput = {
      ...filters,
      ...roleScopedFilter,
      ...(search
        ? {
            OR: [
              { ticketNumber: { contains: search } },
              { subject: { contains: search } },
              { description: { contains: search } },
            ],
          }
        : {}),
    }
    const [tickets, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        select: ticketSelect,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ])

    res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    })
  } catch (error) {
    console.error('Ticket listing failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to list tickets',
    })
  }
})

ticketsRouter.get(
  '/queue',
  authenticate,
  requireRole(UserRole.agent, UserRole.department_head),
  async (req, res) => {
    const parsed = listQueueSchema.safeParse(req.query)

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket queue filters',
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      })
      return
    }

    try {
      const { page, pageSize, search, ...filters } = parsed.data

      let deptScope: Prisma.TicketWhereInput = {}
      if (req.user!.role === UserRole.department_head) {
        const myDeptId = await resolveUserDepartmentId(req.user!.id)
        deptScope = { departmentId: myDeptId ?? '__none__' }
      }

      const where: Prisma.TicketWhereInput = {
        ...filters,
        ...deptScope,
        status: TicketStatus.open,
        assigneeId: null,
        ...(search
          ? {
              OR: [
                { ticketNumber: { contains: search } },
                { subject: { contains: search } },
                { description: { contains: search } },
              ],
            }
          : {}),
      }
      const [tickets, total] = await prisma.$transaction([
        prisma.ticket.findMany({
          where,
          select: ticketSelect,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.ticket.count({ where }),
      ])

      res.status(200).json({
        success: true,
        data: {
          tickets,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        },
      })
    } catch (error) {
      console.error('Ticket queue lookup failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to list available tickets',
      })
    }
  },
)

ticketsRouter.get('/:ticketId', authenticate, async (req, res) => {
  const ticketId = req.params.ticketId

  if (typeof ticketId !== 'string') {
    res.status(400).json({ success: false, message: 'Invalid ticket ID' })
    return
  }

  try {
    let deptScopeWhere: Prisma.TicketWhereInput = {}
    if (req.user!.role === UserRole.department_head) {
      const myDeptId = await resolveUserDepartmentId(req.user!.id)
      deptScopeWhere = { departmentId: myDeptId ?? '__none__' }
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        ...(ticketId.toUpperCase().startsWith('TKT-')
          ? { ticketNumber: ticketId.toUpperCase() }
          : { id: ticketId }),
        ...(req.user!.role === UserRole.customer
          ? { customerId: req.user!.id }
          : req.user!.role === UserRole.agent
            ? { assigneeId: req.user!.id }
            : req.user!.role === UserRole.department_head
              ? deptScopeWhere
              : {}),
      },
      select: {
        ...ticketSelect,
        comments: {
          where: req.user!.role === UserRole.customer ? { isInternal: false } : undefined,
          select: commentSelect,
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' })
      return
    }

    const safeTicket =
      req.user!.role === UserRole.customer
        ? {
            ...ticket,
            comments: ticket.comments
              .filter(({ isInternal }) => !isInternal)
              .map(({ isInternal: _isInternal, ...comment }) => comment),
          }
        : ticket

    res.status(200).json({
      success: true,
      data: { ticket: safeTicket },
    })
  } catch (error) {
    console.error('Ticket lookup failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve ticket',
    })
  }
})

ticketsRouter.patch(
  '/:ticketId/status',
  authenticate,
  requireRole(UserRole.agent, UserRole.department_head, UserRole.admin),
  async (req, res) => {
    const ticketId = req.params.ticketId

    if (typeof ticketId !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ticket ID' })
      return
    }

    const parsed = updateTicketStatusSchema.safeParse(req.body)

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket status',
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      })
      return
    }

    try {
      const ticket = await prisma.$transaction(async (transaction) => {
        let deptScope: Prisma.TicketWhereInput = {}
        if (req.user!.role === UserRole.department_head) {
          const myDeptId = await resolveUserDepartmentId(req.user!.id)
          deptScope = { departmentId: myDeptId ?? '__none__' }
        }

        const existingTicket = await transaction.ticket.findFirst({
          where: {
            ...(ticketId.toUpperCase().startsWith('TKT-')
              ? { ticketNumber: ticketId.toUpperCase() }
              : { id: ticketId }),
            ...(req.user!.role === UserRole.agent
              ? { assigneeId: req.user!.id }
              : req.user!.role === UserRole.department_head
                ? deptScope
                : {}),
          },
          select: { id: true, status: true },
        })

        if (!existingTicket) return null

        const updatedTicket = await transaction.ticket.update({
          where: { id: existingTicket.id },
          data: { status: parsed.data.status },
          select: ticketSelect,
        })

        await transaction.auditLog.create({
          data: {
            ticketId: existingTicket.id,
            userId: req.user!.id,
            action: 'ticket.status_changed',
            details: JSON.stringify({
              from: existingTicket.status,
              to: parsed.data.status,
            }),
          },
        })

        return updatedTicket
      })

      if (!ticket) {
        res.status(404).json({ success: false, message: 'Ticket not found' })
        return
      }

      const participantIds = [ticket.customer?.id, ticket.assignee?.id].filter(
        (id): id is string => Boolean(id),
      )
      publishTicketEvent(participantIds, {
        type: 'ticket.status_changed',
        ticketId: ticket.id,
        status: ticket.status,
      })
      void sendTicketEmailNotification({
        userIds: [ticket.customer?.id ?? ''],
        subject: `Ticket status updated: ${ticket.subject}`,
        text: `The status of your ticket "${ticket.subject}" is now ${ticket.status.replace('_', ' ')}.`,
      })

      res.status(200).json({
        success: true,
        data: { ticket },
      })
    } catch (error) {
      console.error('Ticket status update failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to update ticket status',
      })
    }
  },
)

ticketsRouter.patch(
  '/:ticketId/assignee',
  authenticate,
  requireRole(UserRole.admin, UserRole.department_head),
  async (req, res) => {
    const ticketId = req.params.ticketId

    if (typeof ticketId !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ticket ID' })
      return
    }

    const parsed = assignTicketSchema.safeParse(req.body)

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid ticket assignment',
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      })
      return
    }

    try {
      const result = await prisma.$transaction(async (transaction) => {
        const existingTicket = await transaction.ticket.findFirst({
          where: {
            ...(ticketId.toUpperCase().startsWith('TKT-')
              ? { ticketNumber: ticketId.toUpperCase() }
              : { id: ticketId }),
          },
          select: { id: true, assigneeId: true, departmentId: true },
        })

        if (!existingTicket) return { kind: 'ticket_not_found' as const }

        // Department Head validation
        let myDeptId: string | null = null
        if (req.user!.role === UserRole.department_head) {
          myDeptId = await resolveUserDepartmentId(req.user!.id)
          if (!myDeptId || existingTicket.departmentId !== myDeptId) {
            return { kind: 'cross_department_forbidden' as const }
          }
        }

        if (parsed.data.assigneeId !== null) {
          const assignee = await transaction.user.findFirst({
            where: {
              id: parsed.data.assigneeId,
              role: UserRole.agent,
              isActive: true,
            },
            select: { id: true, ...(existingTicket.departmentId || req.user!.role === UserRole.department_head ? { departmentId: true } : {}) },
          })

          if (!assignee) return { kind: 'invalid_assignee' as const }

          // Enforce department alignment:
          // 1. Department Head assigning: assignee must belong to their department
          if (req.user!.role === UserRole.department_head) {
            if (assignee.departmentId !== myDeptId) {
              return { kind: 'assignee_not_in_department' as const }
            }
          }
          // 2. Admin assigning: if ticket belongs to a department, assignee must belong to that department
          else if (req.user!.role === UserRole.admin && existingTicket.departmentId) {
            if (assignee.departmentId !== existingTicket.departmentId) {
              return { kind: 'assignee_not_in_department' as const }
            }
          }
        }

        const ticket = await transaction.ticket.update({
          where: { id: existingTicket.id },
          data: { assigneeId: parsed.data.assigneeId },
          select: ticketSelect,
        })

        await transaction.auditLog.create({
          data: {
            ticketId: existingTicket.id,
            userId: req.user!.id,
            action: parsed.data.assigneeId ? 'ticket.assigned' : 'ticket.unassigned',
            details: JSON.stringify({
              from: existingTicket.assigneeId,
              to: parsed.data.assigneeId,
              ...(existingTicket.departmentId ? { departmentId: existingTicket.departmentId } : {}),
            }),
          },
        })

        return {
          kind: 'updated' as const,
          ticket,
          previousAssigneeId: existingTicket.assigneeId,
        }
      })

      if (result.kind === 'ticket_not_found') {
        res.status(404).json({ success: false, message: 'Ticket not found' })
        return
      }

      if (result.kind === 'cross_department_forbidden') {
        res.status(403).json({
          success: false,
          message: 'You cannot manage tickets outside your department',
        })
        return
      }

      if (result.kind === 'invalid_assignee') {
        res.status(422).json({
          success: false,
          message: 'Assignee must be an active agent',
        })
        return
      }

      if (result.kind === 'assignee_not_in_department') {
        res.status(422).json({
          success: false,
          message: 'Assignee does not belong to the selected department',
        })
        return
      }

      const participantIds = [
        result.ticket.customer?.id,
        result.ticket.assignee?.id,
        result.previousAssigneeId,
      ].filter((id): id is string => Boolean(id))
      publishTicketEvent(participantIds, {
        type: parsed.data.assigneeId ? 'ticket.assigned' : 'ticket.unassigned',
        ticketId: result.ticket.id,
        assignee: result.ticket.assignee,
      })
      void sendTicketEmailNotification({
        userIds: participantIds.filter((id) => id !== req.user!.id),
        subject: parsed.data.assigneeId
          ? `Ticket assigned: ${result.ticket.subject}`
          : `Ticket unassigned: ${result.ticket.subject}`,
        text: parsed.data.assigneeId
          ? `Ticket "${result.ticket.subject}" has been assigned to ${result.ticket.assignee?.name ?? 'an agent'}.`
          : `Ticket "${result.ticket.subject}" is now unassigned.`,
      })

      res.status(200).json({
        success: true,
        data: { ticket: result.ticket },
      })
    } catch (error) {
      console.error('Ticket assignment failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to update ticket assignment',
      })
    }
  },
)

ticketsRouter.patch(
  '/:ticketId/department',
  authenticate,
  requireRole(UserRole.admin),
  async (req, res) => {
    const ticketId = req.params.ticketId

    if (typeof ticketId !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ticket ID' })
      return
    }

    const parsed = updateTicketDepartmentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid department ID' })
      return
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existingTicket = await tx.ticket.findFirst({
          where: {
            ...(ticketId.toUpperCase().startsWith('TKT-')
              ? { ticketNumber: ticketId.toUpperCase() }
              : { id: ticketId }),
          },
          select: {
            id: true,
            departmentId: true,
            assigneeId: true,
            assignee: { select: { departmentId: true } },
          },
        })

        if (!existingTicket) return { kind: 'not_found' as const }

        if (parsed.data.departmentId !== null) {
          const dept = await tx.department.findUnique({
            where: { id: parsed.data.departmentId },
            select: { id: true, name: true },
          })
          if (!dept) return { kind: 'invalid_department' as const }
        }

        // If current assignee does not belong to the new department, clear assigneeId
        let newAssigneeId = existingTicket.assigneeId
        if (
          parsed.data.departmentId !== null &&
          existingTicket.assignee &&
          existingTicket.assignee.departmentId !== parsed.data.departmentId
        ) {
          newAssigneeId = null
        }

        const ticket = await tx.ticket.update({
          where: { id: existingTicket.id },
          data: {
            departmentId: parsed.data.departmentId,
            assigneeId: newAssigneeId,
          },
          select: ticketSelect,
        })

        await tx.auditLog.create({
          data: {
            ticketId: existingTicket.id,
            userId: req.user!.id,
            action: 'ticket.department_changed',
            details: JSON.stringify({
              from: existingTicket.departmentId,
              to: parsed.data.departmentId,
              unassignedAgent: newAssigneeId !== existingTicket.assigneeId,
            }),
          },
        })

        return { kind: 'updated' as const, ticket }
      })

      if (result.kind === 'not_found') {
        res.status(404).json({ success: false, message: 'Ticket not found' })
        return
      }

      if (result.kind === 'invalid_department') {
        res.status(422).json({ success: false, message: 'Department not found' })
        return
      }

      res.status(200).json({
        success: true,
        data: { ticket: result.ticket },
      })
    } catch (error) {
      console.error('Ticket department update failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to update ticket department',
      })
    }
  },
)

ticketsRouter.post(
  '/:ticketId/claim',
  authenticate,
  requireRole(UserRole.agent),
  async (req, res) => {
    const ticketId = req.params.ticketId

    if (typeof ticketId !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid ticket ID' })
      return
    }

    try {
      const ticketFilter = ticketId.toUpperCase().startsWith('TKT-')
        ? { ticketNumber: ticketId.toUpperCase() }
        : { id: ticketId }

      const result = await prisma.$transaction(async (transaction) => {
        const claim = await transaction.ticket.updateMany({
          where: {
            ...ticketFilter,
            assigneeId: null,
            status: TicketStatus.open,
          },
          data: { assigneeId: req.user!.id },
        })

        if (claim.count === 0) {
          const existingTicket = await transaction.ticket.findFirst({
            where: ticketFilter,
            select: { id: true },
          })

          return existingTicket
            ? { kind: 'unavailable' as const }
            : { kind: 'not_found' as const }
        }

        const existingTicket = await transaction.ticket.findFirst({
          where: ticketFilter,
          select: { id: true },
        })

        if (!existingTicket) {
          throw new Error('Claimed ticket could not be found')
        }

        await transaction.auditLog.create({
          data: {
            ticketId: existingTicket.id,
            userId: req.user!.id,
            action: 'ticket.claimed',
            details: JSON.stringify({ from: null, to: req.user!.id }),
          },
        })

        const ticket = await transaction.ticket.findFirst({
          where: { id: existingTicket.id },
          select: ticketSelect,
        })

        if (!ticket) {
          throw new Error('Claimed ticket could not be reloaded')
        }

        return { kind: 'claimed' as const, ticket }
      })

      if (result.kind === 'not_found') {
        res.status(404).json({ success: false, message: 'Ticket not found' })
        return
      }

      if (result.kind === 'unavailable') {
        res.status(409).json({
          success: false,
          message: 'Ticket is no longer available to claim',
        })
        return
      }

      publishTicketEvent(
        [result.ticket.customer?.id, result.ticket.assignee?.id].filter(
          (id): id is string => Boolean(id),
        ),
        {
          type: 'ticket.claimed',
          ticketId: result.ticket.id,
          assignee: result.ticket.assignee,
        },
      )
      void sendTicketEmailNotification({
        userIds: [result.ticket.customer?.id ?? ''],
        subject: `An agent picked up your ticket: ${result.ticket.subject}`,
        text: `${result.ticket.assignee?.name ?? 'An agent'} has started working on your ticket "${result.ticket.subject}".`,
      })

      res.status(200).json({
        success: true,
        data: { ticket: result.ticket },
      })
    } catch (error) {
      console.error('Ticket claim failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to claim ticket',
      })
    }
  },
)

ticketsRouter.post('/:ticketId/comments', authenticate, async (req, res) => {
  const ticketId = req.params.ticketId

  if (typeof ticketId !== 'string') {
    res.status(400).json({ success: false, message: 'Invalid ticket ID' })
    return
  }

  const parsed = createCommentSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid comment details',
      errors: parsed.error.issues.map(({ path, message }) => ({
        field: path.join('.'),
        message,
      })),
    })
    return
  }

  if (req.user!.role === UserRole.customer && parsed.data.isInternal) {
    res.status(403).json({
      success: false,
      message: 'Customers cannot create internal comments',
    })
    return
  }

  try {
    let commentDeptScope: Prisma.TicketWhereInput = {}
    if (req.user!.role === UserRole.department_head) {
      const myDeptId = await resolveUserDepartmentId(req.user!.id)
      commentDeptScope = { departmentId: myDeptId ?? '__none__' }
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        ...(ticketId.toUpperCase().startsWith('TKT-')
          ? { ticketNumber: ticketId.toUpperCase() }
          : { id: ticketId }),
        ...(req.user!.role === UserRole.customer
          ? { customerId: req.user!.id }
          : req.user!.role === UserRole.agent
            ? { assigneeId: req.user!.id }
            : req.user!.role === UserRole.department_head
              ? commentDeptScope
              : {}),
      },
      select: { id: true, customerId: true, assigneeId: true, subject: true },
    })

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' })
      return
    }

    const comment = await prisma.$transaction(async (transaction) => {
      const createdComment = await transaction.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: req.user!.id,
          body: parsed.data.body,
          isInternal:
            req.user!.role === UserRole.customer ? false : parsed.data.isInternal ?? false,
        },
        select: commentSelect,
      })

      await transaction.auditLog.create({
        data: {
          ticketId: ticket.id,
          userId: req.user!.id,
          action: createdComment.isInternal
            ? 'ticket.internal_comment_added'
            : 'ticket.comment_added',
          details: JSON.stringify({ commentId: createdComment.id }),
        },
      })

      return createdComment
    })

    const safeComment =
      req.user!.role === UserRole.customer
        ? (({ isInternal: _isInternal, ...publicComment }) => publicComment)(comment)
        : comment

    const participants = [ticket.customerId, ticket.assigneeId].filter(
      (id): id is string => Boolean(id),
    )
    const notificationRecipients = comment.isInternal
      ? [ticket.assigneeId ?? ''].filter((id) => id !== req.user!.id)
      : participants.filter((id) => id !== req.user!.id)
    publishTicketEvent(notificationRecipients, {
      type: comment.isInternal ? 'ticket.internal_comment_added' : 'ticket.comment_added',
      ticketId: ticket.id,
      comment: safeComment,
    })
    if (!comment.isInternal) {
      void sendTicketEmailNotification({
        userIds: notificationRecipients,
        subject: `New reply on your ticket: ${ticket.subject}`,
        text: `${comment.author.name} replied to "${ticket.subject}":\n\n${comment.body}`,
      })
    }

    res.status(201).json({
      success: true,
      data: { comment: safeComment },
    })
  } catch (error) {
    console.error('Comment creation failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to create comment',
    })
  }
})

export default ticketsRouter
