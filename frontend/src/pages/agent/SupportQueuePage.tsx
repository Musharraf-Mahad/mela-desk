import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const isAdmin = role === 'admin';

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

        const data = isAdmin ? await ticketApi.getTickets(params) : await ticketApi.getQueue(params);
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
  }, [isAdmin, priorityFilter, categoryFilter, page, appliedSearch]);

  const handleClaimTicket = async (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    setActionLoadingId(ticketId);
    setError(null);
    setSuccessMessage(null);

    try {
      await ticketApi.claimTicket(ticketId);
      setSuccessMessage(`Ticket #${ticketId} claimed successfully!`);
      setIsLoading(true);
      // Trigger refresh by updating appliedSearch or reloading
      const params = {
        priority: priorityFilter === 'all' ? undefined : (priorityFilter as TicketPriority),
        category: categoryFilter === 'all' ? undefined : (categoryFilter as TicketCategory),
        search: appliedSearch.trim() || undefined,
        page,
        pageSize: 20,
      };
      const data = isAdmin ? await ticketApi.getTickets(params) : await ticketApi.getQueue(params);
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
          {isAdmin ? 'All Tickets Directory' : 'Support Queue'}
        </h2>
        <p className="text-sm text-[#64748B] mt-0.5">
          {isAdmin
            ? 'Browse and manage all customer tickets across the organization.'
            : 'Unassigned tickets available for support agents to review and claim.'}
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {successMessage && <Alert type="success">{successMessage}</Alert>}

      <form
        onSubmit={handleSearchSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs"
      >
        <Input
          label="Search"
          placeholder="Search by subject or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />

        <Select
          label="Category"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setIsLoading(true);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All Categories' },
            { value: 'account', label: 'Account' },
            { value: 'billing', label: 'Billing' },
            { value: 'technical', label: 'Technical' },
            { value: 'orders', label: 'Orders' },
            { value: 'general', label: 'General' },
          ]}
        />

        <Select
          label="Priority"
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setIsLoading(true);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All Priorities' },
            { value: 'low', label: 'Low' },
            { value: 'normal', label: 'Normal' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ]}
        />

        <div>
          <Button type="submit" className="w-full justify-center">
            Filter
          </Button>
        </div>
      </form>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket ID</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Updated</TableHead>
              {!isAdmin && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 7} className="text-center py-8 text-slate-400">
                  Loading tickets...
                </TableCell>
              </TableRow>
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 7} className="text-center py-8 text-slate-400">
                  {isAdmin ? 'No tickets found.' : 'The support queue is empty. Great job!'}
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  isClickable
                  onClick={() =>
                    navigate(isAdmin ? `/tickets/${ticket.id}` : `/agent/tickets/${ticket.id}`)
                  }
                >
                  <TableCell className="font-semibold text-[#0F172A] font-mono text-xs">
                    #{ticket.id}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-slate-800">{ticket.subject}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {ticket.customer?.name || 'Customer'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={ticket.priority} />
                  </TableCell>
                  <TableCell className="text-xs text-[#64748B]">
                    {new Date(ticket.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  {!isAdmin && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<UserCheck className="w-3.5 h-3.5 text-blue-600" />}
                        isLoading={actionLoadingId === ticket.id}
                        disabled={actionLoadingId === ticket.id}
                        onClick={(e) => handleClaimTicket(e, ticket.id)}
                      >
                        Claim
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
        <div className="flex items-center justify-between px-2 text-sm text-slate-500">
          <div>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} tickets total)
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pagination.page <= 1}
              onClick={() => {
                setIsLoading(true);
                setPage((p) => Math.max(1, p - 1));
              }}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => {
                setIsLoading(true);
                setPage((p) => p + 1);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
