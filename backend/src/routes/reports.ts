import { Prisma, TicketCategory, TicketPriority, TicketStatus, UserRole } from '@prisma/client'
import { Router, type Request, type Response } from 'express'
import ExcelJS from 'exceljs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, requireRole } from '../middleware/authenticate.js'

const datePresetSchema = z.enum([
  'today',
  'last_7_days',
  'last_30_days',
  'this_month',
  'previous_month',
  'custom',
]).default('last_30_days')

const reportQuerySchema = z.object({
  preset: datePresetSchema.optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  assigneeId: z.string().trim().optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
})

const ticketReportQuerySchema = reportQuerySchema.extend({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'ticketNumber', 'priority', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const exportQuerySchema = reportQuerySchema.extend({
  type: z.enum(['overview', 'tickets', 'departments', 'agents']).default('tickets'),
  search: z.string().trim().optional(),
})

export interface DateRange {
  from: Date
  to: Date
  preset: string
}

export function calculateDateRange(preset: string = 'last_30_days', startDate?: string, endDate?: string): DateRange {
  const now = new Date()

  if (preset === 'today') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return { from, to, preset }
  }

  if (preset === 'last_7_days') {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { from, to: now, preset }
  }

  if (preset === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    return { from, to: now, preset }
  }

  if (preset === 'previous_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
    const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    return { from, to, preset }
  }

  if (preset === 'custom' && startDate && endDate) {
    const from = new Date(startDate)
    const to = new Date(endDate)
    if (endDate.length <= 10) {
      to.setHours(23, 59, 59, 999)
    }
    return { from, to, preset }
  }

  // Default: last_30_days
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { from, to: now, preset: 'last_30_days' }
}

async function resolveUserDepartmentId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true, headedDepartment: { select: { id: true } } },
  })
  return user?.headedDepartment?.id ?? user?.departmentId ?? null
}

interface ScopedFiltersResult {
  departmentId?: string
  assigneeId?: string
  forbidden?: boolean
  forbiddenMessage?: string
}

async function resolveReportScoping(
  req: Request,
  requestedDepartmentId?: string,
  requestedAssigneeId?: string,
): Promise<ScopedFiltersResult> {
  const user = req.user!

  if (user.role === UserRole.admin || user.role === UserRole.head) {
    return {
      departmentId: requestedDepartmentId || undefined,
      assigneeId: requestedAssigneeId || undefined,
    }
  }

  if (user.role === UserRole.department_head) {
    const myDeptId = await resolveUserDepartmentId(user.id)
    if (!myDeptId) {
      return {
        forbidden: true,
        forbiddenMessage: 'No department assigned to this department head',
      }
    }

    if (requestedDepartmentId && requestedDepartmentId !== myDeptId) {
      return {
        forbidden: true,
        forbiddenMessage: 'Forbidden: You can only view reports for your own department',
      }
    }

    return {
      departmentId: myDeptId,
      assigneeId: requestedAssigneeId || undefined,
    }
  }

  if (user.role === UserRole.agent) {
    const myDeptId = await resolveUserDepartmentId(user.id)
    if (requestedDepartmentId && myDeptId && requestedDepartmentId !== myDeptId) {
      return {
        forbidden: true,
        forbiddenMessage: 'Forbidden: Agents cannot view reports for other departments',
      }
    }

    return {
      departmentId: myDeptId || requestedDepartmentId || undefined,
      assigneeId: requestedAssigneeId || undefined,
    }
  }

  return {
    forbidden: true,
    forbiddenMessage: 'Insufficient permissions to view reports',
  }
}

