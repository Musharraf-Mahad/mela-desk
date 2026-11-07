import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LifeBuoy, FilePlus2, Search, LogIn, Globe } from 'lucide-react';

export function PublicSupportPortalPage() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === 'am' ? 'en' : 'am';
    i18n.changeLanguage(next);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E2E8F0] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link to="/support" className="flex items-center gap-2.5">
          <span className="w-3.5 h-3.5 bg-[#2563EB] rounded-xs inline-block" />
          <span className="text-lg font-bold text-[#0F172A] tracking-tight">{t('app.name', 'MelaDesk')}</span>
          <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
            {t('portal.supportPortal', 'Support Portal')}
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            leftIcon={<Globe className="w-4 h-4 text-slate-500" />}
            className="text-xs text-slate-600"
          >
            {i18n.language === 'am' ? 'English' : 'አማርኛ'}
          </Button>

          <Link to="/login">
            <Button size="sm" variant="secondary" leftIcon={<LogIn className="w-4 h-4" />}>
              {t('common.signIn', 'Sign In')}
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Hero & Action Cards */}
      <main className="max-w-4xl mx-auto px-4 py-12 sm:py-16 flex-1 w-full flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-200 shadow-2xs">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
            {t('portal.heroTitle', 'How can we help you today?')}
          </h1>
          <p className="text-slate-600 text-sm sm:text-base mt-2">
            {t('portal.heroSubtitle', 'Submit a support request without an account or securely check the status of your existing ticket.')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Submit Ticket */}
          <Card className="hover:border-blue-300 transition-all shadow-sm hover:shadow-md flex flex-col justify-between">
            <CardContent className="p-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100">
                <FilePlus2 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1.5">
                {t('portal.submitTicketTitle', 'Submit a New Ticket')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                {t('portal.submitTicketDesc', 'Have an issue or inquiry? Submit your ticket with optional attachments and receive a secure tracking token.')}
              </p>
              <Link to="/support/submit">
                <Button className="w-full justify-center">
                  {t('portal.submitTicketButton', 'Submit a Ticket')}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Card 2: Track Ticket */}
          <Card className="hover:border-blue-300 transition-all shadow-sm hover:shadow-md flex flex-col justify-between">
            <CardContent className="p-6">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-4 border border-slate-200">
                <Search className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1.5">
                {t('portal.trackTicketTitle', 'Track an Existing Ticket')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                {t('portal.trackTicketDesc', 'Check the real-time status of your ticket, view public replies from support agents, and download attachments.')}
              </p>
              <Link to="/support/track">
                <Button variant="secondary" className="w-full justify-center">
                  {t('portal.trackTicketButton', 'Track Ticket Status')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 text-center text-xs text-slate-500">
          <span>{t('portal.haveAccount', 'Are you a registered user or staff member?')} </span>
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            {t('portal.loginHere', 'Log in to your workspace')}
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] py-6 px-4 text-center text-xs text-slate-400 bg-white">
        <p>{t('app.footerTitle', 'MelaDesk Customer Support Ticketing System')}</p>
      </footer>
    </div>
  );
}
