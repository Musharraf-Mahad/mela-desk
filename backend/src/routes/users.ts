import { UserRole } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRole } from '../middleware/authenticate.js'
import { prisma } from '../lib/prisma.js'

const listAgentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const usersRouter = Router()

usersRouter.get(
  '/agents',
  authenticate,
  requireRole(UserRole.admin),
  async (req, res) => {
    const parsed = listAgentsSchema.safeParse(req.query)

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid agent list options',
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      })
      return
    }

    try {
      const { page, pageSize } = parsed.data
      const where = {
        role: UserRole.agent,
        isActive: true,
      }
      const [agents, total] = await prisma.$transaction([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
          },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.user.count({ where }),
      ])

      res.status(200).json({
        success: true,
        data: {
          agents,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        },
      })
    } catch (error) {
      console.error('Agent directory lookup failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to list agents',
      })
    }
  },
)

export default usersRouter
