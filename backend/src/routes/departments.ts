import { Prisma, UserRole } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, requireRole } from '../middleware/authenticate.js'

const createDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  headId: z.string().trim().min(1).max(191).optional().nullable(),
})

const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  headId: z.string().trim().min(1).max(191).optional().nullable(),
})

const addMemberSchema = z.object({
  userId: z.string().trim().min(1).max(191),
})

const listDepartmentsSchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const departmentSelect = {
  id: true,
  name: true,
  description: true,
  headId: true,
  createdAt: true,
  updatedAt: true,
  head: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  },
  _count: {
    select: {
      members: true,
      tickets: true,
    },
  },
} as const

const departmentsRouter = Router()

/**
 * Helper to resolve the department for a Department Head
 */
async function resolveDeptHeadDepartmentId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      departmentId: true,
      headedDepartment: { select: { id: true } },
    },
  })
  return user?.headedDepartment?.id ?? user?.departmentId ?? null
}

// --------------------------------------------------------------------------
// 1. GET /api/departments/my - Department Head's own department details & stats
// --------------------------------------------------------------------------
departmentsRouter.get(
  '/my',
  authenticate,
  requireRole(UserRole.department_head),
  async (req, res) => {
    try {
      const myDeptId = await resolveDeptHeadDepartmentId(req.user!.id)

      if (!myDeptId) {
        res.status(404).json({
          success: false,
          message: 'No department assigned to this department head',
        })
        return
      }

      const department = await prisma.department.findUnique({
        where: { id: myDeptId },
        include: {
          head: {
            select: { id: true, name: true, email: true, role: true, isActive: true },
          },
          members: {
            where: { isActive: true },
            select: { id: true, name: true, email: true, role: true, isActive: true },
            orderBy: { name: 'asc' },
          },
        },
      })

      if (!department) {
        res.status(404).json({
          success: false,
          message: 'Department not found',
        })
        return
      }

      // Compute ticket stats for this department
      const ticketCounts = await prisma.ticket.groupBy({
        by: ['status'],
        where: { departmentId: myDeptId },
        _count: { status: true },
      })

      const statusMap: Record<string, number> = {
        open: 0,
        in_progress: 0,
        pending: 0,
        resolved: 0,
        closed: 0,
      }
      for (const item of ticketCounts) {
        statusMap[item.status] = item._count.status
      }

      const totalTickets = Object.values(statusMap).reduce((a, b) => a + b, 0)

      res.status(200).json({
        success: true,
        data: {
          department,
          workload: {
            total: totalTickets,
            open: statusMap.open,
            inProgress: statusMap.in_progress,
            pending: statusMap.pending,
            resolved: statusMap.resolved,
            closed: statusMap.closed,
          },
        },
      })
    } catch (error) {
      console.error('Department head dashboard lookup failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to retrieve department dashboard',
      })
    }
  },
)