export function calculateResolutionStats(tickets: Array<{ status: TicketStatus; createdAt: Date; updatedAt: Date }>) {
  const total = tickets.length
  const open = tickets.filter((t) => t.status === TicketStatus.open).length
  const inProgress = tickets.filter((t) => t.status === TicketStatus.in_progress).length
  const pending = tickets.filter((t) => t.status === TicketStatus.pending).length
  const resolved = tickets.filter((t) => t.status === TicketStatus.resolved).length
  const closed = tickets.filter((t) => t.status === TicketStatus.closed).length

  const resolvedOrClosed = resolved + closed
  const resolutionRate = total > 0 ? Number(((resolvedOrClosed / total) * 100).toFixed(1)) : 0

  const resolvedTickets = tickets.filter(
    (t) => t.status === TicketStatus.resolved || t.status === TicketStatus.closed,
  )

  let averageResolutionHours = 0
  if (resolvedTickets.length > 0) {
    const totalHours = resolvedTickets.reduce((acc, t) => {
      const diffMs = Math.max(0, t.updatedAt.getTime() - t.createdAt.getTime())
      return acc + diffMs / (1000 * 60 * 60)
    }, 0)
    averageResolutionHours = Number((totalHours / resolvedTickets.length).toFixed(1))
  }

  const hoursInt = Math.floor(averageResolutionHours)
  const minutes = Math.round((averageResolutionHours % 1) * 60)
  const averageResolutionFormatted =
    averageResolutionHours > 0 ? `${hoursInt}h ${minutes}m` : '0h 0m'

  return {
    total,
    open,
    inProgress,
    pending,
    resolved,
    closed,
    resolutionRate,
    averageResolutionHours,
    averageResolutionFormatted,
  }
}

export const reportsRouter = Router()

// Common middleware for all reports routes
reportsRouter.use(
  authenticate,
  requireRole(UserRole.admin, UserRole.head, UserRole.department_head, UserRole.agent),
)

