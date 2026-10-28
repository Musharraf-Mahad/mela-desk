import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC]">
      {/* Left Navy Brand Panel */}
      <div className="w-full md:w-5/12 bg-[#0F172A] text-white p-8 sm:p-12 md:p-16 flex flex-col justify-between shrink-0 shadow-lg">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <span className="w-4 h-4 bg-[#2563EB] rounded-xs inline-block" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              MelaDesk
            </h1>
          </div>
          <p className="text-lg sm:text-xl font-medium text-blue-400 mb-3">
            Your Support, Simplified.
          </p>
          <p className="text-sm text-slate-300 max-w-sm leading-relaxed">
            One place to ask, track, and resolve.
          </p>
        </div>

        <div className="hidden md:block pt-12 border-t border-slate-800 text-xs text-slate-400">
          <p>MelaDesk Customer Support Ticketing System</p>
          <p className="text-slate-500 mt-1">Design tokens: Primary #2563EB · Navy #0F172A · Background #F8FAFC</p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full md:w-7/12 flex items-center justify-center p-6 sm:p-12 md:p-16">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