// --------------------------------------------------------------------------
// 2. GET /api/departments/overview - Head / Admin organization-wide overview
// --------------------------------------------------------------------------
departmentsRouter.get(
  '/overview',
  authenticate,
  requireRole(UserRole.admin, UserRole.head),
  async (_req, res) => {
    try {
      const departments = await prisma.department.findMany({
        include: {
          head: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              members: true,
              tickets: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      })

      // Get ticket status counts grouped by department
      const deptTicketsGroup = await prisma.ticket.groupBy({
        by: ['departmentId', 'status'],
        _count: { status: true },
      })

      const deptWorkloadMap: Record<string, { open: number; inProgress: number; resolved: number; closed: number }> = {}
      for (const group of deptTicketsGroup) {
        const key = group.departmentId ?? 'unassigned'
        if (!deptWorkloadMap[key]) {
          deptWorkloadMap[key] = { open: 0, inProgress: 0, resolved: 0, closed: 0 }
        }
        if (group.status === 'open') deptWorkloadMap[key].open += group._count.status
        else if (group.status === 'in_progress') deptWorkloadMap[key].inProgress += group._count.status
        else if (group.status === 'resolved') deptWorkloadMap[key].resolved += group._count.status
        else if (group.status === 'closed') deptWorkloadMap[key].closed += group._count.status
      }

      // Organization global ticket counts
      const globalCounts = await prisma.ticket.groupBy({
        by: ['status'],
        _count: { status: true },
      })
      const globalStatusMap: Record<string, number> = {
        open: 0,
        in_progress: 0,
        pending: 0,
        resolved: 0,
        closed: 0,
      }
      for (const item of globalCounts) {
        globalStatusMap[item.status] = item._count.status
      }

      // Department summaries enriched with workload
      const departmentsWithWorkload = departments.map((dept) => ({
        ...dept,
        workload: deptWorkloadMap[dept.id] ?? { open: 0, inProgress: 0, resolved: 0, closed: 0 },
      }))

      // Agent workload overview
      const activeAgents = await prisma.user.findMany({
        where: {
          role: { in: [UserRole.agent, UserRole.department_head] },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              assignedTickets: {
                where: { status: { in: ['open', 'in_progress'] } },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      })

      res.status(200).json({
        success: true,
        data: {
          departments: departmentsWithWorkload,
          globalStatus: globalStatusMap,
          totalTickets: Object.values(globalStatusMap).reduce((a, b) => a + b, 0),
          agents: activeAgents.map((ag) => ({
            id: ag.id,
            name: ag.name,
            email: ag.email,
            role: ag.role,
            department: ag.department,
            activeAssignedTickets: ag._count.assignedTickets,
          })),
        },
      })
    } catch (error) {
      console.error('Organization overview lookup failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to retrieve organizational overview',
      })
    }
  },
)

// --------------------------------------------------------------------------
// 3. GET /api/departments - List all departments
// --------------------------------------------------------------------------
departmentsRouter.get(
  '/',
  authenticate,
  requireRole(UserRole.admin, UserRole.head, UserRole.department_head),
  async (req, res) => {
    const parsed = listDepartmentsSchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid department search parameters',
      })
      return
    }

    try {
      const { search, page, pageSize } = parsed.data

      let where: Prisma.DepartmentWhereInput = {}

      if (req.user!.role === UserRole.department_head) {
        const myDeptId = await resolveDeptHeadDepartmentId(req.user!.id)
        if (!myDeptId) {
          res.status(200).json({
            success: true,
            data: {
              departments: [],
              pagination: { page, pageSize, total: 0, totalPages: 0 },
            },
          })
          return
        }
        where = { id: myDeptId }
      } else if (search) {
        where = {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
          ],
        }
      }

      const [departments, total] = await prisma.$transaction([
        prisma.department.findMany({
          where,
          select: departmentSelect,
          orderBy: { name: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.department.count({ where }),
      ])

      res.status(200).json({
        success: true,
        data: {
          departments,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        },
      })
    } catch (error) {
      console.error('Department listing failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to list departments',
      })
    }
  },
)

// --------------------------------------------------------------------------
// 4. POST /api/departments - Create department (Admin)
// --------------------------------------------------------------------------
departmentsRouter.post(
  '/',
  authenticate,
  requireRole(UserRole.admin),
  async (req, res) => {
    const parsed = createDepartmentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid department details',
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      })
      return
    }

    try {
      const department = await prisma.$transaction(async (tx) => {
        // If headId provided, verify user
        if (parsed.data.headId) {
          const headUser = await tx.user.findFirst({
            where: { id: parsed.data.headId, isActive: true },
            select: { id: true, role: true },
          })
          if (!headUser) {
            throw new Error('INVALID_HEAD')
          }
        }

        const createdDept = await tx.department.create({
          data: {
            name: parsed.data.name,
            description: parsed.data.description,
            headId: parsed.data.headId ?? null,
          },
          select: departmentSelect,
        })

        // If headId provided, ensure user has department_head role & is assigned as member
        if (parsed.data.headId) {
          await tx.user.update({
            where: { id: parsed.data.headId },
            data: {
              role: UserRole.department_head,
              departmentId: createdDept.id,
            },
          })
        }

        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'department.created',
            details: JSON.stringify({
              departmentId: createdDept.id,
              name: createdDept.name,
              headId: createdDept.headId,
            }),
          },
        })

        return createdDept
      })

      res.status(201).json({
        success: true,
        data: { department },
      })
    } catch (error: any) {
      if (error?.message === 'INVALID_HEAD') {
        res.status(422).json({
          success: false,
          message: 'Designated department head must be an active user',
        })
        return
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({
          success: false,
          message: 'A department with this name or head already exists',
        })
        return
      }

      console.error('Department creation failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to create department',
      })
    }
  },
)

