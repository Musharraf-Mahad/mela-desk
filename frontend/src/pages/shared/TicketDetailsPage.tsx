import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Textarea } from '../../components/common/Textarea';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { useAuth } from '../../context/AuthContext';
import { ticketApi } from '../../api/tickets.api';
import { userApi, type AgentItem } from '../../api/users.api';
import type { Ticket } from '../../types/ticket';

export function TicketDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replyText, setReplyText] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [activeAgents, setActiveAgents] = useState<AgentItem[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!id) return;
    (async () => {
      try {
        const data = await ticketApi.getTicketById(id);
        if (isMounted) {
          setTicket(data);
          setSelectedAssignee(data.assignee?.id || '');
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : t('tickets.unableToRetrieve'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [id, refreshTrigger, t]);

  useEffect(() => {
    if (user?.role === 'admin') {
      userApi
        .getAgents({ page: 1, pageSize: 100 })
        .then((res) => setActiveAgents(res.agents))
        .catch(() => {});
    }
  }, [user?.role]);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !replyText.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await ticketApi.addComment(id, replyText.trim(), false);
      setReplyText('');
      setSuccessMessage(t('tickets.replyPosted'));
      setRefreshTrigger((r) => r + 1);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('tickets.unableToRetrieve'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignAgent = async (newAssigneeId: string) => {
    if (!id) return;

    setIsAssigning(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const assigneeParam = newAssigneeId === '' ? null : newAssigneeId;
      const updated = await ticketApi.assignTicket(id, assigneeParam);
      setTicket((prev) => (prev ? { ...prev, ...updated, comments: prev.comments } : updated));
      setSelectedAssignee(newAssigneeId);
      setSuccessMessage(t('tickets.assignmentUpdated'));
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('tickets.unableToRetrieve'));
    } finally {
      setIsAssigning(false);
    }
  };

  const locale = i18n.language === 'am' ? 'am-ET' : 'en-US';

  if (isLoading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        {t('tickets.loadingConversation')}
      </div>
    );
  }

  if (error && !ticket) {
    return (
      <div className="space-y-4">
        <Alert type="error">{error}</Alert>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          {t('common.goBack')}
        </Button>
      </div>
    );
  }

  if (!ticket) return null;

  const agentOptions = [
    { value: '', label: t('tickets.unassigned') },
    ...activeAgents.map((ag) => ({
      value: ag.id,
      label: ag.name,
    })),
  ];
  if (ticket.assignee && !activeAgents.some((ag) => ag.id === ticket.assignee!.id)) {
    agentOptions.push({
      value: ticket.assignee.id,
      label: ticket.assignee.name,
    });
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-mono text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
            {ticket.ticketNumber || `#${ticket.id}`}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">Ref: {ticket.id}</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          {ticket.ticketNumber || `#${ticket.id}`} · {ticket.subject}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {t('tickets.createdOn', { date: new Date(ticket.createdAt).toLocaleDateString(locale) })}
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {successMessage && <Alert type="success">{successMessage}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Conversation */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('tickets.conversation')}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Original Ticket Description */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#0F172A]">
                    {ticket.customer?.name || t('common.customer')}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(ticket.createdAt).toLocaleString(locale, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {ticket.description}
                </p>
              </div>

              {/* Comments */}
              <div className="space-y-4">
                {ticket.comments?.map((comment) => {
                  const isStaff = comment.author?.id !== ticket.customer?.id;
                  return (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-xl border ${
                        isStaff
                          ? 'bg-blue-50/50 border-blue-200/80 ml-4 sm:ml-8'
                          : 'bg-white border-[#E2E8F0] mr-4 sm:mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-[#0F172A]">
                          {isStaff ? t('common.supportStaff') : t('common.you')} · {comment.author?.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(comment.createdAt).toLocaleTimeString(locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {comment.body}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="mt-6 pt-6 border-t border-[#E2E8F0] space-y-4">
                <Textarea
                  label={t('tickets.reply')}
                  placeholder={t('tickets.replyCustomerPlaceholder')}
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  required
                />
                <div>
                  <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
                    {t('tickets.sendReply')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ticket details */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>{t('tickets.ticketDetails')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3.5 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-400 block text-xs">{t('common.customer')}</span>
                  <span className="font-semibold text-[#0F172A]">
                    {ticket.customer?.name || t('common.you')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">{t('tickets.category')}</span>
                  <span className="font-medium text-slate-700 capitalize">
                    {ticket.category}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs mb-1">{t('tickets.status')}</span>
                  <StatusBadge status={ticket.status} />
                </div>
                <div>
                  <span className="text-slate-400 block text-xs mb-1">{t('tickets.priority')}</span>
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">{t('tickets.assignee')}</span>
                  <span className="font-medium text-slate-700">
                    {ticket.assignee?.name || t('tickets.pendingAssignment')}
                  </span>
                </div>

                {user?.role === 'admin' && (
                  <div className="pt-3 border-t border-[#E2E8F0]">
                    <Select
                      label={t('tickets.assignAgent')}
                      value={selectedAssignee}
                      disabled={isAssigning}
                      onChange={(e) => handleAssignAgent(e.target.value)}
                      options={agentOptions}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
