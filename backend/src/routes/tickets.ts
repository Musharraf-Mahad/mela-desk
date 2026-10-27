import { TicketCategory, TicketPriority, TicketStatus, UserRole } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRole } from '../middleware/authenticate.js'
import { prisma } from '../lib/prisma.js'

const createTicketSchema = z.object({
  subject: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(10_000),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority),
})

const listTicketsSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  isInternal: z.boolean().optional(),
})

const ticketSelect = {
  id: true,
  subject: true,
  description: true,
  category: true,
  priority: true,
  status: true,
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

const ticketsRouter = Router()

ticketsRouter.post(
  '/',
  authenticate,
  requireRole(UserRole.customer),
  async (req, res) => {
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

    try {
      const ticket = await prisma.ticket.create({
        data: {
          ...parsed.data,
          customerId: req.user!.id,
        },
        select: ticketSelect,
      })

      res.status(201).json({
        success: true,
        data: { ticket },
      })
    } catch (error) {
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
    const { page, pageSize, ...filters } = parsed.data
    const where = {
      ...filters,
      ...(req.user!.role === UserRole.customer
        ? { customerId: req.user!.id }
        : req.user!.role === UserRole.agent
          ? { assigneeId: req.user!.id }
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

ticketsRouter.get('/:ticketId', authenticate, async (req, res) => {
  const ticketId = req.params.ticketId

  if (typeof ticketId !== 'string') {
    res.status(400).json({ success: false, message: 'Invalid ticket ID' })
    return
  }

  try {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...(req.user!.role === UserRole.customer
          ? { customerId: req.user!.id }
          : req.user!.role === UserRole.agent
            ? { assigneeId: req.user!.id }
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
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: ticketId,
        ...(req.user!.role === UserRole.customer
          ? { customerId: req.user!.id }
          : req.user!.role === UserRole.agent
            ? { assigneeId: req.user!.id }
            : {}),
      },
      select: { id: true },
    })

    if (!ticket) {
      res.status(404).json({ success: false, message: 'Ticket not found' })
      return
    }

    const comment = await prisma.comment.create({
      data: {
        ticketId: ticket.id,
        authorId: req.user!.id,
        body: parsed.data.body,
        isInternal: req.user!.role === UserRole.customer ? false : parsed.data.isInternal ?? false,
      },
      select: commentSelect,
    })

    const safeComment =
      req.user!.role === UserRole.customer
        ? (({ isInternal: _isInternal, ...publicComment }) => publicComment)(comment)
        : comment

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
