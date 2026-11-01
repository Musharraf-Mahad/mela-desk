import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TicketPriority, TicketStatus } from '../../types/ticket';
import type { UserRole } from '../../types/auth';

export type BadgeVariant =
  | 'blue'
  | 'amber'
  | 'emerald'
  | 'indigo'
  | 'slate'
  | 'orange'
  | 'rose'
  | 'purple'
  | 'sky';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
};

export function Badge({
  children,
  variant = 'slate',
  size = 'md',
  className = '',
  ...props
}: BadgeProps) {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useTranslation();

  const config: Record<TicketStatus, { key: string; defaultLabel: string; variant: BadgeVariant }> = {
    open: { key: 'status.open', defaultLabel: 'Open', variant: 'blue' },
    in_progress: { key: 'status.in_progress', defaultLabel: 'In Progress', variant: 'amber' },
    pending: { key: 'status.pending', defaultLabel: 'Pending', variant: 'indigo' },
    resolved: { key: 'status.resolved', defaultLabel: 'Resolved', variant: 'emerald' },
    closed: { key: 'status.closed', defaultLabel: 'Closed', variant: 'slate' },
  };

  const item = config[status] || { key: '', defaultLabel: status, variant: 'slate' };
  const label = item.key ? t(item.key, item.defaultLabel) : item.defaultLabel;
  return <Badge variant={item.variant}>{label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const { t } = useTranslation();

  const config: Record<TicketPriority, { key: string; defaultLabel: string; variant: BadgeVariant }> = {
    low: { key: 'priority.low', defaultLabel: 'Low', variant: 'slate' },
    normal: { key: 'priority.normal', defaultLabel: 'Normal', variant: 'sky' },
    high: { key: 'priority.high', defaultLabel: 'High', variant: 'orange' },
    urgent: { key: 'priority.urgent', defaultLabel: 'Urgent', variant: 'rose' },
  };

  const item = config[priority] || { key: '', defaultLabel: priority, variant: 'slate' };
  const label = item.key ? t(item.key, item.defaultLabel) : item.defaultLabel;
  return <Badge variant={item.variant}>{label}</Badge>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  const { t } = useTranslation();

  const config: Record<UserRole, { key: string; defaultLabel: string; variant: BadgeVariant }> = {
    customer: { key: 'roles.customer', defaultLabel: 'Customer', variant: 'slate' },
    agent: { key: 'roles.agent', defaultLabel: 'Support Agent', variant: 'blue' },
    admin: { key: 'roles.admin', defaultLabel: 'Administrator', variant: 'purple' },
  };

  const item = config[role] || { key: '', defaultLabel: role, variant: 'slate' };
  const label = item.key ? t(item.key, item.defaultLabel) : item.defaultLabel;
  return <Badge variant={item.variant}>{label}</Badge>;
}
