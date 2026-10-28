import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  type?: AlertType;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function Alert({
  type = 'info',
  title,
  children,
  onDismiss,
  className = '',
}: AlertProps) {
  const styles: Record<
    AlertType,
    { container: string; icon: React.ReactNode; text: string }
  > = {
    info: {
      container: 'bg-blue-50/70 border-blue-200 text-blue-800',
      icon: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
      text: 'text-blue-700',
    },
    success: {
      container: 'bg-emerald-50/70 border-emerald-200 text-emerald-800',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
      text: 'text-emerald-700',
    },
    warning: {
      container: 'bg-amber-50/70 border-amber-200 text-amber-800',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
      text: 'text-amber-700',
    },
    error: {
      container: 'bg-rose-50/70 border-rose-200 text-rose-800',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
      text: 'text-rose-700',
    },
  };

  const { container, icon, text } = styles[type];

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm ${container} ${className}`}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        {title && <h5 className="font-semibold mb-0.5">{title}</h5>}
        <div className={`text-xs sm:text-sm ${text}`}>{children}</div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 rounded-md p-1 transition-colors cursor-pointer"
          aria-label="Dismiss alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
