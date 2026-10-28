import React from 'react';

export function TableContainer({
  children,
  className = '',
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`w-full overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-2xs ${className}`}
    >
      {children}
    </div>
  );
}

export function Table({
  children,
  className = '',
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={`w-full text-left text-sm border-collapse ${className}`} {...props}>
      {children}
    </table>
  );
}

export function TableHeader({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`border-b border-[#E2E8F0] bg-slate-50/50 text-xs font-semibold text-[#64748B] ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  children,
  className = '',
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-[#E2E8F0] text-slate-800 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  children,
  className = '',
  isClickable = false,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { isClickable?: boolean }) {
  return (
    <tr
      className={`transition-colors ${
        isClickable ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/50'
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  className = '',
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`px-4 py-3.5 font-medium tracking-normal ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className = '',
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3.5 align-middle ${className}`} {...props}>
      {children}
    </td>
  );
}