// ---------------------------------------------------------------------------
// 1. GET /api/reports/overview - High-level metrics, trends & distributions
// ---------------------------------------------------------------------------
reportsRouter.get('/overview', async (req: Request, res: Response) => {
  const parsed = reportQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid report query parameters',
      errors: parsed.error.issues,
    })
    return
  }

  try {
    const scoping = await resolveReportScoping(
      req,
      parsed.data.departmentId,
      parsed.data.assigneeId,
    )
    if (scoping.forbidden) {
      res.status(403).json({ success: false, message: scoping.forbiddenMessage })
      return
    }

    const dateRange = calculateDateRange(
      parsed.data.preset,
      parsed.data.startDate,
      parsed.data.endDate,
    )

    const baseWhere: Prisma.TicketWhereInput = {
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
      ...(scoping.departmentId ? { departmentId: scoping.departmentId } : {}),
      ...(scoping.assigneeId ? { assigneeId: scoping.assigneeId } : {}),
      ...(parsed.data.category ? { category: parsed.data.category } : {}),
      ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    }

    const tickets = await prisma.ticket.findMany({
      where: baseWhere,
      select: {
        id: true,
        status: true,
        priority: true,
        category: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: { id: true, name: true },
        },
      },
    })

    const summary = calculateResolutionStats(tickets)

    // Breakdown by Status
    const statusCounts: Record<TicketStatus, number> = {
      open: 0,
      in_progress: 0,
      pending: 0,
      resolved: 0,
      closed: 0,
    }
    for (const t of tickets) {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1
    }
    const byStatus = (Object.keys(statusCounts) as TicketStatus[]).map((st) => ({
      status: st,
      count: statusCounts[st],
      percentage: summary.total > 0 ? Number(((statusCounts[st] / summary.total) * 100).toFixed(1)) : 0,
    }))

    // Breakdown by Priority
    const priorityCounts: Record<TicketPriority, number> = {
      low: 0,
      normal: 0,
      high: 0,
      urgent: 0,
    }
    for (const t of tickets) {
      priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1
    }
    const byPriority = (Object.keys(priorityCounts) as TicketPriority[]).map((pr) => ({
      priority: pr,
      count: priorityCounts[pr],
      percentage: summary.total > 0 ? Number(((priorityCounts[pr] / summary.total) * 100).toFixed(1)) : 0,
    }))

    // Breakdown by Category
    const categoryCounts: Record<TicketCategory, number> = {
      billing: 0,
      account: 0,
      technical: 0,
      orders: 0,
      general: 0,
    }
    for (const t of tickets) {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1
    }
    const byCategory = (Object.keys(categoryCounts) as TicketCategory[]).map((cat) => ({
      category: cat,
      count: categoryCounts[cat],
      percentage: summary.total > 0 ? Number(((categoryCounts[cat] / summary.total) * 100).toFixed(1)) : 0,
    }))

    // Breakdown by Department
    const deptMap = new Map<string, { id: string; name: string; tickets: typeof tickets }>()
    for (const t of tickets) {
      const deptId = t.departmentId || 'unassigned'
      const deptName = t.department?.name || 'Unassigned'
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, { id: deptId, name: deptName, tickets: [] })
      }
      deptMap.get(deptId)!.tickets.push(t)
    }

    const byDepartment = Array.from(deptMap.values()).map((dept) => {
      const stats = calculateResolutionStats(dept.tickets)
      return {
        departmentId: dept.id,
        departmentName: dept.name,
        total: stats.total,
        open: stats.open,
        inProgress: stats.inProgress,
        pending: stats.pending,
        resolved: stats.resolved,
        closed: stats.closed,
        resolutionRate: stats.resolutionRate,
        averageResolutionHours: stats.averageResolutionHours,
      }
    })

    // Volume over time (grouped by day)
    const dailyMap = new Map<string, { created: number; resolved: number }>()
    for (const t of tickets) {
      const dayStr = t.createdAt.toISOString().slice(0, 10)
      if (!dailyMap.has(dayStr)) {
        dailyMap.set(dayStr, { created: 0, resolved: 0 })
      }
      dailyMap.get(dayStr)!.created += 1

      if (t.status === TicketStatus.resolved || t.status === TicketStatus.closed) {
        const resolvedDayStr = t.updatedAt.toISOString().slice(0, 10)
        if (!dailyMap.has(resolvedDayStr)) {
          dailyMap.set(resolvedDayStr, { created: 0, resolved: 0 })
        }
        dailyMap.get(resolvedDayStr)!.resolved += 1
      }
    }

    const volumeOverTime = Array.from(dailyMap.entries())
      .map(([date, counts]) => ({
        date,
        created: counts.created,
        resolved: counts.resolved,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          preset: dateRange.preset,
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
        },
        summary,
        byStatus,
        byPriority,
        byCategory,
        byDepartment,
        volumeOverTime,
      },
    })
  } catch (error) {
    console.error('Reports overview generation failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to generate reports overview',
    })
  }
})

