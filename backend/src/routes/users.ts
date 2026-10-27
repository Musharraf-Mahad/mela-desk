import { Prisma, UserRole } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRole } from '../middleware/authenticate.js'
import { prisma } from '../lib/prisma.js'

const listAgentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
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

usersRouter.patch(
  '/:userId/status',
  authenticate,
  requireRole(UserRole.admin),
  async (req, res) => {
    const userId = req.params.userId

    if (typeof userId !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid user ID' })
      return
    }

    const parsed = updateUserStatusSchema.safeParse(req.body)

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid account status',
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      })
      return
    }

    if (userId === req.user!.id && !parsed.data.isActive) {
      res.status(409).json({
        success: false,
        message: 'You cannot deactivate your own account',
      })
      return
    }

    try {
      const result = await prisma.$transaction(async (transaction) => {
        const existingUser = await transaction.user.findFirst({
          where: { id: userId },
          select: { id: true, role: true, isActive: true },
        })

        if (!existingUser) return { kind: 'not_found' as const }

        if (existingUser.isActive === parsed.data.isActive) {
          return {
            kind: 'unchanged' as const,
            user: { id: existingUser.id, role: existingUser.role, isActive: existingUser.isActive },
          }
        }

        if (
          existingUser.role === UserRole.admin &&
          existingUser.isActive &&
          !parsed.data.isActive
        ) {
          const activeAdminCount = await transaction.user.count({
            where: { role: UserRole.admin, isActive: true },
          })

          if (activeAdminCount <= 1) return { kind: 'last_admin' as const }
        }

        const user = await transaction.user.update({
          where: { id: userId },
          data: { isActive: parsed.data.isActive },
          select: { id: true, role: true, isActive: true },
        })

        if (!parsed.data.isActive) {
          await transaction.session.deleteMany({
            where: { userId },
          })
        }

        await transaction.auditLog.create({
          data: {
            userId: req.user!.id,
            action: parsed.data.isActive ? 'user.activated' : 'user.deactivated',
            details: JSON.stringify({
              targetUserId: userId,
              role: user.role,
            }),
          },
        })

        return { kind: 'updated' as const, user }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      if (result.kind === 'not_found') {
        res.status(404).json({ success: false, message: 'User not found' })
        return
      }

      if (result.kind === 'last_admin') {
        res.status(409).json({
          success: false,
          message: 'The last active admin cannot be deactivated',
        })
        return
      }

      res.status(200).json({
        success: true,
        data: { user: result.user },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        res.status(409).json({
          success: false,
          message: 'Account changed concurrently; please retry',
        })
        return
      }

      console.error('User status update failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to update user status',
      })
    }
  },
)

export default usersRouter