// --------------------------------------------------------------------------
// 5. GET /api/departments/:id - Get department details
// --------------------------------------------------------------------------
departmentsRouter.get(
  '/:id',
  authenticate,
  requireRole(UserRole.admin, UserRole.head, UserRole.department_head),
  async (req, res) => {
    const id = req.params.id
    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid department ID' })
      return
    }

    try {
      if (req.user!.role === UserRole.department_head) {
        const myDeptId = await resolveDeptHeadDepartmentId(req.user!.id)
        if (myDeptId !== id) {
          res.status(403).json({
            success: false,
            message: 'You do not have permission to view other departments',
          })
          return
        }
      }

      const department = await prisma.department.findUnique({
        where: { id },
        include: {
          head: {
            select: { id: true, name: true, email: true, role: true, isActive: true },
          },
          members: {
            select: { id: true, name: true, email: true, role: true, isActive: true },
            orderBy: { name: 'asc' },
          },
          _count: {
            select: {
              members: true,
              tickets: true,
            },
          },
        },
      })

      if (!department) {
        res.status(404).json({ success: false, message: 'Department not found' })
        return
      }

      res.status(200).json({
        success: true,
        data: { department },
      })
    } catch (error) {
      console.error('Department details lookup failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to retrieve department details',
      })
    }
  },
)

// --------------------------------------------------------------------------
// 6. PATCH /api/departments/:id - Update department details (Admin)
// --------------------------------------------------------------------------
departmentsRouter.patch(
  '/:id',
  authenticate,
  requireRole(UserRole.admin),
  async (req, res) => {
    const id = req.params.id
    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid department ID' })
      return
    }

    const parsed = updateDepartmentSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid department update data',
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join('.'),
          message,
        })),
      })
      return
    }

    try {
      const updatedDepartment = await prisma.$transaction(async (tx) => {
        const existingDept = await tx.department.findUnique({
          where: { id },
          select: { id: true, name: true, headId: true },
        })

        if (!existingDept) return null

        if (parsed.data.headId !== undefined && parsed.data.headId !== null) {
          const headUser = await tx.user.findFirst({
            where: { id: parsed.data.headId, isActive: true },
            select: { id: true },
          })
          if (!headUser) throw new Error('INVALID_HEAD')
        }

        const dept = await tx.department.update({
          where: { id },
          data: {
            ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
            ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
            ...(parsed.data.headId !== undefined ? { headId: parsed.data.headId } : {}),
          },
          select: departmentSelect,
        })

        // If head changed to a new user
        if (parsed.data.headId && parsed.data.headId !== existingDept.headId) {
          await tx.user.update({
            where: { id: parsed.data.headId },
            data: {
              role: UserRole.department_head,
              departmentId: id,
            },
          })
        }

        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'department.updated',
            details: JSON.stringify({
              departmentId: id,
              changes: parsed.data,
            }),
          },
        })

        return dept
      })

      if (!updatedDepartment) {
        res.status(404).json({ success: false, message: 'Department not found' })
        return
      }

      res.status(200).json({
        success: true,
        data: { department: updatedDepartment },
      })
    } catch (error: any) {
      if (error?.message === 'INVALID_HEAD') {
        res.status(422).json({
          success: false,
          message: 'Designated department head must be an active user',
        })
        return
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        res.status(409).json({
          success: false,
          message: 'A department with this name or head already exists',
        })
        return
      }

      console.error('Department update failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to update department',
      })
    }
  },
)

// --------------------------------------------------------------------------
// 7. DELETE /api/departments/:id - Safely delete department (Admin)
// --------------------------------------------------------------------------
departmentsRouter.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.admin),
  async (req, res) => {
    const id = req.params.id
    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid department ID' })
      return
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.department.findUnique({
          where: { id },
          select: { id: true, name: true },
        })

        if (!existing) return null

        // Safe disassociation
        await tx.user.updateMany({
          where: { departmentId: id },
          data: { departmentId: null },
        })

        await tx.ticket.updateMany({
          where: { departmentId: id },
          data: { departmentId: null },
        })

        await tx.department.delete({
          where: { id },
        })

        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'department.deleted',
            details: JSON.stringify({
              departmentId: id,
              name: existing.name,
            }),
          },
        })

        return existing
      })

      if (!result) {
        res.status(404).json({ success: false, message: 'Department not found' })
        return
      }

      res.status(200).json({
        success: true,
        message: 'Department deleted successfully',
      })
    } catch (error) {
      console.error('Department deletion failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to delete department',
      })
    }
  },
)

