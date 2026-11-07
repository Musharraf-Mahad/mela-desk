import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../../components/common/StatCard';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/common/Table';
import { Badge, RoleBadge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { departmentApi, type OrganizationOverviewResponse } from '../../api/departments.api';
import {
  ShieldAlert,
  Building2,
  Users,
  Inbox,
  AlertCircle,
  Clock,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

export function HeadDashboardPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<OrganizationOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const overview = await departmentApi.getOrganizationOverview();
        if (isMounted) {
          setData(overview);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : t('head.loadError', 'Failed to load organization overview'));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [t]);

  const globalStatus = data?.globalStatus || { open: 0, in_progress: 0, pending: 0, resolved: 0, closed: 0 };
  const totalTickets = data?.totalTickets || 0;

  return (
    <div className="space-y-6">
      {/* Executive Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              {t('roles.head', 'Executive Overview & Operations')}
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t('head.title', 'Organization-Wide Support Overview')}
          </h2>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            {t('head.subtitle', 'Comprehensive read-only operational oversight across all departments, ticket queues, and agent workloads.')}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 shrink-0">
          <div>
            <p className="text-xs text-slate-300">{t('head.totalDepartments', 'Departments')}</p>
            <p className="text-xl font-bold text-white">{data?.departments.length ?? 0}</p>
          </div>
          <div className="w-px h-8 bg-white/20" />
          <div>
            <p className="text-xs text-slate-300">{t('head.activeAgents', 'Active Agents')}</p>
            <p className="text-xl font-bold text-white">{data?.agents.length ?? 0}</p>
          </div>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Global Status StatCards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.stats.totalTickets', 'Total Organization Tickets')}
          value={isLoading ? '...' : String(totalTickets)}
          icon={<Inbox className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          title={t('dashboard.stats.open', 'Open Queue')}
          value={isLoading ? '...' : String(globalStatus.open || 0)}
          icon={<AlertCircle className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          title={t('dashboard.stats.inProgress', 'In Progress')}
          value={isLoading ? '...' : String(globalStatus.in_progress || 0)}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
        />
        <StatCard
          title={t('dashboard.stats.resolved', 'Resolved')}
          value={isLoading ? '...' : String(globalStatus.resolved || 0)}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        />
      </div>

      {/* Department Workload Breakdown */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            {t('head.departmentWorkloads', 'Department Workload Distribution')}
          </h3>
          <span className="text-xs text-slate-400">
            {t('head.readOnlyNotice', 'Read-only operational view')}
          </span>
        </div>

        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('departments.departmentName', 'Department')}</TableHead>
                <TableHead>{t('departments.departmentHead', 'Department Head')}</TableHead>
                <TableHead>{t('departments.membersCount', 'Agents')}</TableHead>
                <TableHead>{t('status.open', 'Open')}</TableHead>
                <TableHead>{t('status.in_progress', 'In Progress')}</TableHead>
                <TableHead>{t('status.resolved', 'Resolved')}</TableHead>
                <TableHead className="text-right">{t('dashboard.stats.totalTickets', 'Total Tickets')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    <div className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                    {t('common.loading', 'Loading department workloads...')}
                  </TableCell>
                </TableRow>
              ) : !data || data.departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-xs">
                    {t('departments.noDepartmentsFound', 'No departments found.')}
                  </TableCell>
                </TableRow>
              ) : (
                data.departments.map((dept) => {
                  const deptTickets = dept._count?.tickets ?? 0;
                  return (
                    <TableRow key={dept.id}>
                      <TableCell className="font-semibold text-slate-900 text-xs">
                        {dept.name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {dept.head?.name || <span className="text-slate-400 italic">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="blue" size="sm">
                          <Users className="w-3 h-3 mr-1 inline" />
                          {dept._count?.members ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="blue" size="sm">{dept.workload.open}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="amber" size="sm">{dept.workload.inProgress}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="emerald" size="sm">{dept.workload.resolved}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-800 text-xs">
                        {deptTickets}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </div>

      {/* Agent Workload Overview */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            {t('head.agentWorkloadTitle', 'Agent Active Ticket Load')}
          </h3>
          <span className="text-xs text-slate-400">
            {t('head.activeOnly', 'Active agents in organization')}
          </span>
        </div>

        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.name', 'Agent Name')}</TableHead>
                <TableHead>{t('users.email', 'Email')}</TableHead>
                <TableHead>{t('users.role', 'Role')}</TableHead>
                <TableHead>{t('departments.departmentName', 'Department')}</TableHead>
                <TableHead className="text-right">{t('head.activeTicketsAssigned', 'Active Assigned Tickets')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    <div className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                    {t('common.loading', 'Loading agent workloads...')}
                  </TableCell>
                </TableRow>
              ) : !data || data.agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-xs">
                    {t('users.noAgentsFound', 'No active agents found.')}
                  </TableCell>
                </TableRow>
              ) : (
                data.agents.map((ag) => (
                  <TableRow key={ag.id}>
                    <TableCell className="font-medium text-slate-800 text-xs">
                      {ag.name}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {ag.email}
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={ag.role as any} />
                    </TableCell>
                    <TableCell className="text-xs">
                      {ag.department?.name ? (
                        <span className="font-medium text-slate-800">{ag.department.name}</span>
                      ) : (
                        <span className="text-slate-400 italic">{t('departments.unassigned', 'None')}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={ag.activeAssignedTickets > 5 ? 'rose' : ag.activeAssignedTickets > 0 ? 'amber' : 'slate'} size="sm">
                        {ag.activeAssignedTickets}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
}
