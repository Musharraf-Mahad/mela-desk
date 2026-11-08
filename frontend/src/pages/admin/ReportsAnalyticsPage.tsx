import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { reportsApi, type PaginatedTicketsReportResponse } from '../../api/reports.api';
import { departmentApi } from '../../api/departments.api';
import type {
  ReportsOverviewData,
  DepartmentReportItem,
  AgentPerformanceItem,
  DatePreset,
} from '../../types/reports';
import type { Department } from '../../types/auth';
import type { TicketCategory, TicketPriority, TicketStatus } from '../../types/ticket';

import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import { Select } from '../../components/common/Select';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { StatusBadge, PriorityBadge } from '../../components/common/Badge';

import {
  BarChart3,
  TrendingUp,
  Clock,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  PieChart,
} from 'lucide-react';

export function ReportsAnalyticsPage() {
  const { t } = useTranslation();
  const { user, role } = useAuth();

  // Active Tab: 'overview' | 'tickets' | 'departments' | 'agents'
  const [activeTab, setActiveTab] = useState<'overview' | 'tickets' | 'departments' | 'agents'>('overview');

  // Filter States
  const [preset, setPreset] = useState<DatePreset>('last_30_days');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [priority, setPriority] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Pagination & Sorting for Tickets Tab
  const [ticketPage, setTicketPage] = useState<number>(1);
  const [sortBy] = useState<'createdAt' | 'ticketNumber' | 'priority' | 'status'>('createdAt');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

  // Data States
  const [overviewData, setOverviewData] = useState<ReportsOverviewData | null>(null);
  const [ticketsData, setTicketsData] = useState<PaginatedTicketsReportResponse | null>(null);
  const [departmentsData, setDepartmentsData] = useState<DepartmentReportItem[]>([]);
  const [agentsData, setAgentsData] = useState<AgentPerformanceItem[]>([]);
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Scoping helpers
  const isDeptHead = role === 'department_head';
  const isAgent = role === 'agent';
  const isScoped = isDeptHead || isAgent;
  const userDeptId = user?.departmentId;

  // Load department options for filter (if Admin / Head)
  useEffect(() => {
    if (!isScoped) {
      departmentApi
        .getDepartments({ pageSize: 100 })
        .then((res) => {
          setDepartmentsList(res.departments);
        })
        .catch((err) => {
          console.error('Failed to load departments for filter', err);
        });
    }
  }, [isScoped]);

  // Construct active filter params
  const getFilterParams = useCallback(() => {
    return {
      preset,
      startDate: preset === 'custom' && startDate ? startDate : undefined,
      endDate: preset === 'custom' && endDate ? endDate : undefined,
      departmentId: isScoped ? (userDeptId || undefined) : departmentId === 'all' ? undefined : departmentId,
      category: category === 'all' ? undefined : (category as TicketCategory),
      priority: priority === 'all' ? undefined : (priority as TicketPriority),
      status: status === 'all' ? undefined : (status as TicketStatus),
    };
  }, [preset, startDate, endDate, departmentId, category, priority, status, isScoped, userDeptId]);

  // Fetch data for active tab
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = getFilterParams();

    try {
      if (activeTab === 'overview') {
        const data = await reportsApi.getOverview(params);
        setOverviewData(data);
      } else if (activeTab === 'tickets') {
        const data = await reportsApi.getTickets({
          ...params,
          search: search.trim() || undefined,
          page: ticketPage,
          pageSize: 15,
          sortBy,
          sortOrder,
        });
        setTicketsData(data);
      } else if (activeTab === 'departments') {
        const depts = await reportsApi.getDepartments(params);
        setDepartmentsData(depts);
      } else if (activeTab === 'agents') {
        const agents = await reportsApi.getAgents(params);
        setAgentsData(agents);
      }
    } catch (err: unknown) {
      console.error('Report fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch report data');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, getFilterParams, search, ticketPage, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Export to Excel handler
  const handleExport = async (type: 'overview' | 'tickets' | 'departments' | 'agents') => {
    setIsExporting(true);
    try {
      const params = {
        ...getFilterParams(),
        search: search.trim() || undefined,
      };
      await reportsApi.exportReport(type, params);
    } catch (err: unknown) {
      console.error('Export error:', err);
      alert(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  // Helper colors for status progress bar
  const statusColors: Record<TicketStatus, string> = {
    open: 'bg-blue-500',
    in_progress: 'bg-amber-500',
    pending: 'bg-indigo-500',
    resolved: 'bg-emerald-500',
    closed: 'bg-slate-400',
  };

  // Helper colors for priority bars
  const priorityColors: Record<TicketPriority, string> = {
    urgent: 'bg-rose-500',
    high: 'bg-orange-500',
    normal: 'bg-sky-500',
    low: 'bg-slate-400',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
              {t('reports.title', 'Reports & Analytics')}
            </h1>
            {isScoped ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Building2 className="w-3 h-3" />
                {t('reports.departmentScope', 'Department Scope')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Building2 className="w-3 h-3" />
                {t('reports.organizationScope', 'Organization Wide')}
              </span>
            )}
          </div>
          <p className="text-sm text-[#64748B] mt-0.5">
            {t('reports.subtitle', 'Performance metrics, ticket resolution statistics, and exportable reports')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData()}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            {t('common.refresh', 'Refresh')}
          </Button>

          {/* Export Dropdown */}
          <div className="relative inline-block text-left group">
            <Button
              variant="primary"
              size="sm"
              disabled={isExporting}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
              {isExporting ? t('reports.exporting', 'Exporting...') : t('reports.exportExcel', 'Export to Excel (.xlsx)')}
            </Button>
            <div className="absolute right-0 mt-1 w-56 bg-white border border-[#E2E8F0] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-20">
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => handleExport('tickets')}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>{t('reports.exportTickets', 'Tickets Report (.xlsx)')}</span>
                  <Download className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('overview')}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>{t('reports.exportSummary', 'Summary KPIs (.xlsx)')}</span>
                  <Download className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('departments')}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>{t('reports.exportDepartments', 'Departments Report (.xlsx)')}</span>
                  <Download className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('agents')}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span>{t('reports.exportAgents', 'Agents Performance (.xlsx)')}</span>
                  <Download className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Alert type="error" className="flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={() => fetchData()}>
            {t('common.retry', 'Retry')}
          </Button>
        </Alert>
      )}

      {/* Filter Toolbar */}
      <Card className="border-[#E2E8F0] shadow-2xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" />
            <span>{t('reports.filters', 'Report Filters & Date Range')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Date Preset */}
            <Select
              label={t('reports.datePreset', 'Date Range')}
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value as DatePreset);
                setTicketPage(1);
              }}
              options={[
                { value: 'today', label: t('reports.today', 'Today') },
                { value: 'last_7_days', label: t('reports.last7Days', 'Last 7 Days') },
                { value: 'last_30_days', label: t('reports.last30Days', 'Last 30 Days') },
                { value: 'this_month', label: t('reports.thisMonth', 'This Month') },
                { value: 'previous_month', label: t('reports.previousMonth', 'Previous Month') },
                { value: 'custom', label: t('reports.customRange', 'Custom Date Range...') },
              ]}
            />

            {/* Department Filter (Only for Admin/Head) */}
            {!isScoped ? (
              <Select
                label={t('reports.department', 'Department')}
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setTicketPage(1);
                }}
                options={[
                  { value: 'all', label: t('reports.allDepartments', 'All Departments') },
                  ...departmentsList.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t('reports.department', 'Department')}
                </label>
                <div className="h-9 px-3 flex items-center bg-slate-100 border border-slate-200 rounded-md text-xs font-medium text-slate-600">
                  {user?.department?.name || t('reports.myDepartment', 'My Department')}
                </div>
              </div>
            )}

            {/* Status Filter */}
            <Select
              label={t('tickets.status', 'Status')}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setTicketPage(1);
              }}
              options={[
                { value: 'all', label: t('status.all', 'All Statuses') },
                { value: 'open', label: t('status.open', 'Open') },
                { value: 'in_progress', label: t('status.in_progress', 'In Progress') },
                { value: 'pending', label: t('status.pending', 'Pending') },
                { value: 'resolved', label: t('status.resolved', 'Resolved') },
                { value: 'closed', label: t('status.closed', 'Closed') },
              ]}
            />

            {/* Priority Filter */}
            <Select
              label={t('tickets.priority', 'Priority')}
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setTicketPage(1);
              }}
              options={[
                { value: 'all', label: t('priority.all', 'All Priorities') },
                { value: 'urgent', label: t('priority.urgent', 'Urgent') },
                { value: 'high', label: t('priority.high', 'High') },
                { value: 'normal', label: t('priority.normal', 'Normal') },
                { value: 'low', label: t('priority.low', 'Low') },
              ]}
            />

            {/* Category Filter */}
            <Select
              label={t('tickets.category', 'Category')}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setTicketPage(1);
              }}
              options={[
                { value: 'all', label: t('categories.all', 'All Categories') },
                { value: 'billing', label: t('categories.billing', 'Billing') },
                { value: 'account', label: t('categories.account', 'Account') },
                { value: 'technical', label: t('categories.technical', 'Technical') },
                { value: 'orders', label: t('categories.orders', 'Orders') },
                { value: 'general', label: t('categories.general', 'General') },
              ]}
            />

            {/* Reset Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full text-xs h-9"
                onClick={() => {
                  setPreset('last_30_days');
                  setStartDate('');
                  setEndDate('');
                  setDepartmentId('all');
                  setCategory('all');
                  setPriority('all');
                  setStatus('all');
                  setSearch('');
                  setTicketPage(1);
                }}
              >
                {t('common.reset', 'Reset Filters')}
              </Button>
            </div>
          </div>

          {/* Custom Date Inputs if preset === 'custom' */}
          {preset === 'custom' && (
            <div className="pt-2 border-t border-slate-100 flex items-center gap-3 flex-wrap">
              <div className="w-48">
                <Input
                  label={t('reports.startDate', 'Start Date')}
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="w-48">
                <Input
                  label={t('reports.endDate', 'End Date')}
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="pt-5">
                <Button size="sm" onClick={() => fetchData()}>
                  {t('reports.applyDateRange', 'Apply Dates')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          {t('reports.overviewTab', 'Overview & Analytics')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'tickets'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Search className="w-4 h-4" />
          {t('reports.ticketsTab', 'Ticket Reports')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('departments')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'departments'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          {t('reports.departmentsTab', 'Department Reports')}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'agents'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          {t('reports.agentsTab', 'Agent Performance')}
        </button>
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metric Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <StatCard
              title={t('reports.totalTickets', 'Total Tickets')}
              value={isLoading ? '...' : String(overviewData?.summary.total ?? 0)}
              icon={<BarChart3 className="w-4 h-4 text-blue-600" />}
            />
            <StatCard
              title={t('reports.openTickets', 'Open')}
              value={isLoading ? '...' : String(overviewData?.summary.open ?? 0)}
              icon={<AlertTriangle className="w-4 h-4 text-blue-500" />}
            />
            <StatCard
              title={t('reports.inProgress', 'In Progress')}
              value={isLoading ? '...' : String(overviewData?.summary.inProgress ?? 0)}
              icon={<Clock className="w-4 h-4 text-amber-500" />}
            />
            <StatCard
              title={t('reports.pending', 'Pending')}
              value={isLoading ? '...' : String(overviewData?.summary.pending ?? 0)}
              icon={<Clock className="w-4 h-4 text-indigo-500" />}
            />
            <StatCard
              title={t('reports.resolved', 'Resolved')}
              value={isLoading ? '...' : String(overviewData?.summary.resolved ?? 0)}
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            />
            <StatCard
              title={t('reports.closed', 'Closed')}
              value={isLoading ? '...' : String(overviewData?.summary.closed ?? 0)}
              icon={<CheckCircle2 className="w-4 h-4 text-slate-500" />}
            />
            <StatCard
              title={t('reports.resolutionRate', 'Resolution Rate')}
              value={isLoading ? '...' : `${overviewData?.summary.resolutionRate ?? 0}%`}
              icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
            />
            <StatCard
              title={t('reports.avgResolutionTime', 'Avg Resolution')}
              value={isLoading ? '...' : overviewData?.summary.averageResolutionFormatted ?? '0h 0m'}
              icon={<Clock className="w-4 h-4 text-purple-600" />}
            />
          </div>

          {/* Visual Breakdown Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Breakdown */}
            <Card className="border-[#E2E8F0]">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-blue-600" />
                  {t('reports.statusBreakdown', 'Status Distribution')}
                </CardTitle>
                <span className="text-xs text-slate-400">
                  {overviewData?.summary.total ?? 0} {t('tickets.total', 'total')}
                </span>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Horizontal Combined Progress Bar */}
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  {overviewData?.byStatus.map((st) => (
                    <div
                      key={st.status}
                      className={`h-full ${statusColors[st.status]}`}
                      style={{ width: `${st.percentage}%` }}
                      title={`${st.status}: ${st.count} (${st.percentage}%)`}
                    />
                  ))}
                </div>

                {/* Status Items List */}
                <div className="space-y-2">
                  {overviewData?.byStatus.map((st) => (
                    <div key={st.status} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${statusColors[st.status]}`} />
                        <span className="font-medium text-slate-700 capitalize">
                          {st.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500">{st.count}</span>
                        <span className="font-semibold text-slate-700 w-12 text-right">
                          {st.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Priority Breakdown */}
            <Card className="border-[#E2E8F0]">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  {t('reports.priorityBreakdown', 'Priority Distribution')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {overviewData?.byPriority.map((pr) => (
                  <div key={pr.priority} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 capitalize">{pr.priority}</span>
                      <span className="text-slate-500 font-semibold">
                        {pr.count} ({pr.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${priorityColors[pr.priority]}`}
                        style={{ width: `${pr.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card className="border-[#E2E8F0]">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  {t('reports.categoryBreakdown', 'Category Distribution')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {overviewData?.byCategory.map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 capitalize">{cat.category}</span>
                      <span className="text-slate-500 font-semibold">
                        {cat.count} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Department Breakdown */}
            <Card className="border-[#E2E8F0]">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  {t('reports.departmentBreakdown', 'Department Ticket Distribution')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {overviewData?.byDepartment.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    {t('reports.noDeptData', 'No department data for this period.')}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {overviewData?.byDepartment.map((dept) => (
                      <div key={dept.departmentId} className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1">
                          <span>{dept.departmentName}</span>
                          <span className="text-emerald-700 font-bold">
                            {dept.resolutionRate}% {t('reports.resolved', 'Resolved')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500">
                          <span>Total: <strong className="text-slate-700">{dept.total}</strong></span>
                          <span>Open: <strong className="text-slate-700">{dept.open}</strong></span>
                          <span>In Progress: <strong className="text-slate-700">{dept.inProgress}</strong></span>
                          <span>Resolved: <strong className="text-slate-700">{dept.resolved}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Volume Over Time / Trend Card */}
          <Card className="border-[#E2E8F0]">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                {t('reports.volumeTrend', 'Daily Volume Trend (Created vs Resolved)')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {!overviewData?.volumeOverTime || overviewData.volumeOverTime.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  {t('reports.noTrendData', 'No ticket volume recorded in this time range.')}
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Legend */}
                  <div className="flex items-center justify-end gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-blue-500 rounded-xs" />
                      <span className="text-slate-600 font-medium">{t('reports.created', 'Created')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-emerald-500 rounded-xs" />
                      <span className="text-slate-600 font-medium">{t('reports.resolved', 'Resolved')}</span>
                    </div>
                  </div>

                  {/* Daily Trend Bars */}
                  <div className="space-y-2">
                    {overviewData.volumeOverTime.map((item) => {
                      const maxVol = Math.max(
                        ...overviewData.volumeOverTime.map((v) => Math.max(v.created, v.resolved)),
                        1
                      );
                      const createdWidth = Math.max(4, Math.round((item.created / maxVol) * 100));
                      const resolvedWidth = Math.max(4, Math.round((item.resolved / maxVol) * 100));

                      return (
                        <div key={item.date} className="flex items-center gap-3 text-xs">
                          <span className="w-24 text-slate-500 font-mono text-[11px] shrink-0">
                            {item.date}
                          </span>
                          <div className="flex-1 space-y-1">
                            {item.created > 0 && (
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2 bg-blue-500 rounded-xs transition-all"
                                  style={{ width: `${createdWidth}%` }}
                                />
                                <span className="text-[10px] text-blue-700 font-medium">
                                  {item.created}
                                </span>
                              </div>
                            )}
                            {item.resolved > 0 && (
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2 bg-emerald-500 rounded-xs transition-all"
                                  style={{ width: `${resolvedWidth}%` }}
                                />
                                <span className="text-[10px] text-emerald-700 font-medium">
                                  {item.resolved}
                                </span>
                              </div>
                            )}
                            {item.created === 0 && item.resolved === 0 && (
                              <div className="h-2 bg-slate-100 rounded-xs w-4" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: DETAILED TICKET REPORTS */}
      {activeTab === 'tickets' && (
        <Card className="border-[#E2E8F0]">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">
                {t('reports.ticketTableTitle', 'Filtered Ticket Reports')}
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {ticketsData?.pagination.total ?? 0} {t('reports.matchingTickets', 'tickets matching current filters')}
              </p>
            </div>

            {/* Ticket Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
              <input
                type="text"
                placeholder={t('reports.searchPlaceholder', 'Search tickets, subject, customer...')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setTicketPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-4">{t('tickets.ticketNumber', 'Ticket #')}</th>
                    <th className="py-2.5 px-4">{t('tickets.subject', 'Subject')}</th>
                    <th className="py-2.5 px-3">{t('tickets.category', 'Category')}</th>
                    <th className="py-2.5 px-3">{t('tickets.priority', 'Priority')}</th>
                    <th className="py-2.5 px-3">{t('tickets.status', 'Status')}</th>
                    <th className="py-2.5 px-3">{t('tickets.department', 'Department')}</th>
                    <th className="py-2.5 px-4">{t('tickets.customer', 'Customer')}</th>
                    <th className="py-2.5 px-4">{t('tickets.assignee', 'Assignee')}</th>
                    <th className="py-2.5 px-3">{t('tickets.created', 'Created')}</th>
                    <th className="py-2.5 px-3">{t('reports.resolutionTime', 'Res. Time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                        <span>{t('common.loading', 'Loading tickets...')}</span>
                      </td>
                    </tr>
                  ) : ticketsData?.tickets.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500">
                        {t('reports.noTicketsMatched', 'No tickets match the selected filters or date range.')}
                      </td>
                    </tr>
                  ) : (
                    ticketsData?.tickets.map((tkt) => (
                      <tr key={tkt.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-4 font-mono font-medium text-blue-600">
                          {tkt.ticketNumber}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800 max-w-xs truncate" title={tkt.subject}>
                          {tkt.subject}
                        </td>
                        <td className="py-2.5 px-3 capitalize text-slate-600">{tkt.category}</td>
                        <td className="py-2.5 px-3">
                          <PriorityBadge priority={tkt.priority} />
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={tkt.status} />
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {tkt.department?.name || <span className="text-slate-400 italic">None</span>}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">
                          {tkt.customer ? (
                            <div>
                              <div className="font-medium">{tkt.customer.name}</div>
                              <div className="text-[10px] text-slate-400">{tkt.customer.email}</div>
                            </div>
                          ) : tkt.guestName ? (
                            <div>
                              <div className="font-medium">{tkt.guestName}</div>
                              <div className="text-[10px] text-slate-400">{tkt.guestEmail || 'Guest'}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Anonymous</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">
                          {tkt.assignee ? (
                            <span className="font-medium">{tkt.assignee.name}</span>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(tkt.createdAt).toISOString().slice(0, 10)}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                          {tkt.resolutionHours !== null ? `${tkt.resolutionHours}h` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {ticketsData && ticketsData.pagination.totalPages > 1 && (
              <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {t('reports.pageIndicator', 'Page {{current}} of {{total}}', {
                    current: ticketsData.pagination.page,
                    total: ticketsData.pagination.totalPages,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={ticketPage <= 1}
                    onClick={() => setTicketPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {t('common.prev', 'Previous')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={ticketPage >= ticketsData.pagination.totalPages}
                    onClick={() => setTicketPage((p) => p + 1)}
                  >
                    {t('common.next', 'Next')}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: DEPARTMENT REPORTS */}
      {activeTab === 'departments' && (
        <Card className="border-[#E2E8F0]">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              {t('reports.departmentReportsTitle', 'Department Resolution & Workload Reports')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-4">{t('departments.departmentName', 'Department')}</th>
                    <th className="py-2.5 px-4">{t('departments.departmentHead', 'Department Head')}</th>
                    <th className="py-2.5 px-3 text-center">{t('departments.membersCount', 'Agents')}</th>
                    <th className="py-2.5 px-3 text-center">{t('reports.totalTickets', 'Total')}</th>
                    <th className="py-2.5 px-3 text-center">{t('status.open', 'Open')}</th>
                    <th className="py-2.5 px-3 text-center">{t('status.in_progress', 'In Progress')}</th>
                    <th className="py-2.5 px-3 text-center">{t('status.pending', 'Pending')}</th>
                    <th className="py-2.5 px-3 text-center">{t('status.resolved', 'Resolved')}</th>
                    <th className="py-2.5 px-3 text-center">{t('status.closed', 'Closed')}</th>
                    <th className="py-2.5 px-4 text-right">{t('reports.resolutionRate', 'Resolution Rate')}</th>
                    <th className="py-2.5 px-4 text-right">{t('reports.avgResolutionTime', 'Avg Res. Time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                        <span>{t('common.loading', 'Loading department data...')}</span>
                      </td>
                    </tr>
                  ) : departmentsData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500">
                        {t('reports.noDepartmentsFound', 'No department statistics available for this period.')}
                      </td>
                    </tr>
                  ) : (
                    departmentsData.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-800">{d.name}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {d.headName ? (
                            <div>
                              <div className="font-medium text-slate-800">{d.headName}</div>
                              <div className="text-[10px] text-slate-400">{d.headEmail}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-slate-700">{d.memberCount}</td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">{d.total}</td>
                        <td className="py-3 px-3 text-center font-medium text-blue-600">{d.open}</td>
                        <td className="py-3 px-3 text-center font-medium text-amber-600">{d.inProgress}</td>
                        <td className="py-3 px-3 text-center font-medium text-indigo-600">{d.pending}</td>
                        <td className="py-3 px-3 text-center font-medium text-emerald-600">{d.resolved}</td>
                        <td className="py-3 px-3 text-center font-medium text-slate-500">{d.closed}</td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-bold ${
                              d.resolutionRate >= 70
                                ? 'text-emerald-600'
                                : d.resolutionRate >= 40
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {d.resolutionRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {d.averageResolutionFormatted}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: AGENT PERFORMANCE */}
      {activeTab === 'agents' && (
        <Card className="border-[#E2E8F0]">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              {t('reports.agentPerformanceTitle', 'Support Agent Workload & Resolution Metrics')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-4">{t('agents.name', 'Agent Name')}</th>
                    <th className="py-2.5 px-4">{t('agents.department', 'Department')}</th>
                    <th className="py-2.5 px-3 text-center">{t('reports.totalAssigned', 'Assigned')}</th>
                    <th className="py-2.5 px-3 text-center">{t('status.open', 'Open')}</th>
                    <th className="py-2.5 px-3 text-center">{t('status.in_progress', 'In Progress')}</th>
                    <th className="py-2.5 px-3 text-center">{t('status.pending', 'Pending')}</th>
                    <th className="py-2.5 px-3 text-center">{t('status.resolved', 'Resolved')}</th>
                    <th className="py-2.5 px-3 text-center">{t('status.closed', 'Closed')}</th>
                    <th className="py-2.5 px-4 text-right">{t('reports.resolutionRate', 'Resolution Rate')}</th>
                    <th className="py-2.5 px-4 text-right">{t('reports.avgResolutionTime', 'Avg Res. Time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                        <span>{t('common.loading', 'Loading agent metrics...')}</span>
                      </td>
                    </tr>
                  ) : agentsData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500">
                        {t('reports.noAgentsFound', 'No support agents found for this scope.')}
                      </td>
                    </tr>
                  ) : (
                    agentsData.map((ag) => (
                      <tr key={ag.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800">{ag.name}</div>
                          <div className="text-[10px] text-slate-400">{ag.email}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {ag.departmentName}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">{ag.totalAssigned}</td>
                        <td className="py-3 px-3 text-center font-medium text-blue-600">{ag.open}</td>
                        <td className="py-3 px-3 text-center font-medium text-amber-600">{ag.inProgress}</td>
                        <td className="py-3 px-3 text-center font-medium text-indigo-600">{ag.pending}</td>
                        <td className="py-3 px-3 text-center font-medium text-emerald-600">{ag.resolved}</td>
                        <td className="py-3 px-3 text-center font-medium text-slate-500">{ag.closed}</td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-bold ${
                              ag.resolutionRate >= 70
                                ? 'text-emerald-600'
                                : ag.resolutionRate >= 40
                                ? 'text-amber-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {ag.resolutionRate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-700">
                          {ag.averageResolutionFormatted}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
