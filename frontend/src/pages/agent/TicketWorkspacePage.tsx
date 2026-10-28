import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Textarea } from '../../components/common/Textarea';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { useAuth } from '../../context/AuthContext';
import { ticketApi } from '../../api/tickets.api';
import { userApi, type AgentItem } from '../../api/users.api';
import type { Ticket, TicketStatus } from '../../types/ticket';
import { Lock, UserCheck } from 'lucide-react';

export function TicketWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>('open');
  const [replyText, setReplyText] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const [activeAgents, setActiveAgents] = useState<AgentItem[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!id) return;
    (async () => {
      try {
        const data = await ticketApi.getTicketById(id);
        if (isMounted) {
          setTicket(data);
          setTicketStatus(data.status);
          setSelectedAssignee(data.assignee?.id || '');
          setErrorMessage(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMessage(err instanceof Error ? err.message : 'Unable to retrieve ticket details');
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
  }, [id, refreshTrigger]);

  useEffect(() => {
    if (user?.role === 'admin') {
      userApi.getAgents({ page: 1, pageSize: 100 })
        .then((res) => setActiveAgents(res.agents))
        .catch(() => {});
    }
  }, [user?.role]);

  const handleSendPublicReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !replyText.trim()) return;

    setIsSubmittingReply(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      await ticketApi.addComment(id, replyText.trim(), false);
      setReplyText('');
      setFeedbackMessage('Public reply sent to customer.');
      setRefreshTrigger((r) => r + 1);
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !internalNoteText.trim()) return;

    setIsSubmittingNote(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      await ticketApi.addComment(id, internalNoteText.trim(), true);
      setInternalNoteText('');
      setFeedbackMessage('Internal note added (hidden from customer).');
      setRefreshTrigger((r) => r + 1);
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save internal note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!id || newStatus === ticketStatus) return;

    setIsUpdatingStatus(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const updated = await ticketApi.updateStatus(id, newStatus);
      setTicketStatus(updated.status);
      setTicket((prev) => (prev ? { ...prev, status: updated.status } : null));
      setFeedbackMessage(`Status updated to ${newStatus.replace('_', ' ')}.`);
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update ticket status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleClaimTicket = async () => {
    if (!id) return;
    setIsClaiming(true);
    setErrorMessage(null);
    try {
      const updated = await ticketApi.claimTicket(id);
      setTicket(updated);
      setFeedbackMessage('Ticket claimed successfully!');
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to claim ticket');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleAssignAgent = async (newAssigneeId: string) => {
    if (!id) return;
    try {
      const assigneeParam = newAssigneeId === '' ? null : newAssigneeId;
      const updated = await ticketApi.assignTicket(id, assigneeParam);
      setTicket(updated);
      setSelectedAssignee(newAssigneeId);
      setFeedbackMessage('Ticket assignment updated.');
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to assign ticket');
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading ticket workspace...
      </div>
    );
  }

  if (errorMessage && !ticket) {
    return (
      <div className="space-y-4">
        <Alert type="error">{errorMessage}</Alert>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  if (!ticket) return null;

  const isAssigned = !!ticket.assignee;
  const isAssignedToMe = ticket.assignee?.id === user?.id;
  const canClaim = !isAssigned && ticket.status === 'open' && user?.role === 'agent';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
            #{ticket.id} · {ticket.subject}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Created on {new Date(ticket.createdAt).toLocaleDateString()} by {ticket.customer?.name}
          </p>
        </div>

        {canClaim && (
          <Button
            onClick={handleClaimTicket}
            isLoading={isClaiming}
            disabled={isClaiming}
            leftIcon={<UserCheck className="w-4 h-4" />}
          >
            Claim Ticket
          </Button>
        )}
      </div>

      {feedbackMessage && <Alert type="success">{feedbackMessage}</Alert>}
      {errorMessage && <Alert type="error">{errorMessage}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Conversation */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Ticket Initial Description */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#0F172A]">
                    Customer · {ticket.customer?.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(ticket.createdAt).toLocaleString([], {
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

              {/* Comments List */}
              <div className="space-y-4">
                {ticket.comments?.map((comment) => {
                  const isInternal = !!comment.isInternal;
                  const isStaff = comment.author?.id !== ticket.customer?.id;

                  return (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-xl border ${
                        isInternal
                          ? 'bg-amber-50/70 border-amber-200'
                          : isStaff
                          ? 'bg-blue-50/50 border-blue-200/80 ml-4 sm:ml-8'
                          : 'bg-white border-[#E2E8F0] mr-4 sm:mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
                          {isInternal ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              <Lock className="w-3 h-3" /> Private Internal Note
                            </span>
                          ) : (
                            <span>
                              {isStaff ? 'Staff' : 'Customer'} · {comment.author?.name}
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(comment.createdAt).toLocaleTimeString([], {
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

              {/* Public Reply Input */}
              <form onSubmit={handleSendPublicReply} className="mt-6 pt-6 border-t border-[#E2E8F0] space-y-4">
                <Textarea
                  label="Public Reply"
                  placeholder="Write a message visible to the customer..."
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  required
                />
                <div>
                  <Button type="submit" isLoading={isSubmittingReply} disabled={isSubmittingReply}>
                    Send Reply
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ticket details & controls */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3.5 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-400 block text-xs">Customer</span>
                  <span className="font-semibold text-[#0F172A]">
                    {ticket.customer?.name || 'Customer'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">Category</span>
                  <span className="font-medium text-slate-700 capitalize">
                    {ticket.category}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs mb-1">Status</span>
                  <StatusBadge status={ticketStatus} />
                </div>
                <div>
                  <span className="text-slate-400 block text-xs mb-1">Priority</span>
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">Assignee</span>
                  <span className="font-medium text-slate-700">
                    {ticket.assignee?.name || 'Unassigned'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Update (Allowed for Assigned Agent or Admin) */}
              {(isAssignedToMe || user?.role === 'admin') && (
                <div>
                  <Select
                    label="Update Status"
                    value={ticketStatus}
                    disabled={isUpdatingStatus}
                    onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                    options={[
                      { value: 'open', label: 'Open' },
                      { value: 'in_progress', label: 'In Progress' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'resolved', label: 'Resolved' },
                      { value: 'closed', label: 'Closed' },
                    ]}
                  />
                </div>
              )}

              {/* Admin Assignment Control */}
              {user?.role === 'admin' && (
                <div className="pt-2 border-t border-[#E2E8F0]">
                  <Select
                    label="Assign Agent"
                    value={selectedAssignee}
                    onChange={(e) => handleAssignAgent(e.target.value)}
                    options={[
                      { value: '', label: 'Unassigned' },
                      ...activeAgents.map((ag) => ({
                        value: ag.id,
                        label: ag.name,
                      })),
                    ]}
                  />
                </div>
              )}

              {/* Internal Note Form */}
              <form onSubmit={handleAddInternalNote} className="pt-2 border-t border-[#E2E8F0] space-y-3">
                <Textarea
                  label="Private internal note"
                  placeholder="Record investigative details or findings (hidden from customer)..."
                  rows={2}
                  value={internalNoteText}
                  onChange={(e) => setInternalNoteText(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  isLoading={isSubmittingNote}
                  disabled={isSubmittingNote}
                >
                  Add Internal Note
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
