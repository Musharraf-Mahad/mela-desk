import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '../../components/common/Select';
import { StatCard } from '../../components/common/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Alert } from '../../components/common/Alert';
import { ticketApi } from '../../api/tickets.api';
import type { Ticket, TicketCategory } from '../../types/ticket';
import { BarChart3, CheckCircle2, Archive, AlertCircle, Clock } from 'lucide-react';

export function ReportsAnalyticsPage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string>('all');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const data = await ticketApi.getTickets({
          category: category === 'all' ? undefined : (category as TicketCategory),
          page: 1,
          pageSize: 100,
        });
        if (isMounted) {
          setTickets(data.tickets);
          setTotalCount(data.pagination.total);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : t('reports.subtitle'));
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
  }, [category, t]);

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const inProgressCount = tickets.filter((t) => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter((t) => t.status === 'resolved').length;
  const closedCount = tickets.filter((t) => t.status === 'closed').length;

  const total = totalCount || tickets.length || 0;
  const openPct = total > 0 ? Math.round((openCount / total) * 100) : 0;
  const inProgressPct = total > 0 ? Math.round((inProgressCount / total) * 100) : 0;
  const resolvedPct = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;
  const closedPct = total > 0 ? Math.round((closedCount / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          {t('reports.title')}
        </h2>
        <p className="text-sm text-[#64748B] mt-0.5">
          {t('reports.subtitle')}
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Filters row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
        <Select
          label={t('tickets.category')}
          value={category}
          onChange={(e) => {
            setIsLoading(true);
            setCategory(e.target.value);
          }}
          options={[
            { value: 'all', label: t('categories.all') },
            { value: 'account', label: t('categories.account') },
            { value: 'billing', label: t('categories.billing') },
            { value: 'technical', label: t('categories.technical') },
            { value: 'orders', label: t('categories.orders') },
            { value: 'general', label: t('categories.general') },
          ]}
        />
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.stats.totalTickets')}
          value={isLoading ? '...' : String(total)}
          icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          title={t('dashboard.stats.open')}
          value={isLoading ? '...' : String(openCount)}
          icon={<AlertCircle className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          title={t('dashboard.stats.inProgress')}
          value={isLoading ? '...' : String(inProgressCount)}
          icon={<Clock className="w-5 h-5 text-amber-500" />}
        />
        <StatCard
          title={t('dashboard.stats.resolved')}
          value={isLoading ? '...' : String(resolvedCount)}
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        />
      </div>

      {/* Status distribution & Closed count */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.statusDistribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>{t('status.open')} ({openCount})</span>
                  <span>{openPct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-[#2563EB] h-3 rounded-full transition-all"
                    style={{ width: `${openPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>{t('status.in_progress')} ({inProgressCount})</span>
                  <span>{inProgressPct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-amber-500 h-3 rounded-full transition-all"
                    style={{ width: `${inProgressPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>{t('status.resolved')} ({resolvedCount})</span>
                  <span>{resolvedPct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-3 rounded-full transition-all"
                    style={{ width: `${resolvedPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>{t('status.closed')} ({closedCount})</span>
                  <span>{closedPct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-slate-500 h-3 rounded-full transition-all"
                    style={{ width: `${closedPct}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('reports.closedTickets')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-6 text-center space-y-2">
              <Archive className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-2xl font-bold text-slate-800">{closedCount}</p>
              <p className="text-xs text-slate-500">
                {t('reports.archivedDesc')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
