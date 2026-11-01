import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Textarea } from '../../components/common/Textarea';
import { Button } from '../../components/common/Button';
import { Card, CardContent } from '../../components/common/Card';
import { Alert } from '../../components/common/Alert';
import { ticketApi } from '../../api/tickets.api';
import type { TicketCategory, TicketPriority } from '../../types/ticket';

export function CreateTicketPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('technical');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const createdTicket = await ticketApi.createTicket({
        subject,
        description,
        category,
        priority,
      });

      setSuccess(true);
      setTimeout(() => {
        navigate(`/tickets/${createdTicket.id}`);
      }, 1000);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : t('tickets.unableToRetrieve', 'Failed to create ticket. Please check your inputs.');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          {t('tickets.newSupportTicket', 'New support ticket')}
        </h2>
        <p className="text-sm text-[#64748B] mt-0.5">
          {t('tickets.newSupportTicketDesc', 'Submit details about your issue to our customer care team.')}
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {success && (
        <Alert type="success" title={t('tickets.ticketSubmittedTitle', 'Ticket Submitted Successfully')}>
          {t('tickets.ticketSubmittedDesc', 'Your ticket has been recorded. Redirecting to your ticket details...')}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Form Column */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label={t('tickets.subject', 'Subject')}
                placeholder={t('tickets.subjectPlaceholder', 'Briefly summarize your issue')}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />

              <Select
                label={t('tickets.category', 'Category')}
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                options={[
                  { value: 'account', label: t('categories.account', 'Account Access') },
                  { value: 'billing', label: t('categories.billing', 'Billing & Payments') },
                  { value: 'technical', label: t('categories.technical', 'Technical Issue') },
                  { value: 'orders', label: t('categories.orders', 'Orders & Deliveries') },
                  { value: 'general', label: t('categories.general', 'General Question') },
                ]}
              />

              <Select
                label={t('tickets.priority', 'Priority')}
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                options={[
                  { value: 'low', label: t('priority.low', 'Low') },
                  { value: 'normal', label: t('priority.normal', 'Normal') },
                  { value: 'high', label: t('priority.high', 'High') },
                  { value: 'urgent', label: t('priority.urgent', 'Urgent') },
                ]}
              />

              <Textarea
                label={t('tickets.description', 'Description')}
                placeholder={t('tickets.descriptionPlaceholder', 'Describe the issue and expected result')}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              <div className="flex items-center gap-3 pt-3">
                <Button type="submit" isLoading={isLoading} disabled={isLoading || success}>
                  {t('tickets.submitTicket', 'Submit Ticket')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/customer/tickets')}
                  disabled={isLoading}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Helpful Tips Sidebar */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h4 className="font-semibold text-sm text-[#0F172A]">
              {t('tickets.tipsTitle', 'Tips for faster resolution')}
            </h4>
            <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4 leading-relaxed">
              <li>{t('tickets.tip1', 'Provide clear error messages or error codes if visible.')}</li>
              <li>{t('tickets.tip2', 'Explain what you were attempting to do when the issue occurred.')}</li>
              <li>{t('tickets.tip3', 'Select the category that best matches your problem.')}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
