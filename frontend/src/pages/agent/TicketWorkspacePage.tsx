import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import { Textarea } from '../../components/common/Textarea';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { AttachmentList } from '../../components/common/AttachmentList';
import { FileUploadZone } from '../../components/common/FileUploadZone';
import { useAuth } from '../../context/AuthContext';
import { ticketApi } from '../../api/tickets.api';
import { departmentApi } from '../../api/departments.api';
import { userApi, type AgentItem } from '../../api/users.api';
import { attachmentsApi } from '../../api/attachments.api';
import type { Ticket, TicketStatus, Attachment } from '../../types/ticket';
import type { Department } from '../../types/auth';
import { Lock, UserCheck, Paperclip, Plus, X } from 'lucide-react';

export function TicketWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [ticketStatus, setTicketStatus] = useState<TicketStatus>('open');
  const [replyText, setReplyText] = useState('');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingAttId, setDeletingAttId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isUpdatingDept, setIsUpdatingDept] = useState(false);

  const [activeAgents, setActiveAgents] = useState<AgentItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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
          setAttachments(data.attachments || []);
          setSelectedAssignee(data.assignee?.id || '');
          setErrorMessage(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorMessage(err instanceof Error ? err.message : t('tickets.unableToRetrieve', 'Unable to retrieve ticket details'));
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
    if (user?.role === 'admin' || user?.role === 'department_head') {
      userApi.getAgents({ page: 1, pageSize: 100 })
        .then((res) => setActiveAgents(res.agents))
        .catch(() => {});
    }
    if (user?.role === 'admin') {
      departmentApi.getDepartments({ page: 1, pageSize: 100 })
        .then((res) => setDepartments(res.departments))
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
      setFeedbackMessage(t('tickets.replySent', 'Public reply sent to customer.'));
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
      setFeedbackMessage(t('tickets.internalNoteSaved', 'Internal note added (hidden from customer).'));
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
      setFeedbackMessage(
        t('tickets.statusUpdated', {
          status: t(`status.${newStatus}`, newStatus.replace('_', ' ')),
          defaultValue: `Status updated to ${newStatus.replace('_', ' ')}.`,
        })
      );
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
      setSelectedAssignee(updated.assignee?.id || '');
      setFeedbackMessage(t('tickets.claimedSuccess', 'Ticket claimed successfully!'));
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
      setTicket((prev) => (prev ? { ...prev, ...updated, comments: prev.comments } : updated));
      setSelectedAssignee(newAssigneeId);
      setFeedbackMessage(t('tickets.assignmentUpdated', 'Ticket assignment updated.'));
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to assign ticket');
    }
  };

  const handleDepartmentChange = async (newDeptId: string) => {
    if (!id) return;
    setIsUpdatingDept(true);
    setErrorMessage(null);
    try {
      const deptParam = newDeptId === '' ? null : newDeptId;
      const updated = await ticketApi.updateTicketDepartment(id, deptParam);
      setTicket((prev) => (prev ? { ...prev, ...updated, comments: prev.comments, attachments: prev.attachments } : updated));
      setSelectedAssignee(updated.assignee?.id || '');
      setFeedbackMessage(t('tickets.departmentChanged', 'Department updated successfully.'));
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update ticket department');
    } finally {
      setIsUpdatingDept(false);
    }
  };

  const handleUploadFiles = async () => {
    if (!id || pendingFiles.length === 0) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const newAttachments = await attachmentsApi.uploadAttachments(id, pendingFiles);
      setAttachments((prev) => [...prev, ...newAttachments]);
      setPendingFiles([]);
      setShowUploadZone(false);
      setFeedbackMessage(t('attachments.uploadedSuccess', 'Files attached successfully.'));
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to upload attachments.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    if (!id) return;
    if (!window.confirm(t('attachments.deleteConfirm', 'Are you sure you want to delete this attachment?'))) return;

    setDeletingAttId(attId);
    setErrorMessage(null);

    try {
      await attachmentsApi.deleteAttachment(id, attId);
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
      setFeedbackMessage(t('attachments.deletedSuccess', 'Attachment deleted.'));
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete attachment.');
    } finally {
      setDeletingAttId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        {t('tickets.loadingWorkspace', 'Loading ticket workspace...')}
      </div>
    );
  }

  if (errorMessage && !ticket) {
    return (
      <div className="space-y-4">
        <Alert type="error">{errorMessage}</Alert>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          {t('common.goBack', 'Go Back')}
        </Button>
      </div>
    );
  }

  if (!ticket) return null;

  const isAssigned = !!ticket.assignee;
  const isAssignedToMe = ticket.assignee?.id === user?.id;
  const isDeptHeadOfTicket = user?.role === 'department_head' && ticket.departmentId && user.departmentId === ticket.departmentId;
  const canClaim = !isAssigned && ticket.status === 'open' && user?.role === 'agent';
  const canUpdateStatus = isAssignedToMe || user?.role === 'admin' || isDeptHeadOfTicket;
  const canAssign = user?.role === 'admin' || isDeptHeadOfTicket;

  // Filter agents by ticket's department for Admin if ticket has a department
  const eligibleAgents =
    user?.role === 'admin' && ticket.departmentId
      ? activeAgents.filter((ag) => ag.departmentId === ticket.departmentId)
      : activeAgents;

  const agentOptions = [
    { value: '', label: t('tickets.unassigned', 'Unassigned') },
    ...eligibleAgents.map((ag) => ({
      value: ag.id,
      label: ag.name,
    })),
  ];
  if (ticket.assignee && !agentOptions.some((ag) => ag.value === ticket.assignee!.id)) {
    agentOptions.push({
      value: ticket.assignee.id,
      label: ticket.assignee.name,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
            {t('tickets.createdOn', {
              date: new Date(ticket.createdAt).toLocaleDateString(i18n.language === 'am' ? 'am-ET' : 'en-US'),
              defaultValue: `Created on ${new Date(ticket.createdAt).toLocaleDateString()}`,
            })}
          </p>
        </div>

        {/* Claim Ticket Button */}
        {canClaim && (
          <Button
            onClick={handleClaimTicket}
            isLoading={isClaiming}
            disabled={isClaiming}
            leftIcon={<UserCheck className="w-4 h-4" />}
          >
            {t('tickets.claimThisTicket', 'Claim This Ticket')}
          </Button>
        )}
      </div>

      {feedbackMessage && <Alert type="success">{feedbackMessage}</Alert>}
      {errorMessage && <Alert type="error">{errorMessage}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Conversation & Internal Notes */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('tickets.conversation', 'Conversation & Audit History')}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Original Customer Message */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#0F172A]">
                    {ticket.customer?.name || ticket.guestName || t('common.customer', 'Customer')}
                    {ticket.guestEmail && (
                      <span className="text-slate-500 font-normal ml-1">({ticket.guestEmail})</span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(ticket.createdAt).toLocaleString(i18n.language === 'am' ? 'am-ET' : 'en-US', {
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

              {/* Feed: Public Replies & Internal Notes */}
              <div className="space-y-4">
                {ticket.comments?.map((comment) => {
                  const isStaffAuthor = comment.author ? comment.author.role !== 'customer' : false;
                  const isInternal = comment.isInternal;

                  return (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-xl border ${
                        isInternal
                          ? 'bg-amber-50/60 border-amber-200/80 ml-2 sm:ml-4'
                          : isStaffAuthor
                          ? 'bg-blue-50/50 border-blue-200/80 ml-4 sm:ml-8'
                          : 'bg-white border-[#E2E8F0] mr-4 sm:mr-8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          {isInternal && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                              <Lock className="w-3 h-3" />
                              {t('tickets.internalNoteBadge', 'Internal Note')}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-[#0F172A]">
                            {isStaffAuthor
                              ? `${comment.author?.name || t('common.staff', 'Staff')}`
                              : `${ticket.customer?.name || ticket.guestName || t('common.customer', 'Customer')}`}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(comment.createdAt).toLocaleTimeString(i18n.language === 'am' ? 'am-ET' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p
                        className={`text-sm leading-relaxed whitespace-pre-wrap ${
                          isInternal ? 'text-amber-950 font-mono text-xs' : 'text-slate-800'
                        }`}
                      >
                        {comment.body}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Public Reply Input */}
              <form onSubmit={handleSendPublicReply} className="mt-6 pt-6 border-t border-[#E2E8F0] space-y-4">
                <Textarea
                  label={t('tickets.publicReply', 'Public Reply')}
                  placeholder={t('tickets.replyPlaceholder', 'Write a message visible to the customer...')}
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  required
                />
                <div>
                  <Button type="submit" isLoading={isSubmittingReply} disabled={isSubmittingReply}>
                    {t('tickets.sendReply', 'Send Reply')}
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
              <CardTitle>{t('tickets.ticketDetails', 'Ticket details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3.5 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-400 block text-xs">{t('tickets.customer', 'Customer')}</span>
                  <span className="font-semibold text-[#0F172A]">
                    {ticket.customer?.name || ticket.guestName || t('common.customer', 'Customer')}
                  </span>
                  {ticket.guestEmail && (
                    <span className="text-xs text-slate-500 block">
                      {ticket.guestEmail} ({t('portal.guest', 'Guest')})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">{t('tickets.category', 'Category')}</span>
                  <span className="font-medium text-slate-700">
                    {t(`categories.${ticket.category}`, ticket.category)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">{t('tickets.department', 'Department')}</span>
                  <span className="font-medium text-slate-700">
                    {ticket.department?.name || <span className="text-slate-400 italic">{t('common.none', 'None (Unassigned)')}</span>}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs mb-1">{t('tickets.status', 'Status')}</span>
                  <StatusBadge status={ticketStatus} />
                </div>
                <div>
                  <span className="text-slate-400 block text-xs mb-1">{t('tickets.priority', 'Priority')}</span>
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">{t('tickets.assignee', 'Assignee')}</span>
                  <span className="font-medium text-slate-700">
                    {ticket.assignee?.name || t('tickets.unassigned', 'Unassigned')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attachments Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-slate-600" />
                <span>{t('attachments.title', 'Attachments')}</span>
                <span className="text-xs text-slate-400">({attachments.length})</span>
              </CardTitle>

              {ticket.status !== 'closed' && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowUploadZone((prev) => !prev)}
                  className="text-xs text-blue-600 hover:text-blue-700 p-1"
                >
                  {showUploadZone ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {showUploadZone && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <FileUploadZone
                    files={pendingFiles}
                    onChange={setPendingFiles}
                    maxFiles={5 - attachments.length}
                    maxSizeMB={10}
                    disabled={isUploading}
                  />
                  {pendingFiles.length > 0 && (
                    <Button
                      size="sm"
                      className="w-full justify-center"
                      isLoading={isUploading}
                      disabled={isUploading}
                      onClick={handleUploadFiles}
                    >
                      {t('attachments.uploadFilesButton', 'Upload Selected Files')}
                    </Button>
                  )}
                </div>
              )}

              <AttachmentList
                attachments={attachments}
                getDownloadUrl={(attId) => attachmentsApi.getDownloadUrl(ticket.id, attId)}
                onDelete={handleDeleteAttachment}
                canDelete={user?.role === 'admin' || ticket.status !== 'closed'}
                deletingId={deletingAttId}
              />
            </CardContent>
          </Card>

          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle>{t('tickets.ticketControls', 'Ticket Controls')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Update (Allowed for Assigned Agent, Dept Head, or Admin) */}
              {canUpdateStatus && (
                <div>
                  <Select
                    label={t('tickets.updateStatus', 'Update Status')}
                    value={ticketStatus}
                    disabled={isUpdatingStatus}
                    onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                    options={[
                      { value: 'open', label: t('status.open', 'Open') },
                      { value: 'in_progress', label: t('status.in_progress', 'In Progress') },
                      { value: 'pending', label: t('status.pending', 'Pending') },
                      { value: 'resolved', label: t('status.resolved', 'Resolved') },
                      { value: 'closed', label: t('status.closed', 'Closed') },
                    ]}
                  />
                </div>
              )}

              {/* Admin Department Control */}
              {user?.role === 'admin' && (
                <div className="pt-2 border-t border-[#E2E8F0]">
                  <Select
                    label={t('tickets.assignDepartment', 'Department')}
                    value={ticket.departmentId || ''}
                    disabled={isUpdatingDept}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    options={[
                      { value: '', label: t('common.none', 'None (Unassigned)') },
                      ...departments.map((dept) => ({
                        value: dept.id,
                        label: dept.name,
                      })),
                    ]}
                  />
                </div>
              )}

              {/* Assignment Control (Admin or Department Head) */}
              {canAssign && (
                <div className="pt-2 border-t border-[#E2E8F0]">
                  <Select
                    label={t('tickets.assignAgent', 'Assign Agent')}
                    value={selectedAssignee}
                    onChange={(e) => handleAssignAgent(e.target.value)}
                    options={agentOptions}
                  />
                </div>
              )}

              {/* Internal Note Form */}
              <form onSubmit={handleAddInternalNote} className="pt-2 border-t border-[#E2E8F0] space-y-3">
                <Textarea
                  label={t('tickets.privateInternalNoteTitle', 'Private internal note')}
                  placeholder={t('tickets.internalNotePlaceholder', 'Record investigative details or findings (hidden from customer)...')}
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
                  {t('tickets.addInternalNote', 'Add Internal Note')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
