import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '../common/LanguageSelector';

export function AuthLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC] relative">
      {/* Top right language switch for both desktop and mobile */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="auth" />
      </div>

      {/* Left Navy Brand Panel */}
      <div className="w-full md:w-5/12 bg-[#0F172A] text-white p-8 sm:p-12 md:p-16 flex flex-col justify-between shrink-0 shadow-lg">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <span className="w-4 h-4 bg-[#2563EB] rounded-xs inline-block" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {t('app.name', 'MelaDesk')}
            </h1>
          </div>
          <p className="text-lg sm:text-xl font-medium text-blue-400 mb-3">
            {t('app.tagline', 'Your Support, Simplified.')}
          </p>
          <p className="text-sm text-slate-300 max-w-sm leading-relaxed">
            {t('app.subtagline', 'One place to ask, track, and resolve.')}
          </p>
        </div>

        <div className="hidden md:block pt-12 border-t border-slate-800 text-xs text-slate-400">
          <p>{t('app.footerTitle', 'MelaDesk Customer Support Ticketing System')}</p>
          <p className="text-slate-500 mt-1">{t('app.designTokens', 'Design tokens: Primary #2563EB · Navy #0F172A · Background #F8FAFC')}</p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full md:w-7/12 flex items-center justify-center p-6 sm:p-12 md:p-16 pt-16 md:pt-16">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
