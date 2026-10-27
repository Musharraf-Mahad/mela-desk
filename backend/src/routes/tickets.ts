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

export default ticketsRouter
