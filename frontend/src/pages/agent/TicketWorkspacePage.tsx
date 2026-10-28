import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Textarea } from '../../components/common/Textarea';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { MOCK_TICKETS, MOCK_COMMENTS } from '../../mocks/mockData';
import { useAuth } from '../../context/AuthContext';
import { Lock } from 'lucide-react';
import type { Comment, TicketStatus } from '../../types/ticket';

export function TicketWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const ticket = MOCK_TICKETS.find((t) => t.id === id) || MOCK_TICKETS[0];
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>(ticket.status);
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS);
  const [replyText, setReplyText] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleSendPublicReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    const newComment: Comment = {
      id: `comm-${Date.now()}`,
      ticketId: ticket.id,
      authorId: user?.id || 'agent-1',
      author: {
        id: user?.id || 'agent-1',
        name: user?.name || 'Abdi Ali',
        role: 'agent',
      },
      body: replyText.trim(),
      isInternal: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setComments((prev) => [...prev, newComment]);
    setReplyText('');
    setFeedbackMessage('Public reply sent to customer.');
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleAddInternalNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!internalNoteText.trim()) return;

    const newNote: Comment = {
      id: `note-${Date.now()}`,
      ticketId: ticket.id,
      authorId: user?.id || 'agent-1',
      author: {
        id: user?.id || 'agent-1',
        name: user?.name || 'Abdi Ali',
        role: 'agent',
      },
      body: internalNoteText.trim(),
      isInternal: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setComments((prev) => [...prev, newNote]);
    setInternalNoteText('');
    setFeedbackMessage('Internal note added (hidden from customer).');
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          #{ticket.id} · {ticket.subject}
        </h2>
      </div>

      {feedbackMessage && <Alert type="success">{feedbackMessage}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Conversation */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {comments.map((comment) => {
                  const isAgent = comment.author?.role === 'agent';
                  const isInternal = comment.isInternal;

                  return (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-xl border ${
                        isInternal
                          ? 'bg-amber-50/60 border-amber-200'
                          : isAgent
                          ? 'bg-blue-50/50 border-blue-200/80 ml-4 sm:ml-8'
                          : 'bg-white border-[#E2E8F0] mr-4 sm:mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5">
                          {isInternal && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              <Lock className="w-3 h-3" /> Private Internal Note
                            </span>
                          )}
                          {!isInternal && (
                            <span>
                              {comment.author?.role === 'agent' ? 'Agent' : 'Customer'} ·{' '}
                              {comment.author?.name}
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
                  label="Reply"
                  placeholder="Write a message..."
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  required
                />
                <div>
                  <Button type="submit">Send Reply</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ticket details & Agent controls */}
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
                    {ticket.customer?.name || 'Amina Yusuf'}
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
                    {ticket.assignee?.name || 'Abdi Ali'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agent controls matching page 13 */}
          <Card>
            <CardHeader>
              <CardTitle>Agent controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                label="Status"
                value={ticketStatus}
                onChange={(e) => {
                  setTicketStatus(e.target.value as TicketStatus);
                  setFeedbackMessage(`Status updated to ${e.target.value}.`);
                  setTimeout(() => setFeedbackMessage(null), 3000);
                }}
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />

              <form onSubmit={handleAddInternalNote} className="pt-2 border-t border-[#E2E8F0] space-y-3">
                <Textarea
                  label="Private internal note"
                  placeholder="Record investigative details or internal findings..."
                  rows={2}
                  value={internalNoteText}
                  onChange={(e) => setInternalNoteText(e.target.value)}
                  required
                />
                <Button type="submit" variant="secondary" size="sm" className="w-full justify-center">
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
