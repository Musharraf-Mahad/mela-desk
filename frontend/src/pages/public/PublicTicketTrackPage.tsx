import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { StatusBadge, PriorityBadge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { AttachmentList } from '../../components/common/AttachmentList';
import { publicTicketApi } from '../../api/publicTickets.api';
import type { PublicTicketTrackResponse } from '../../types/ticket';
import { ArrowLeft, Search, RefreshCw, KeyRound, MessageSquare, Paperclip } from 'lucide-react';

export function PublicTicketTrackPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlTicketNumber = searchParams.get('ticketNumber') || '';
  const urlToken = searchParams.get('token') || '';

  const [ticketNumber, setTicketNumber] = useState(urlTicketNumber);
  const [trackingToken, setTrackingToken] = useState(urlToken);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<PublicTicketTrackResponse | null>(null);

  const executeTrack = async (num: string, token: string) => {
    if (!num.trim() || !token.trim()) {
      setError(t('portal.fillBothCredentials', 'Please enter both your ticket number and tracking token.'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await publicTicketApi.trackTicket(num.trim(), token.trim());
      setTicket(data);
      // Synchronize search params in URL
      setSearchParams({ ticketNumber: num.trim(), token: token.trim() });
    } catch (err: unknown) {
      setTicket(null);
      setError(
        err instanceof Error
          ? err.message
          : t('portal.trackFailed', 'No ticket matches the provided ticket number and tracking token.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-track if URL parameters provided
  useEffect(() => {
    if (urlTicketNumber && urlToken) {
      executeTrack(urlTicketNumber, urlToken);
    }
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeTrack(ticketNumber, trackingToken);
  };

  const locale = i18n.language === 'am' ? 'am-ET' : 'en-US';

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-8 sm:py-12 px-4 flex flex-col justify-start">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between">
          <Link
            to="/support"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('portal.backToSupport', 'Back to Support Portal')}</span>
          </Link>

          <Link
            to="/support/submit"
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            {t('portal.submitNewTicketShort', '+ Submit New Ticket')}
          </Link>
        </div>

        {/* Credentials Form (always visible or compact when ticket loaded) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('portal.trackTicketHeader', 'Track Ticket Status')}</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              {t(
                'portal.trackTicketSubheader',
                'Enter your ticket number and tracking token to inspect resolution status and view agent responses.'
              )}
            </p>
          </CardHeader>
          <CardContent>
            {error && <Alert type="error" className="mb-4">{error}</Alert>}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label={t('tickets.ticketNumber', 'Ticket Number')}
                  placeholder="e.g. TKT-000042"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  leftIcon={<Search className="w-4 h-4 text-slate-400" />}
                  required
                />
                <Input
                  label={t('portal.trackingToken', 'Tracking Token')}
                  placeholder="e.g. 9f8e7d6c5b4a3..."
                  value={trackingToken}
                  onChange={(e) => setTrackingToken(e.target.value)}
                  leftIcon={<KeyRound className="w-4 h-4 text-slate-400" />}
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-slate-400">
                  {t('portal.rateLimitNotice', 'Rate-limited for security protection.')}
                </p>
                <Button type="submit" isLoading={isLoading} disabled={isLoading} leftIcon={<Search className="w-4 h-4" />}>
                  {t('portal.checkStatusButton', 'Check Status')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tracked Ticket Results View */}
        {ticket && (
          <div className="space-y-6">
            {/* Header / Summary Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {ticket.ticketNumber}
                      </span>
                      <span className="text-xs text-slate-400 capitalize">
                        {t(`categories.${ticket.category}`, ticket.category)}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      {ticket.subject}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {t('tickets.createdOn', {
                        date: new Date(ticket.createdAt).toLocaleDateString(locale, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => executeTrack(ticketNumber, trackingToken)}
                      title={t('common.refresh', 'Refresh')}
                      className="p-1.5"
                    >
                      <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>

                {/* Description */}
                <div className="pt-4">
                  <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">
                    {t('tickets.description', 'Description')}
                  </h4>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {ticket.description}
                  </div>
                </div>

                {/* Attachments Section */}
                {ticket.attachments && ticket.attachments.length > 0 && (
                  <div className="pt-5">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{t('attachments.title', 'Attachments')}</span>
                      <span>({ticket.attachments.length})</span>
                    </h4>
                    <AttachmentList
                      attachments={ticket.attachments}
                      getDownloadUrl={(attId) =>
                        publicTicketApi.getAttachmentDownloadUrl(ticket.ticketNumber, attId, trackingToken)
                      }
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Public Conversation & Staff Responses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  <span>{t('portal.supportResponses', 'Support Responses & Updates')}</span>
                  <span className="text-xs font-normal text-slate-400">
                    ({ticket.comments.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ticket.comments.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <MessageSquare className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-medium">
                      {t('portal.noRepliesYet', 'No responses from support staff yet. Our team is actively reviewing your request.')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ticket.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-4 rounded-xl border bg-blue-50/50 border-blue-200"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-blue-900">
                            {comment.authorName} · {t('common.supportStaff', 'Support Staff')}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(comment.createdAt).toLocaleTimeString(locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {comment.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
