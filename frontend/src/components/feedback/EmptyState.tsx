import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '../common/Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon = <Inbox className="w-10 h-10 text-slate-400 stroke-1" />,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl bg-white border border-[#E2E8F0] ${className}`}
    >
      <div className="mb-3.5 p-3 rounded-full bg-slate-50 border border-[#E2E8F0]">
        {icon}
      </div>
      <h4 className="text-base font-semibold text-[#0F172A] mb-1">{title}</h4>
      {description && (
        <p className="text-xs sm:text-sm text-[#64748B] max-w-sm mb-4">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
