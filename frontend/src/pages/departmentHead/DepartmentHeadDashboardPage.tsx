import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/common/Table';
import { StatusBadge, PriorityBadge, RoleBadge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { departmentApi, type DepartmentWorkloadSummary } from '../../api/departments.api';
import { ticketApi } from '../../api/tickets.api';
import type { Department, User } from '../../types/auth';
import type { Ticket, TicketStatus } from '../../types/ticket';
import {
  Building2,
  Users,
  Inbox,
  Clock,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Search,
  ExternalLink,
} from 'lucide-react';

export function DepartmentHeadDashboardPage() {
  const { t } = useTranslation();

  const [department, setDepartment] = useState<Department | null>(null);
  const [workload, setWorkload] = useState<DepartmentWorkloadSummary | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [members, setMembers] = useState<User[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Ticket Assignment Modal State
  const [selectedTicketForAssign, setSelectedTicketForAssign] = useState<Ticket | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load department info and workload
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await departmentApi.getMyDepartmentDashboard();
        if (isMounted) {
          setDepartment(data.department);
          setWorkload(data.workload);
          setMembers(data.department.members || []);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : t('departmentHead.loadError', 'Failed to load department dashboard'));
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [refreshTrigger, t]);

  // Load department tickets
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    (async () => {
      try {
        const data = await ticketApi.getTickets({
          status: statusFilter === 'all' ? undefined : (statusFilter as TicketStatus),
          search: debouncedSearch.trim() || undefined,
          pageSize: 50,
        });
        if (isMounted) {
          setTickets(data.tickets);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : t('tickets.unableToRetrieve', 'Failed to load tickets'));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [statusFilter, debouncedSearch, refreshTrigger, t]);

  const handleOpenAssignModal = (ticket: Ticket) => {
    setSelectedTicketForAssign(ticket);
    setSelectedAssigneeId(ticket.assignee?.id || '');
    setAssignError(null);
  };

  const handleAssignTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketForAssign) return;

    setIsAssigning(true);
    setAssignError(null);

    try {
      await ticketApi.assignTicket(selectedTicketForAssign.id, selectedAssigneeId || null);
      setSuccessMessage(
        selectedAssigneeId
          ? t('departmentHead.assignSuccess', 'Ticket assigned successfully')
          : t('departmentHead.unassignSuccess', 'Ticket unassigned successfully')
      );
      setSelectedTicketForAssign(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : t('tickets.assignmentError', 'Failed to assign ticket'));
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Department Banner Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-blue-200" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
              {t('roles.department_head', 'Department Head Dashboard')}
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {department?.name || t('common.loading', 'Loading Department...')}
          </h2>
          <p className="text-sm text-blue-100 mt-1 max-w-xl">
            {department?.description || t('departmentHead.defaultDescription', 'Manage tickets and supervise active support agents within your department.')}
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 flex items-center gap-3 shrink-0">
          <Users className="w-8 h-8 text-blue-200" />
          <div>
            <p className="text-xs text-blue-200">{t('departmentHead.assignedAgents', 'Active Agents')}</p>
            <p className="text-xl font-bold text-white">{members.length}</p>
          </div>
        </div>
      </div>

      {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {successMessage && <Alert type="success" onDismiss={() => setSuccessMessage(null)}>{successMessage}</Alert>}

      {/* Workload Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.stats.totalTickets', 'Total Tickets')}
          value={workload ? String(workload.total) : '...'}
          icon={<Inbox className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          title={t('dashboard.stats.open', 'Open Tickets')}
          value={workload ? String(workload.open) : '...'}
          icon={<AlertCircle className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          title={t('dashboard.stats.inProgress', 'In Progress')}
          value={workload ? String(workload.inProgress) : '...'}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
        />
        <StatCard
          title={t('dashboard.stats.resolved', 'Resolved')}
          value={workload ? String(workload.resolved) : '...'}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        />
      </div>

      {/* Main Content Grid: Tickets + Agent Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Department Tickets */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-blue-600" />
                {t('departmentHead.departmentTickets', 'Department Ticket Queue')}
              </h3>

              {/* Status Filter */}
              <div className="w-full sm:w-48">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: 'all', label: t('status.all', 'All Statuses') },
                    { value: 'open', label: t('status.open', 'Open') },
                    { value: 'in_progress', label: t('status.in_progress', 'In Progress') },
                    { value: 'pending', label: t('status.pending', 'Pending') },
                    { value: 'resolved', label: t('status.resolved', 'Resolved') },
                    { value: 'closed', label: t('status.closed', 'Closed') },
                  ]}
                />
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('tickets.searchPlaceholder', 'Search by ticket number or subject...')}
                className="pl-9 text-sm"
              />
            </div>
          </div>

          {/* Tickets Table */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-2xs overflow-hidden">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('tickets.ticketNumber', 'Ticket #')}</TableHead>
                    <TableHead>{t('tickets.subject', 'Subject')}</TableHead>
                    <TableHead>{t('tickets.priority', 'Priority')}</TableHead>
                    <TableHead>{t('tickets.status', 'Status')}</TableHead>
                    <TableHead>{t('tickets.assignee', 'Assignee')}</TableHead>
                    <TableHead className="text-right">{t('common.actions', 'Action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                        <div className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                        {t('common.loading', 'Loading tickets...')}
                      </TableCell>
                    </TableRow>
                  ) : tickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        <Inbox className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                        <p className="font-medium text-xs">{t('tickets.noTicketsFound', 'No tickets found in this department')}</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-xs font-semibold text-blue-600">
                          <Link to={`/agent/tickets/${ticket.id}`} className="hover:underline flex items-center gap-1">
                            {ticket.ticketNumber}
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate font-medium text-slate-800 text-xs">
                          {ticket.subject}
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={ticket.priority} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={ticket.status} />
                        </TableCell>
                        <TableCell className="text-xs">
                          {ticket.assignee ? (
                            <span className="text-slate-800 font-medium">{ticket.assignee.name}</span>
                          ) : (
                            <span className="text-amber-600 font-semibold italic text-[11px] bg-amber-50 px-1.5 py-0.5 rounded">
                              {t('tickets.unassigned', 'Unassigned')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenAssignModal(ticket)}
                            className="text-xs flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            {t('departmentHead.assign', 'Assign')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </div>

        {/* Right 1 Col: Department Agent Roster */}
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              {t('departmentHead.agentRoster', 'Department Agents')}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              {t('departmentHead.agentRosterDesc', 'Support agents assigned to this department.')}
            </p>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {members.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 italic">
                  {t('departments.noMembersYet', 'No agents currently assigned to this department.')}
                </div>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{member.name}</p>
                      <p className="text-[11px] text-slate-400">{member.email}</p>
                    </div>
                    <RoleBadge role={member.role} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Assignment Modal */}
      <Modal
        isOpen={Boolean(selectedTicketForAssign)}
        onClose={() => !isAssigning && setSelectedTicketForAssign(null)}
        title={`${t('departmentHead.assignTicketTitle', 'Assign Ticket')}: ${selectedTicketForAssign?.ticketNumber}`}
        size="sm"
      >
        <form onSubmit={handleAssignTicket} className="space-y-4">
          {assignError && <Alert type="error">{assignError}</Alert>}

          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">{t('tickets.subject', 'Subject')}:</p>
            <p className="text-sm font-semibold text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              {selectedTicketForAssign?.subject}
            </p>
          </div>

          <Select
            label={t('departmentHead.selectAgentForTicket', 'Select Agent in Department')}
            value={selectedAssigneeId}
            onChange={(e) => setSelectedAssigneeId(e.target.value)}
            options={[
              { value: '', label: t('tickets.unassigned', 'Unassigned / Clear Assignee') },
              ...members.map((m) => ({
                value: m.id,
                label: `${m.name} (${m.email})`,
              })),
            ]}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSelectedTicketForAssign(null)}
              disabled={isAssigning}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isAssigning}>
              {isAssigning ? t('common.saving', 'Assigning...') : t('common.save', 'Confirm Assignment')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
