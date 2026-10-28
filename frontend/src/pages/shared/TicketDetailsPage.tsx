import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Textarea } from '../../components/common/Textarea';
import { Button } from '../../components/common/Button';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge';
import { MOCK_TICKETS, MOCK_COMMENTS } from '../../mocks/mockData';
import { useAuth } from '../../context/AuthContext';
import type { Comment } from '../../types/ticket';

export function TicketDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const ticket = MOCK_TICKETS.find((t) => t.id === id) || MOCK_TICKETS[0];
  const [comments, setComments] = useState<Comment[]>(MOCK_COMMENTS.filter((c) => !c.isInternal));
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setIsSubmitting(true);
    const newComment: Comment = {
      id: `comm-${Date.now()}`,
      ticketId: ticket.id,
      authorId: user?.id || 'user-1',
      author: {
        id: user?.id || 'user-1',
        name: user?.name || 'User',
        role: user?.role || 'customer',
      },
      body: replyText.trim(),
      isInternal: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTimeout(() => {
      setComments((prev) => [...prev, newComment]);
      setReplyText('');
      setIsSubmitting(false);
    }, 400);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          #{ticket.id} · {ticket.subject}
        </h2>
      </div>

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
                  return (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-xl border ${
                        isAgent
                          ? 'bg-blue-50/50 border-blue-200/80 ml-4 sm:ml-8'
                          : 'bg-white border-[#E2E8F0] mr-4 sm:mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-[#0F172A]">
                          {comment.author?.role === 'agent' ? 'Agent' : 'Customer'} ·{' '}
                          {comment.author?.name}
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

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="mt-6 pt-6 border-t border-[#E2E8F0] space-y-4">
                <Textarea
                  label="Reply"
                  placeholder="Write a message..."
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  required
                />
                <div>
                  <Button type="submit" isLoading={isSubmitting}>
                    Send Reply
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ticket Details */}
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
                <StatusBadge status={ticket.status} />
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
      </div>
    </div>
  );
}
