import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '../../components/common/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { StatusBadge } from '../../components/common/Badge';
import { ticketApi } from '../../api/tickets.api';
import { userApi } from '../../api/users.api';
import type { Ticket } from '../../types/ticket';
import { Layers, AlertCircle, Headphones, CheckCircle2 } from 'lucide-react';

export function AdminDashboardPage() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalTickets, setTotalTickets] = useState<number>(0);
  const [totalAgents, setTotalAgents] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setIsLoading(true);
        const [ticketsData, agentsData] = await Promise.all([
          ticketApi.getTickets({ page: 1, pageSize: 50 }),
          userApi.getAgents({ page: 1, pageSize: 1 }),
        ]);

        if (isMounted) {
          setTickets(ticketsData.tickets);
          setTotalTickets(ticketsData.pagination.total);
          setTotalAgents(agentsData.pagination.total);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load admin dashboard data');
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
  }, []);

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const resolvedCount = tickets.filter((t) => t.status === 'resolved').length;
  const recentTickets = tickets.slice(0, 4);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-[#64748B]">
          Good morning! Here's your overview.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {error}
        </div>
      )}

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Tickets"
          value={isLoading ? '...' : String(totalTickets)}
          icon={<Layers className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          title="Open Tickets"
          value={isLoading ? '...' : String(openCount)}
          icon={<AlertCircle className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          title="Resolved"
          value={isLoading ? '...' : String(resolvedCount)}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        />
        <StatCard
          title="Active Agents"
          value={isLoading ? '...' : String(totalAgents)}
          icon={<Headphones className="w-5 h-5 text-indigo-500" />}
        />
      </div>

      {/* Ticket Activity & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ticket activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end justify-between px-4 sm:px-8 pt-6 pb-2">
              {[
                { label: 'Mon', h: 'h-24', active: false },
                { label: 'Tue', h: 'h-36', active: true },
                { label: 'Wed', h: 'h-16', active: false },
                { label: 'Thu', h: 'h-40', active: true },
                { label: 'Fri', h: 'h-20', active: false },
                { label: 'Sat', h: 'h-44', active: true },
                { label: 'Sun', h: 'h-32', active: false },
              ].map((bar, i) => (
                <div key={i} className="flex flex-col items-center gap-2 group">
                  <div
                    className={`w-7 sm:w-10 rounded-t-md transition-all ${bar.h} ${
                      bar.active
                        ? 'bg-[#2563EB] group-hover:bg-[#1D4ED8]'
                        : 'bg-blue-100 group-hover:bg-blue-200'
                    }`}
                  />
                  <span className="text-xs text-slate-400 font-medium">{bar.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading recent tickets...</div>
            ) : recentTickets.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No tickets found.</div>
            ) : (
              <div className="space-y-3">
                {recentTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-[#E2E8F0] hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">
                        {ticket.ticketNumber || `#${ticket.id}`} · {ticket.subject}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(ticket.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
