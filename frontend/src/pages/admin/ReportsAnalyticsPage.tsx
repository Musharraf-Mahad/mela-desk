import { useState } from 'react';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { StatCard } from '../../components/common/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { BarChart3, CheckCircle2, Archive } from 'lucide-react';

export function ReportsAnalyticsPage() {
  const [dateRange, setDateRange] = useState('30d');
  const [category, setCategory] = useState('all');

  return (
    <div className="space-y-6">
      {/* Filters row matching page 17 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-2xs">
        <Select
          label="Date range"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          options={[
            { value: '7d', label: 'Last 7 days' },
            { value: '30d', label: 'Last 30 days' },
            { value: '90d', label: 'Last 90 days' },
            { value: 'year', label: 'Past year' },
          ]}
        />

        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={[
            { value: 'all', label: 'All categories' },
            { value: 'account', label: 'Account Access' },
            { value: 'billing', label: 'Billing' },
            { value: 'technical', label: 'Technical Issue' },
            { value: 'orders', label: 'Orders' },
            { value: 'general', label: 'General' },
          ]}
        />

        <div>
          <Button type="button" className="w-full justify-center">
            Apply Filters
          </Button>
        </div>
      </div>

      {/* 3 Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Tickets"
          value="248"
          icon={<BarChart3 className="w-5 h-5 text-blue-500" />}
        />
        <StatCard
          title="Resolved"
          value="176"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
        />
        <StatCard
          title="Closed"
          value="42"
          icon={<Archive className="w-5 h-5 text-slate-500" />}
        />
      </div>

      {/* Ticket creation trend & Status distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ticket creation trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-44 flex items-end justify-between px-6 pt-6 pb-2">
              {[
                { label: 'W1', h: 'h-24', active: true },
                { label: 'W2', h: 'h-16', active: false },
                { label: 'W3', h: 'h-36', active: true },
                { label: 'W4', h: 'h-32', active: true },
                { label: 'W5', h: 'h-20', active: false },
                { label: 'W6', h: 'h-28', active: true },
                { label: 'W7', h: 'h-38', active: true },
              ].map((bar, i) => (
                <div key={i} className="flex flex-col items-center gap-2 group">
                  <div
                    className={`w-7 rounded-t-md transition-all ${bar.h} ${
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
            <CardTitle>Status distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>Open (42)</span>
                  <span>17%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className="bg-[#2563EB] h-3 rounded-full w-[17%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>In Progress (30)</span>
                  <span>12%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className="bg-amber-500 h-3 rounded-full w-[12%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                  <span>Resolved (176)</span>
                  <span>71%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3">
                  <div className="bg-emerald-500 h-3 rounded-full w-[71%]" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
