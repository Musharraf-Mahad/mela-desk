import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Textarea } from '../../components/common/Textarea';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { FileUploadZone } from '../../components/common/FileUploadZone';
import { publicTicketApi } from '../../api/publicTickets.api';
import type { TicketCategory, PublicTicketSubmissionResponse } from '../../types/ticket';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  Search,
  ShieldAlert,
} from 'lucide-react';

export function PublicTicketSubmitPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Form state
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success state after creation
  const [result, setResult] = useState<PublicTicketSubmissionResponse | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!guestName.trim() || !guestEmail.trim() || !subject.trim() || !description.trim()) {
      setError(t('portal.fillAllRequired', 'Please complete all required fields.'));
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await publicTicketApi.submitTicket({
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        subject: subject.trim(),
        category,
        description: description.trim(),
        files,
      });
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('portal.submitFailed', 'Failed to submit ticket. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = (text: string, type: 'token' | 'number') => {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    } else {
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 2500);
    }
  };

  // If successfully created, display secure credentials view
  if (result) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 flex flex-col justify-center">
        <div className="max-w-xl mx-auto w-full">
          <Card className="border-emerald-200 shadow-md">
            <CardContent className="p-6 sm:p-8 text-center">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                {t('portal.ticketSubmittedSuccess', 'Ticket Submitted Successfully!')}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mb-6">
                {t(
                  'portal.confirmationSentDesc',
                  'We have sent a confirmation email with your ticket number and secure tracking token.'
                )}
              </p>

              {/* Credentials Box */}
              <div className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200 text-left space-y-4 mb-6">
                {/* Ticket Number */}
                <div>
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                    {t('tickets.ticketNumber', 'Ticket Number')}
                  </span>
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 font-mono text-sm font-bold text-blue-600">
                    <span>{result.ticketNumber}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(result.ticketNumber, 'number')}
                      className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 font-sans"
                    >
                      {copiedNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedNumber ? t('common.copied', 'Copied!') : t('common.copy', 'Copy')}</span>
                    </button>
                  </div>
                </div>

                {/* Tracking Token */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                      {t('portal.trackingToken', 'Tracking Token')}
                    </span>
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                      {t('portal.keepSafe', 'Keep this safe')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs font-semibold text-slate-800 break-all">
                    <span className="truncate pr-2">{result.trackingToken}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(result.trackingToken, 'token')}
                      className="text-slate-400 hover:text-slate-600 text-xs flex items-center gap-1 font-sans shrink-0"
                    >
                      {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToken ? t('common.copied', 'Copied!') : t('common.copy', 'Copy')}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-2 border-t border-slate-200 text-xs text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p>
                    {t(
                      'portal.tokenWarning',
                      'You must provide this tracking token to view updates, replies from agents, or download attachments.'
                    )}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  className="w-full justify-center"
                  leftIcon={<Search className="w-4 h-4" />}
                  onClick={() =>
                    navigate(
                      `/support/track?ticketNumber=${encodeURIComponent(
                        result.ticketNumber
                      )}&token=${encodeURIComponent(result.trackingToken)}`
                    )
                  }
                >
                  {t('portal.trackNowButton', 'Track Ticket Status Now')}
                </Button>

                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  onClick={() => {
                    setResult(null);
                    setSubject('');
                    setDescription('');
                    setFiles([]);
                  }}
                >
                  {t('portal.submitAnother', 'Submit Another Ticket')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 sm:py-12 px-4 flex flex-col justify-center">
      <div className="max-w-2xl mx-auto w-full space-y-4">
        {/* Navigation Breadcrumb */}
        <Link
          to="/support"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t('portal.backToSupport', 'Back to Support Portal')}</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{t('portal.submitTicketHeader', 'Submit a Support Ticket')}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              {t(
                'portal.submitTicketSubheader',
                'Please provide clear details regarding your issue. We will respond promptly.'
              )}
            </p>
          </CardHeader>
          <CardContent>
            {error && <Alert type="error" className="mb-4">{error}</Alert>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('portal.yourName', 'Full Name *')}
                  placeholder="e.g. Abebe Kebede"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                />
                <Input
                  label={t('portal.yourEmail', 'Email Address *')}
                  type="email"
                  placeholder="e.g. abebe@example.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('tickets.subject', 'Ticket Subject *')}
                  placeholder="Brief summary of your inquiry"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
                <Select
                  label={t('tickets.category', 'Category *')}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  options={[
                    { value: 'general', label: t('categories.general', 'General Question') },
                    { value: 'account', label: t('categories.account', 'Account Access') },
                    { value: 'billing', label: t('categories.billing', 'Billing & Payments') },
                    { value: 'technical', label: t('categories.technical', 'Technical Issue') },
                    { value: 'orders', label: t('categories.orders', 'Orders & Deliveries') },
                  ]}
                />
              </div>

              <Textarea
                label={t('tickets.description', 'Description *')}
                placeholder="Provide complete details about what happened, steps to reproduce, or any relevant error codes..."
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              {/* Attachments Section */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t('attachments.title', 'File Attachments (Optional)')}
                </label>
                <FileUploadZone
                  files={files}
                  onChange={setFiles}
                  maxFiles={5}
                  maxSizeMB={10}
                  disabled={isSubmitting}
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                <Link to="/support">
                  <Button type="button" variant="ghost">
                    {t('common.cancel', 'Cancel')}
                  </Button>
                </Link>

                <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
                  {t('portal.submitButton', 'Submit Ticket')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
