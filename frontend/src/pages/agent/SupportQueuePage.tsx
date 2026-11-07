import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/common/Table';
import { StatusBadge, PriorityBadge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { ticketApi } from '../../api/tickets.api';
import type { Ticket, TicketPriority, TicketCategory } from '../../types/ticket';
import type { PaginationMeta } from '../../types/api';
import { Search, UserCheck } from 'lucide-react';

export function SupportQueuePage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { t, i18n } = useTranslation();

  const isAdmin = role === 'admin';
  const isHead = role === 'head';
  const isDeptHead = role === 'department_head';
  const isManagement = isAdmin || isHead || isDeptHead;
  const canClaim = role === 'agent';

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const params = {
          priority: priorityFilter === 'all' ? undefined : (priorityFilter as TicketPriority),
          category: categoryFilter === 'all' ? undefined : (categoryFilter as TicketCategory),
          search: appliedSearch.trim() || undefined,
          page,
          pageSize: 20,
        };

        const data = isManagement ? await ticketApi.getTickets(params) : await ticketApi.getQueue(params);
        if (isMounted) {
          setTickets(data.tickets);
          setPagination(data.pagination);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load tickets');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isManagement, priorityFilter, categoryFilter, page, appliedSearch]);

  const handleClaimTicket = async (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    setActionLoadingId(ticketId);
    setError(null);
    setSuccessMessage(null);

    try {
      await ticketApi.claimTicket(ticketId);
      setSuccessMessage(t('tickets.claimedSuccessWithId', { id: ticketId, defaultValue: `Ticket #${ticketId} claimed successfully!` }));
      setIsLoading(true);
      const params = {
        priority: priorityFilter === 'all' ? undefined : (priorityFilter as TicketPriority),
        category: categoryFilter === 'all' ? undefined : (categoryFilter as TicketCategory),
        search: appliedSearch.trim() || undefined,
        page,
        pageSize: 20,
      };
      const data = isManagement ? await ticketApi.getTickets(params) : await ticketApi.getQueue(params);
      setTickets(data.tickets);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to claim ticket');
    } finally {
      setIsLoading(false);
      setActionLoadingId(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(1);
    setAppliedSearch(search);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          {isAdmin || isHead
            ? t('queue.allTicketsDirectory', 'All Tickets Directory')
            : isDeptHead
            ? t('departmentHead.ticketQueue', 'Department Support Tickets')
            : t('queue.supportQueue', 'Support Queue')}
        </h2>
        <p className="text-sm text-[#64748B] mt-0.5">
          {isAdmin || isHead
            ? t('queue.allTicketsDesc', 'Browse and review all customer tickets across the organization.')
            : isDeptHead
            ? t('departmentHead.ticketQueueDesc', 'All tickets scoped to your department.')
            : t('queue.supportQueueDesc', 'Unassigned tickets available for support agents to review and claim.')}
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {successMessage && <Alert type="success">{successMessage}</Alert>}

      <form
        onSubmit={handleSearchSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs"
      >
        <Input
          label={t('common.search', 'Search')}
          placeholder={t('tickets.searchPlaceholder', 'Search by ticket #, subject or description')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />

        <Select
          label={t('tickets.category', 'Category')}
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: t('categories.all', 'All Categories') },
            { value: 'account', label: t('categories.account', 'Account') },
            { value: 'billing', label: t('categories.billing', 'Billing') },
            { value: 'technical', label: t('categories.technical', 'Technical') },
            { value: 'orders', label: t('categories.orders', 'Orders') },
            { value: 'general', label: t('categories.general', 'General') },
          ]}
        />

        <Select
          label={t('tickets.priority', 'Priority')}
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          options={[
            { value: 'all', label: t('priority.all', 'All Priorities') },
            { value: 'low', label: t('priority.low', 'Low') },
            { value: 'normal', label: t('priority.normal', 'Normal') },
            { value: 'high', label: t('priority.high', 'High') },
            { value: 'urgent', label: t('priority.urgent', 'Urgent') },
          ]}
        />

        <div className="flex gap-2">
          <Button type="submit" className="flex-1 justify-center">
            {t('common.filter', 'Filter')}
          </Button>
          {(appliedSearch || priorityFilter !== 'all' || categoryFilter !== 'all') && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSearch('');
                setAppliedSearch('');
                setPriorityFilter('all');
                setCategoryFilter('all');
                setPage(1);
              }}
            >
              {t('common.cancel', 'Reset')}
            </Button>
          )}
        </div>
      </form>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('tickets.ticketNumber', 'Ticket #')}</TableHead>
              <TableHead>{t('tickets.subject', 'Subject')}</TableHead>
              <TableHead>{t('tickets.customer', 'Customer')}</TableHead>
              <TableHead>{t('tickets.status', 'Status')}</TableHead>
              <TableHead>{t('tickets.priority', 'Priority')}</TableHead>
              <TableHead>{t('tickets.lastUpdated', 'Last Updated')}</TableHead>
              {canClaim && <TableHead className="text-right">{t('common.actions', 'Action')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={canClaim ? 7 : 6} className="text-center py-8 text-slate-400">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin inline-block mr-2" />
                  {t('common.loading', 'Loading tickets...')}
                </TableCell>
              </TableRow>
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canClaim ? 7 : 6} className="text-center py-8 text-slate-400">
                  {isManagement
                    ? t('tickets.noTicketsFound', 'No tickets found.')
                    : t('queue.queueEmpty', 'The support queue is empty. Great job!')}
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  isClickable
                  onClick={() =>
                    navigate(isAdmin || isHead ? `/tickets/${ticket.id}` : `/agent/tickets/${ticket.id}`)
                  }
                >
                  <TableCell className="font-mono text-xs">
                    <span className="block font-bold text-brand-600 text-sm">
                      {ticket.ticketNumber || `#${ticket.id}`}
                    </span>
                    <span className="block text-[10px] text-slate-400 font-normal">
                      {ticket.id}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-slate-800">{ticket.subject}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {ticket.customer?.name || t('common.customer', 'Customer')}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={ticket.priority} />
                  </TableCell>
                  <TableCell className="text-xs text-[#64748B]">
                    {new Date(ticket.updatedAt).toLocaleDateString(i18n.language === 'am' ? 'am-ET' : 'en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  {canClaim && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<UserCheck className="w-3.5 h-3.5 text-blue-600" />}
                        isLoading={actionLoadingId === ticket.id}
                        disabled={actionLoadingId === ticket.id}
                        onClick={(e) => handleClaimTicket(e, ticket.id)}
                      >
                        {t('queue.claim', 'Claim')}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
          <span>
            {t('common.showingTicketsPagination', {
              page: pagination.page,
              totalPages: pagination.totalPages,
              total: pagination.total,
              defaultValue: `Showing page ${pagination.page} of ${pagination.totalPages} (${pagination.total} tickets total)`,
            })}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('common.previous', 'Previous')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= pagination.totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common.next', 'Next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
