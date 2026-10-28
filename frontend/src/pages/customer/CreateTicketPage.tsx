import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Textarea } from '../../components/common/Textarea';
import { Button } from '../../components/common/Button';
import { Card, CardContent } from '../../components/common/Card';
import { Alert } from '../../components/common/Alert';
import type { TicketCategory, TicketPriority } from '../../types/ticket';

export function CreateTicketPage() {
  const navigate = useNavigate();

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('technical');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate creation
    setTimeout(() => {
      setIsLoading(false);
      setSuccess(true);
      setTimeout(() => {
        navigate('/customer/tickets');
      }, 1200);
    }, 600);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          New support ticket
        </h2>
      </div>

      {success && (
        <Alert type="success" title="Ticket Submitted Successfully">
          Your ticket has been recorded. Redirecting to your tickets list...
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Form Column */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-0">
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Subject"
                placeholder="Briefly summarize your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />

              <Select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                options={[
                  { value: 'account', label: 'Account Access' },
                  { value: 'billing', label: 'Billing & Payments' },
                  { value: 'technical', label: 'Technical Issue' },
                  { value: 'orders', label: 'Orders' },
                  { value: 'general', label: 'General Question' },
                ]}
              />

              <Select
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'normal', label: 'Normal (Medium)' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
              />

              <Textarea
                label="Description"
                placeholder="Describe the issue and expected result"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              <div className="flex items-center gap-3 pt-3">
                <Button type="submit" isLoading={isLoading}>
                  Submit Ticket
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/customer/tickets')}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Helpful Tips Card */}
        <Card>
          <CardContent className="pt-0">
            <h4 className="text-sm font-semibold text-[#0F172A] mb-3">
              Helpful tips
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm text-[#64748B]">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Use a clear, concise subject</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Include error messages and steps taken</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Never share passwords or confidential credentials</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