// ---------------------------------------------------------------------------
// 2. GET /api/reports/tickets - Filterable & paginated ticket report
// ---------------------------------------------------------------------------
reportsRouter.get('/tickets', async (req: Request, res: Response) => {
  const parsed = ticketReportQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid ticket report query parameters',
      errors: parsed.error.issues,
    })
    return
  }

  try {
    const scoping = await resolveReportScoping(
      req,
      parsed.data.departmentId,
      parsed.data.assigneeId,
    )
    if (scoping.forbidden) {
      res.status(403).json({ success: false, message: scoping.forbiddenMessage })
      return
    }

    const dateRange = calculateDateRange(
      parsed.data.preset,
      parsed.data.startDate,
      parsed.data.endDate,
    )

    const { page, pageSize, search, sortBy, sortOrder } = parsed.data

    const where: Prisma.TicketWhereInput = {
      createdAt: {
        gte: dateRange.from,
        lte: dateRange.to,
      },
      ...(scoping.departmentId ? { departmentId: scoping.departmentId } : {}),
      ...(scoping.assigneeId ? { assigneeId: scoping.assigneeId } : {}),
      ...(parsed.data.category ? { category: parsed.data.category } : {}),
      ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(search
        ? {
            OR: [
              { ticketNumber: { contains: search } },
              { subject: { contains: search } },
              { description: { contains: search } },
              { guestName: { contains: search } },
              { guestEmail: { contains: search } },
              { customer: { name: { contains: search } } },
              { customer: { email: { contains: search } } },
            ],
          }
        : {}),
    }

    const [tickets, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          category: true,
          priority: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          guestName: true,
          guestEmail: true,
          customer: {
            select: { id: true, name: true, email: true },
          },
          assignee: {
            select: { id: true, name: true, email: true },
          },
          department: {
            select: { id: true, name: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ])

    const ticketsWithMetrics = tickets.map((t) => {
      let resolutionHours: number | null = null
      if (t.status === TicketStatus.resolved || t.status === TicketStatus.closed) {
        resolutionHours = Number(
          (Math.max(0, t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)).toFixed(1),
        )
      }
      return {
        ...t,
        resolutionHours,
      }
    })

    res.status(200).json({
      success: true,
      data: {
        tickets: ticketsWithMetrics,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    })
  } catch (error) {
    console.error('Ticket report query failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve ticket reports',
    })
  }
})

// ---------------------------------------------------------------------------
// 3. GET /api/reports/departments - Department-level metrics
// ---------------------------------------------------------------------------
reportsRouter.get('/departments', async (req: Request, res: Response) => {
  const parsed = reportQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid department report parameters',
      errors: parsed.error.issues,
    })
    return
  }

  try {
    const scoping = await resolveReportScoping(
      req,
      parsed.data.departmentId,
      parsed.data.assigneeId,
    )
    if (scoping.forbidden) {
      res.status(403).json({ success: false, message: scoping.forbiddenMessage })
      return
    }

    const dateRange = calculateDateRange(
      parsed.data.preset,
      parsed.data.startDate,
      parsed.data.endDate,
    )

    const deptWhere: Prisma.DepartmentWhereInput = {
      ...(scoping.departmentId ? { id: scoping.departmentId } : {}),
    }

    const departments = await prisma.department.findMany({
      where: deptWhere,
      select: {
        id: true,
        name: true,
        description: true,
        head: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const departmentReports = await Promise.all(
      departments.map(async (dept) => {
        const tickets = await prisma.ticket.findMany({
          where: {
            departmentId: dept.id,
            createdAt: {
              gte: dateRange.from,
              lte: dateRange.to,
            },
            ...(parsed.data.category ? { category: parsed.data.category } : {}),
            ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
            ...(parsed.data.status ? { status: parsed.data.status } : {}),
          },
          select: {
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        })

        const stats = calculateResolutionStats(tickets)

        return {
          id: dept.id,
          name: dept.name,
          headName: dept.head?.name || null,
          headEmail: dept.head?.email || null,
          memberCount: dept._count.members,
          ...stats,
        }
      }),
    )

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          preset: dateRange.preset,
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
        },
        departments: departmentReports,
      },
    })
  } catch (error) {
    console.error('Department reports lookup failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to generate department reports',
    })
  }
})

