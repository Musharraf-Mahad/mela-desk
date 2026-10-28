import { useState, useMemo } from 'react';
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
import { MOCK_TICKETS } from '../../mocks/mockData';
import { Search } from 'lucide-react';
import type { TicketPriority, TicketStatus } from '../../types/ticket';

export function AssignedTicketsPage() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Filter for tickets assigned to Abdi Ali
  const assignedTickets = useMemo(() => {
    return MOCK_TICKETS.filter((ticket) => {
      const isAssigned = ticket.assignee?.name === 'Abdi Ali';
      const matchesSearch =
        ticket.id.toLowerCase().includes(search.toLowerCase()) ||
        ticket.subject.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || ticket.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'all' || ticket.priority === priorityFilter;

      return isAssigned && matchesSearch && matchesStatus && matchesPriority;
    });
  }, [search, statusFilter, priorityFilter]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
        <Input
          label="Search"
          placeholder="Search by ticket or name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />

        <Select
          label="Status / Role"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'pending', label: 'Pending' },
            { value: 'resolved', label: 'Resolved' },
          ]}
        />

        <Select
          label="Priority"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'low', label: 'Low' },
            { value: 'normal', label: 'Normal' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ]}
        />

        <div>
          <Button type="button" className="w-full justify-center">
            Filter
          </Button>
        </div>
      </div>

      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket / Name</TableHead>
              <TableHead>Subject / Email</TableHead>
              <TableHead>Status / Role</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignedTickets.map((ticket) => (
              <TableRow
                key={ticket.id}
                isClickable
                onClick={() => navigate(`/agent/tickets/${ticket.id}`)}
              >
                <TableCell className="font-semibold text-[#0F172A]">
                  #{ticket.id}
                </TableCell>
                <TableCell>
                  <span className="font-medium text-slate-800">{ticket.subject}</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={ticket.status as TicketStatus} />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={ticket.priority as TicketPriority} />
                </TableCell>
                <TableCell className="text-xs text-[#64748B]">
                  {ticket.updatedAt}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
