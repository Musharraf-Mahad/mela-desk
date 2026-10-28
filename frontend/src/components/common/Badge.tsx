import React from 'react';
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
  const config: Record<TicketStatus, { label: string; variant: BadgeVariant }> = {
    open: { label: 'Open', variant: 'blue' },
    in_progress: { label: 'In Progress', variant: 'amber' },
    pending: { label: 'Pending', variant: 'indigo' },
    resolved: { label: 'Resolved', variant: 'emerald' },
    closed: { label: 'Closed', variant: 'slate' },
  };

  const { label, variant } = config[status] || { label: status, variant: 'slate' };
  return <Badge variant={variant}>{label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const config: Record<TicketPriority, { label: string; variant: BadgeVariant }> = {
    low: { label: 'Low', variant: 'slate' },
    normal: { label: 'Normal', variant: 'sky' },
    high: { label: 'High', variant: 'orange' },
    urgent: { label: 'Urgent', variant: 'rose' },
  };

  const { label, variant } = config[priority] || { label: priority, variant: 'slate' };
  return <Badge variant={variant}>{label}</Badge>;
}

export function RoleBadge({ role }: { role: UserRole }) {
  const config: Record<UserRole, { label: string; variant: BadgeVariant }> = {
    customer: { label: 'Customer', variant: 'slate' },
    agent: { label: 'Support Agent', variant: 'blue' },
    admin: { label: 'Administrator', variant: 'purple' },
  };

  const { label, variant } = config[role] || { label: role, variant: 'slate' };
  return <Badge variant={variant}>{label}</Badge>;
}
