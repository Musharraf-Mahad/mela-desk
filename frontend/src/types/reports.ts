import type { TicketCategory, TicketPriority, TicketStatus } from './ticket'

export type DatePreset = 'today' | 'last_7_days' | 'last_30_days' | 'this_month' | 'previous_month' | 'custom'

export interface DateRangeInfo {
  preset: string
  from: string
  to: string
}

export interface ReportSummaryStats {
  total: number
  open: number
  inProgress: number
  pending: number
  resolved: number
  closed: number
  resolutionRate: number
  averageResolutionHours: number
  averageResolutionFormatted: string
}

export interface DistributionItem {
  count: number
  percentage: number
}

export interface StatusDistributionItem extends DistributionItem {
  status: TicketStatus
}

export interface PriorityDistributionItem extends DistributionItem {
  priority: TicketPriority
}

export interface CategoryDistributionItem extends DistributionItem {
  category: TicketCategory
}

export interface DepartmentDistributionItem {
  departmentId: string
  departmentName: string
  total: number
  open: number
  inProgress: number
  pending: number
  resolved: number
  closed: number
  resolutionRate: number
  averageResolutionHours: number
}

export interface VolumeTrendItem {
  date: string
  created: number
  resolved: number
}

export interface ReportsOverviewData {
  dateRange: DateRangeInfo
  summary: ReportSummaryStats
  byStatus: StatusDistributionItem[]
  byPriority: PriorityDistributionItem[]
  byCategory: CategoryDistributionItem[]
  byDepartment: DepartmentDistributionItem[]
  volumeOverTime: VolumeTrendItem[]
}

export interface ReportTicketItem {
  id: string
  ticketNumber: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  createdAt: string
  updatedAt: string
  resolutionHours: number | null
  guestName?: string | null
  guestEmail?: string | null
  customer?: {
    id: string
    name: string
    email: string
  } | null
  assignee?: {
    id: string
    name: string
    email: string
  } | null
  department?: {
    id: string
    name: string
  } | null
}

export interface DepartmentReportItem {
  id: string
  name: string
  headName: string | null
  headEmail: string | null
  memberCount: number
  total: number
  open: number
  inProgress: number
  pending: number
  resolved: number
  closed: number
  resolutionRate: number
  averageResolutionHours: number
  averageResolutionFormatted: string
}

export interface AgentPerformanceItem {
  id: string
  name: string
  email: string
  role: string
  departmentId: string | null
  departmentName: string
  totalAssigned: number
  open: number
  inProgress: number
  pending: number
  resolved: number
  closed: number
  resolutionRate: number
  averageResolutionHours: number
  averageResolutionFormatted: string
}

export interface ReportFilterParams {
  preset?: DatePreset
  startDate?: string
  endDate?: string
  departmentId?: string
  assigneeId?: string
  category?: TicketCategory
  priority?: TicketPriority
  status?: TicketStatus
  search?: string
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'ticketNumber' | 'priority' | 'status'
  sortOrder?: 'asc' | 'desc'
}
