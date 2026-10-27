import { UserRole } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, requireRole } from '../middleware/authenticate.js'

const listAuditLogsSchema = z.object({
  ticketId: z.string().trim().min(1).max(191).optional(),
  userId: z.string().trim().min(1).max(191).optional(),
  action: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const auditLogSelect = {
  id: true,
  ticketId: true,
  userId: true,
  action: true,
  details: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
    },
  },
  ticket: {
    select: {
      id: true,
      subject: true,
    },
  },
} as const

const auditLogsRouter = Router()

auditLogsRouter.get(
  '/',
  authenticate,
  requireRole(UserRole.admin),
  async (req, res) => {
    const parsed = listAuditLogsSchema.safeParse(req.query)

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid audit log filters',
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      })
      return
    }

    try {
      const { page, pageSize, ...where } = parsed.data
      const [auditLogs, total] = await prisma.$transaction([
        prisma.auditLog.findMany({
          where,
          select: auditLogSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.auditLog.count({ where }),
      ])

      res.status(200).json({
        success: true,
        data: {
          auditLogs,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        },
      })
    } catch (error) {
      console.error('Audit log lookup failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to list audit logs',
      })
    }
  },
)

export default auditLogsRouter