// ---------------------------------------------------------------------------
// 4. GET /api/reports/agents - Agent performance reports
// ---------------------------------------------------------------------------
reportsRouter.get('/agents', async (req: Request, res: Response) => {
  const parsed = reportQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid agent report parameters',
      errors: parsed.error.issues,
    })
    return
  }

  try {
    const scoping = await resolveReportScoping(
      req,
      parsed.data.departmentId,
      parsed.data.assigneeId,
    )
    if (scoping.forbidden) {
      res.status(403).json({ success: false, message: scoping.forbiddenMessage })
      return
    }

    const dateRange = calculateDateRange(
      parsed.data.preset,
      parsed.data.startDate,
      parsed.data.endDate,
    )

    const userWhere: Prisma.UserWhereInput = {
      role: { in: [UserRole.agent, UserRole.department_head] },
      isActive: true,
      ...(scoping.departmentId ? { departmentId: scoping.departmentId } : {}),
      ...(scoping.assigneeId ? { id: scoping.assigneeId } : {}),
    }

    const agents = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const agentReports = await Promise.all(
      agents.map(async (agent) => {
        const tickets = await prisma.ticket.findMany({
          where: {
            assigneeId: agent.id,
            createdAt: {
              gte: dateRange.from,
              lte: dateRange.to,
            },
            ...(scoping.departmentId ? { departmentId: scoping.departmentId } : {}),
            ...(parsed.data.category ? { category: parsed.data.category } : {}),
            ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
            ...(parsed.data.status ? { status: parsed.data.status } : {}),
          },
          select: {
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        })

        const stats = calculateResolutionStats(tickets)

        return {
          id: agent.id,
          name: agent.name,
          email: agent.email,
          role: agent.role,
          departmentId: agent.department?.id || null,
          departmentName: agent.department?.name || 'Unassigned',
          totalAssigned: stats.total,
          open: stats.open,
          inProgress: stats.inProgress,
          pending: stats.pending,
          resolved: stats.resolved,
          closed: stats.closed,
          resolutionRate: stats.resolutionRate,
          averageResolutionHours: stats.averageResolutionHours,
          averageResolutionFormatted: stats.averageResolutionFormatted,
        }
      }),
    )

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          preset: dateRange.preset,
          from: dateRange.from.toISOString(),
          to: dateRange.to.toISOString(),
        },
        agents: agentReports,
      },
    })
  } catch (error) {
    console.error('Agent performance reports lookup failed:', error)
    res.status(500).json({
      success: false,
      message: 'Unable to generate agent performance reports',
    })
  }
})

