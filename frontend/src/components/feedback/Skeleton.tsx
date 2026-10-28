import React from 'react';

export function Skeleton({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-md ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-2xs space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-1/4" />
    </div>
  );
}

export function SkeletonTableRows({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-[#E2E8F0]">
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-20" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-48" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-16" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-14" /></td>
          <td className="px-4 py-3.5"><Skeleton className="h-4 w-24" /></td>
        </tr>
      ))}
    </>
  );
}