// --------------------------------------------------------------------------
// 8. GET /api/departments/:id/members - View department members
// --------------------------------------------------------------------------
departmentsRouter.get(
  '/:id/members',
  authenticate,
  requireRole(UserRole.admin, UserRole.head, UserRole.department_head),
  async (req, res) => {
    const id = req.params.id
    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid department ID' })
      return
    }

    try {
      if (req.user!.role === UserRole.department_head) {
        const myDeptId = await resolveDeptHeadDepartmentId(req.user!.id)
        if (myDeptId !== id) {
          res.status(403).json({
            success: false,
            message: 'You do not have permission to view members of other departments',
          })
          return
        }
      }

      const members = await prisma.user.findMany({
        where: { departmentId: id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      })

      res.status(200).json({
        success: true,
        data: { members },
      })
    } catch (error) {
      console.error('Department members lookup failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to list department members',
      })
    }
  },
)

// --------------------------------------------------------------------------
// 9. POST /api/departments/:id/members - Add agent/member to department (Admin)
// --------------------------------------------------------------------------
departmentsRouter.post(
  '/:id/members',
  authenticate,
  requireRole(UserRole.admin),
  async (req, res) => {
    const id = req.params.id
    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid department ID' })
      return
    }

    const parsed = addMemberSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid member details',
      })
      return
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const department = await tx.department.findUnique({
          where: { id },
          select: { id: true, name: true },
        })
        if (!department) return { kind: 'department_not_found' as const }

        const user = await tx.user.findFirst({
          where: {
            id: parsed.data.userId,
            isActive: true,
            role: { in: [UserRole.agent, UserRole.department_head] },
          },
          select: { id: true, name: true, departmentId: true },
        })
        if (!user) return { kind: 'invalid_user' as const }

        await tx.user.update({
          where: { id: user.id },
          data: { departmentId: id },
        })

        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'department.member_added',
            details: JSON.stringify({
              departmentId: id,
              userId: user.id,
              previousDepartmentId: user.departmentId,
            }),
          },
        })

        return { kind: 'added' as const, department, user }
      })

      if (result.kind === 'department_not_found') {
        res.status(404).json({ success: false, message: 'Department not found' })
        return
      }

      if (result.kind === 'invalid_user') {
        res.status(422).json({
          success: false,
          message: 'User must be an active agent or department head',
        })
        return
      }

      res.status(200).json({
        success: true,
        message: `${result.user.name} added to ${result.department.name}`,
      })
    } catch (error) {
      console.error('Department member add failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to add member to department',
      })
    }
  },
)

// --------------------------------------------------------------------------
// 10. DELETE /api/departments/:id/members/:userId - Remove member (Admin)
// --------------------------------------------------------------------------
departmentsRouter.delete(
  '/:id/members/:userId',
  authenticate,
  requireRole(UserRole.admin),
  async (req, res) => {
    const id = req.params.id
    const userId = req.params.userId
    if (typeof id !== 'string' || typeof userId !== 'string') {
      res.status(400).json({ success: false, message: 'Invalid request parameters' })
      return
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const department = await tx.department.findUnique({
          where: { id },
          select: { id: true, name: true, headId: true },
        })
        if (!department) return { kind: 'department_not_found' as const }

        const user = await tx.user.findFirst({
          where: { id: userId, departmentId: id },
          select: { id: true, name: true },
        })
        if (!user) return { kind: 'not_member' as const }

        // If this user was the designated department head, also clear headId on department
        if (department.headId === user.id) {
          await tx.department.update({
            where: { id },
            data: { headId: null },
          })
        }

        await tx.user.update({
          where: { id: user.id },
          data: { departmentId: null },
        })

        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'department.member_removed',
            details: JSON.stringify({
              departmentId: id,
              userId: user.id,
            }),
          },
        })

        return { kind: 'removed' as const, department, user }
      })

      if (result.kind === 'department_not_found') {
        res.status(404).json({ success: false, message: 'Department not found' })
        return
      }

      if (result.kind === 'not_member') {
        res.status(404).json({ success: false, message: 'User is not a member of this department' })
        return
      }

      res.status(200).json({
        success: true,
        message: `${result.user.name} removed from ${result.department.name}`,
      })
    } catch (error) {
      console.error('Department member removal failed:', error)
      res.status(500).json({
        success: false,
        message: 'Unable to remove member from department',
      })
    }
  },
)

export default departmentsRouter
