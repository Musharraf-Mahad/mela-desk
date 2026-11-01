import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../../components/common/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { StatusBadge } from '../../components/common/Badge';
import { ticketApi } from '../../api/tickets.api';
import type { Ticket } from '../../types/ticket';
import { Inbox, UserCheck, Clock, CheckCircle2 } from 'lucide-react';

export function SupportDashboardPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [assignedTickets, setAssignedTickets] = useState<Ticket[]>([]);
  const [unassignedTotal, setUnassignedTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setIsLoading(true);
        const [assignedData, queueData] = await Promise.all([
          ticketApi.getTickets({ page: 1, pageSize: 50 }),
          ticketApi.getQueue({ page: 1, pageSize: 1 }),
        ]);

        if (isMounted) {
          setAssignedTickets(assignedData.tickets);
          setUnassignedTotal(queueData.pagination.total);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load support dashboard data');
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

  const openAssignedCount = assignedTickets.filter((t) => t.status === 'open').length;
  const inProgressCount = assignedTickets.filter((t) => t.status === 'in_progress').length;
  const resolvedCount = assignedTickets.filter((t) => t.status === 'resolved').length;
  const recentAssigned = assignedTickets.slice(0, 4);

  const daysData = [
    { key: 'mon', label: t('dashboard.days.mon', 'Mon'), h: 'h-24', active: false },
    { key: 'tue', label: t('dashboard.days.tue', 'Tue'), h: 'h-36', active: true },
    { key: 'wed', label: t('dashboard.days.wed', 'Wed'), h: 'h-16', active: false },
    { key: 'thu', label: t('dashboard.days.thu', 'Thu'), h: 'h-40', active: true },
    { key: 'fri', label: t('dashboard.days.fri', 'Fri'), h: 'h-20', active: false },
    { key: 'sat', label: t('dashboard.days.sat', 'Sat'), h: 'h-44', active: true },
    { key: 'sun', label: t('dashboard.days.sun', 'Sun'), h: 'h-32', active: false },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Greeting */}
      <div>
        <p className="text-sm font-medium text-[#64748B]">
          {t('dashboard.greeting', "Good morning! Here's your overview.")}
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
          title={t('dashboard.stats.open', 'Open')}
          value={isLoading ? '...' : String(openAssignedCount)}
          icon={<Inbox className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          title={t('dashboard.stats.unassigned', 'Unassigned')}
          value={isLoading ? '...' : String(unassignedTotal)}
          icon={<UserCheck className="w-5 h-5 text-orange-500" />}
        />
        <StatCard
          title={t('dashboard.stats.inProgress', 'In Progress')}
          value={isLoading ? '...' : String(inProgressCount)}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
        />
        <StatCard
          title={t('dashboard.stats.resolved', 'Resolved')}
          value={isLoading ? '...' : String(resolvedCount)}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        />
      </div>

      {/* Ticket Activity & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('dashboard.ticketActivity', 'Ticket activity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end justify-between px-4 sm:px-8 pt-6 pb-2">
              {daysData.map((bar, i) => (
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
            <CardTitle>{t('dashboard.recentActivity', 'Recent activity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-6 text-center text-xs text-slate-400">
                {t('dashboard.loadingRecent', 'Loading recent tickets...')}
              </div>
            ) : recentAssigned.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                {t('dashboard.noAssignedTickets', 'No assigned tickets.')}
              </div>
            ) : (
              <div className="space-y-3">
                {recentAssigned.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => navigate(`/agent/tickets/${ticket.id}`)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-[#E2E8F0] hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">
                        {ticket.ticketNumber || `#${ticket.id}`} · {ticket.subject}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(ticket.updatedAt).toLocaleDateString(i18n.language === 'am' ? 'am-ET' : 'en-US', {
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