// ---------------------------------------------------------------------------
// 5. GET /api/reports/export - Real Excel (.xlsx) export
// ---------------------------------------------------------------------------
reportsRouter.get('/export', async (req: Request, res: Response) => {
  const parsed = exportQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: 'Invalid export query parameters',
      errors: parsed.error.issues,
    })
    return
  }

  try {
    const scoping = await resolveReportScoping(
      req,
      parsed.data.departmentId,
      parsed.data.assigneeId,
    )
    if (scoping.forbidden) {
      res.status(403).json({ success: false, message: scoping.forbiddenMessage })
      return
    }

    const dateRange = calculateDateRange(
      parsed.data.preset,
      parsed.data.startDate,
      parsed.data.endDate,
    )

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'MelaDesk Support System'
    workbook.created = new Date()

    const exportType = parsed.data.type
    const timestampStr = new Date().toISOString().slice(0, 10)

    if (exportType === 'tickets') {
      const sheet = workbook.addWorksheet('Tickets Report')
      sheet.views = [{ state: 'frozen', ySplit: 1 }]

      sheet.columns = [
        { header: 'Ticket #', key: 'ticketNumber', width: 16 },
        { header: 'Subject', key: 'subject', width: 34 },
        { header: 'Category', key: 'category', width: 16 },
        { header: 'Priority', key: 'priority', width: 14 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Department', key: 'department', width: 22 },
        { header: 'Customer', key: 'customer', width: 26 },
        { header: 'Assignee', key: 'assignee', width: 26 },
        { header: 'Created At', key: 'createdAt', width: 22 },
        { header: 'Updated At', key: 'updatedAt', width: 22 },
        { header: 'Resolution Time (hrs)', key: 'resolutionHours', width: 22 },
      ]

      // Format header row
      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' },
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

      const search = parsed.data.search
      const where: Prisma.TicketWhereInput = {
        createdAt: {
          gte: dateRange.from,
          lte: dateRange.to,
        },
        ...(scoping.departmentId ? { departmentId: scoping.departmentId } : {}),
        ...(scoping.assigneeId ? { assigneeId: scoping.assigneeId } : {}),
        ...(parsed.data.category ? { category: parsed.data.category } : {}),
        ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(search
          ? {
              OR: [
                { ticketNumber: { contains: search } },
                { subject: { contains: search } },
                { description: { contains: search } },
                { guestName: { contains: search } },
                { guestEmail: { contains: search } },
                { customer: { name: { contains: search } } },
              ],
            }
          : {}),
      }

      const tickets = await prisma.ticket.findMany({
        where,
        select: {
          ticketNumber: true,
          subject: true,
          category: true,
          priority: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          guestName: true,
          guestEmail: true,
          customer: { select: { name: true, email: true } },
          assignee: { select: { name: true, email: true } },
          department: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      for (const t of tickets) {
        let resHours: number | string = '-'
        if (t.status === TicketStatus.resolved || t.status === TicketStatus.closed) {
          resHours = Number(
            (Math.max(0, t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)).toFixed(1),
          )
        }

        const customerInfo = t.customer
          ? `${t.customer.name} (${t.customer.email})`
          : t.guestName
            ? `${t.guestName} (${t.guestEmail || 'Guest'})`
            : 'Anonymous'

        const assigneeInfo = t.assignee ? `${t.assignee.name} (${t.assignee.email})` : 'Unassigned'

        sheet.addRow({
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          category: t.category,
          priority: t.priority,
          status: t.status,
          department: t.department?.name || 'Unassigned',
          customer: customerInfo,
          assignee: assigneeInfo,
          createdAt: t.createdAt.toISOString().replace('T', ' ').slice(0, 19),
          updatedAt: t.updatedAt.toISOString().replace('T', ' ').slice(0, 19),
          resolutionHours: resHours,
        })
      }
    } else if (exportType === 'departments') {
      const sheet = workbook.addWorksheet('Department Report')
      sheet.views = [{ state: 'frozen', ySplit: 1 }]

      sheet.columns = [
        { header: 'Department Name', key: 'name', width: 26 },
        { header: 'Department Head', key: 'head', width: 26 },
        { header: 'Team Members', key: 'members', width: 16 },
        { header: 'Total Tickets', key: 'total', width: 16 },
        { header: 'Open', key: 'open', width: 12 },
        { header: 'In Progress', key: 'inProgress', width: 14 },
        { header: 'Pending', key: 'pending', width: 12 },
        { header: 'Resolved', key: 'resolved', width: 12 },
        { header: 'Closed', key: 'closed', width: 12 },
        { header: 'Resolution Rate (%)', key: 'resolutionRate', width: 20 },
        { header: 'Avg Resolution (hrs)', key: 'avgResolution', width: 20 },
      ]

      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' },
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

      const deptWhere: Prisma.DepartmentWhereInput = {
        ...(scoping.departmentId ? { id: scoping.departmentId } : {}),
      }

      const departments = await prisma.department.findMany({
        where: deptWhere,
        select: {
          id: true,
          name: true,
          head: { select: { name: true, email: true } },
          _count: { select: { members: true } },
        },
        orderBy: { name: 'asc' },
      })

      for (const dept of departments) {
        const tickets = await prisma.ticket.findMany({
          where: {
            departmentId: dept.id,
            createdAt: { gte: dateRange.from, lte: dateRange.to },
          },
          select: { status: true, createdAt: true, updatedAt: true },
        })

        const stats = calculateResolutionStats(tickets)

        sheet.addRow({
          name: dept.name,
          head: dept.head ? `${dept.head.name} (${dept.head.email})` : 'None',
          members: dept._count.members,
          total: stats.total,
          open: stats.open,
          inProgress: stats.inProgress,
          pending: stats.pending,
          resolved: stats.resolved,
          closed: stats.closed,
          resolutionRate: `${stats.resolutionRate}%`,
          avgResolution: stats.averageResolutionHours,
        })
      }
    } else if (exportType === 'agents') {
      const sheet = workbook.addWorksheet('Agent Performance')
      sheet.views = [{ state: 'frozen', ySplit: 1 }]

      sheet.columns = [
        { header: 'Agent Name', key: 'name', width: 24 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Role', key: 'role', width: 18 },
        { header: 'Department', key: 'department', width: 22 },
        { header: 'Total Assigned', key: 'total', width: 16 },
        { header: 'Open', key: 'open', width: 12 },
        { header: 'In Progress', key: 'inProgress', width: 14 },
        { header: 'Pending', key: 'pending', width: 12 },
        { header: 'Resolved', key: 'resolved', width: 12 },
        { header: 'Closed', key: 'closed', width: 12 },
        { header: 'Resolution Rate (%)', key: 'resolutionRate', width: 20 },
        { header: 'Avg Resolution (hrs)', key: 'avgResolution', width: 20 },
      ]

      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' },
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

      const userWhere: Prisma.UserWhereInput = {
        role: { in: [UserRole.agent, UserRole.department_head] },
        isActive: true,
        ...(scoping.departmentId ? { departmentId: scoping.departmentId } : {}),
      }

      const agents = await prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      })

      for (const agent of agents) {
        const tickets = await prisma.ticket.findMany({
          where: {
            assigneeId: agent.id,
            createdAt: { gte: dateRange.from, lte: dateRange.to },
          },
          select: { status: true, createdAt: true, updatedAt: true },
        })

        const stats = calculateResolutionStats(tickets)

        sheet.addRow({
          name: agent.name,
          email: agent.email,
          role: agent.role,
          department: agent.department?.name || 'Unassigned',
          total: stats.total,
          open: stats.open,
          inProgress: stats.inProgress,
          pending: stats.pending,
          resolved: stats.resolved,
          closed: stats.closed,
          resolutionRate: `${stats.resolutionRate}%`,
          avgResolution: stats.averageResolutionHours,
        })
      }
    } else {
      // overview summary sheet
      const sheet = workbook.addWorksheet('Summary KPI Overview')
      sheet.views = [{ state: 'frozen', ySplit: 1 }]

      sheet.columns = [
        { header: 'Metric', key: 'metric', width: 32 },
        { header: 'Value', key: 'value', width: 24 },
      ]

      const headerRow = sheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' },
      }

      const tickets = await prisma.ticket.findMany({
        where: {
          createdAt: { gte: dateRange.from, lte: dateRange.to },
          ...(scoping.departmentId ? { departmentId: scoping.departmentId } : {}),
        },
        select: { status: true, createdAt: true, updatedAt: true },
      })

      const stats = calculateResolutionStats(tickets)

      sheet.addRow({ metric: 'Report Preset', value: dateRange.preset })
      sheet.addRow({ metric: 'From Date', value: dateRange.from.toISOString().slice(0, 10) })
      sheet.addRow({ metric: 'To Date', value: dateRange.to.toISOString().slice(0, 10) })
      sheet.addRow({ metric: 'Total Tickets', value: stats.total })
      sheet.addRow({ metric: 'Open Tickets', value: stats.open })
      sheet.addRow({ metric: 'In Progress Tickets', value: stats.inProgress })
      sheet.addRow({ metric: 'Pending Tickets', value: stats.pending })
      sheet.addRow({ metric: 'Resolved Tickets', value: stats.resolved })
      sheet.addRow({ metric: 'Closed Tickets', value: stats.closed })
      sheet.addRow({ metric: 'Resolution Rate (%)', value: `${stats.resolutionRate}%` })
      sheet.addRow({ metric: 'Average Resolution Time (hrs)', value: stats.averageResolutionHours })
      sheet.addRow({ metric: 'Average Resolution Time (formatted)', value: stats.averageResolutionFormatted })
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="meladesk-${exportType}-report-${timestampStr}.xlsx"`,
    )

    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error('Reports export failed:', error)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Unable to export report',
      })
    }
  }
})

export default reportsRouter
