import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ticketApi } from '../../api/tickets.api';
import type { Ticket, TicketPriority, TicketStatus } from '../../types/ticket';
import type { PaginationMeta } from '../../types/api';
import { Search, Plus } from 'lucide-react';

export function MyTicketsPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await ticketApi.getTickets({
          status: statusFilter === 'all' ? undefined : (statusFilter as TicketStatus),
          priority: priorityFilter === 'all' ? undefined : (priorityFilter as TicketPriority),
          search: appliedSearch.trim() || undefined,
          page,
          pageSize: 20,
        });
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
  }, [statusFilter, priorityFilter, page, appliedSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPage(1);
    setAppliedSearch(search);
  };

  return (
    <div className="space-y-6">
      {/* Action / Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
            My Tickets
          </h2>
          <p className="text-sm text-[#64748B] mt-0.5">
            View and track the status of your reported issues.
          </p>
        </div>
        <div>
          <Button
            onClick={() => navigate('/customer/create-ticket')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Ticket
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* Filter Row */}
      <form
        onSubmit={handleSearchSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs"
      >
        <Input
          label="Search"
          placeholder="Search by ticket #, subject or description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />

        <Select
          label="Status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setIsLoading(true);
            setPage(1);
          }}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'open', label: 'Open' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'pending', label: 'Pending' },
            { value: 'resolved', label: 'Resolved' },
            { value: 'closed', label: 'Closed' },
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

      {/* Tickets Table */}
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket ID</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  Loading tickets...
                </TableCell>
              </TableRow>
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  No tickets found.
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  isClickable
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
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
                  <TableCell className="capitalize text-slate-600 text-xs">
                    {ticket.category}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={ticket.status as TicketStatus} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={ticket.priority as TicketPriority} />
                  </TableCell>
                  <TableCell className="text-xs text-[#64748B]">
                    {new Date(ticket.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination Controls */}
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
