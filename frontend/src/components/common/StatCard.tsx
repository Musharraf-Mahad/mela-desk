import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ title, value, subtitle, icon, className = '' }: StatCardProps) {
  return (
    <div
      className={`bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-xs sm:text-sm font-medium text-[#64748B]">{title}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">{value}</span>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>
    </div>
  );
}
