import { Outlet } from 'react-router-dom';

export function UtilityLayout() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between p-4 sm:p-6">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-2xl p-8 sm:p-12 text-center shadow-xs">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="w-3.5 h-3.5 bg-[#2563EB] rounded-xs inline-block" />
            <span className="text-xl font-bold text-[#0F172A] tracking-tight">MelaDesk</span>
          </div>
          <Outlet />
        </div>
      </div>
      <div className="text-center text-xs text-slate-400 py-3">
        Design tokens: Primary #2563EB · Navy #0F172A · Background #F8FAFC · Border #E2E8F0 · Secondary text #64748B
      </div>
    </div>
  );
}
