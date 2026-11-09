import { useState, useEffect, useRef } from 'react';
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
import type { Ticket, Attachment } from '../../types/ticket';
import type { Department } from '../../types/auth';
import { Paperclip, Plus, X } from 'lucide-react';

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
  const [isUpdatingDept, setIsUpdatingDept] = useState(false);

  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingAttId, setDeletingAttId] = useState<string | null>(null);

  // Reply attachments state
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  const [activeAgents, setActiveAgents] = useState<AgentItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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
          setAttachments(data.attachments || []);
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
    if (user?.role === 'admin' || user?.role === 'department_head') {
      userApi
        .getAgents({ page: 1, pageSize: 100 })
        .then((res) => setActiveAgents(res.agents))
        .catch(() => {});
    }
    if (user?.role === 'admin') {
      departmentApi
        .getDepartments({ page: 1, pageSize: 100 })
        .then((res) => setDepartments(res.departments))
        .catch(() => {});
    }
  }, [user?.role]);

  const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt', '.csv', '.docx', '.xlsx'];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleReplyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setError(null);
    const addedList = Array.from(e.target.files);
    const availableSlots = 5 - (attachments.length + replyFiles.length);

    if (addedList.length > availableSlots) {
      setError(t('attachments.maxFilesExceeded', `You can upload at most ${5 - attachments.length} more files.`));
      e.target.value = '';
      return;
    }

    const validFiles: File[] = [];
    for (const f of addedList) {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        setError(t('attachments.invalidType', `File "${f.name}" format is not supported.`));
        e.target.value = '';
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError(t('attachments.oversizedFile', `File "${f.name}" exceeds the 10MB limit.`));
        e.target.value = '';
        return;
      }
      validFiles.push(f);
    }

    setReplyFiles((prev) => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const removeReplyFile = (index: number) => {
    setReplyFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || (!replyText.trim() && replyFiles.length === 0)) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (replyText.trim()) {
        await ticketApi.addComment(id, replyText.trim(), false);
      }

      if (replyFiles.length > 0) {
        const newAttachments = await attachmentsApi.uploadAttachments(id, replyFiles);
        setAttachments((prev) => [...prev, ...newAttachments]);
        setReplyFiles([]);
      }

      setReplyText('');
      setSuccessMessage(t('tickets.replyPosted', 'Reply posted successfully.'));
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
      setTicket((prev) => (prev ? { ...prev, ...updated, comments: prev.comments, attachments: prev.attachments } : updated));
      setSelectedAssignee(newAssigneeId);
      setSuccessMessage(t('tickets.assignmentUpdated'));
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('tickets.unableToRetrieve'));
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDepartmentChange = async (newDeptId: string) => {
    if (!id) return;
    setIsUpdatingDept(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const deptParam = newDeptId === '' ? null : newDeptId;
      const updated = await ticketApi.updateTicketDepartment(id, deptParam);
      setTicket((prev) => (prev ? { ...prev, ...updated, comments: prev.comments, attachments: prev.attachments } : updated));
      setSelectedAssignee(updated.assignee?.id || '');
      setSuccessMessage(t('tickets.departmentChanged', 'Department updated successfully.'));
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update ticket department');
    } finally {
      setIsUpdatingDept(false);
    }
  };

  const handleUploadFiles = async () => {
    if (!id || pendingFiles.length === 0) return;
    setIsUploading(true);
    setError(null);

    try {
      const newAttachments = await attachmentsApi.uploadAttachments(id, pendingFiles);
      setAttachments((prev) => [...prev, ...newAttachments]);
      setPendingFiles([]);
      setShowUploadZone(false);
      setSuccessMessage(t('attachments.uploadedSuccess', 'Files attached successfully.'));
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload attachments.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    if (!id) return;
    if (!window.confirm(t('attachments.deleteConfirm', 'Are you sure you want to delete this attachment?'))) return;

    setDeletingAttId(attId);
    setError(null);

    try {
      await attachmentsApi.deleteAttachment(id, attId);
      setAttachments((prev) => prev.filter((a) => a.id !== attId));
      setSuccessMessage(t('attachments.deletedSuccess', 'Attachment deleted.'));
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete attachment.');
    } finally {
      setDeletingAttId(null);
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

  // Filter agents by ticket department for Admin if ticket has a department
  const eligibleAgents =
    user?.role === 'admin' && ticket.departmentId
      ? activeAgents.filter((ag) => ag.departmentId === ticket.departmentId)
      : activeAgents;

  const agentOptions = [
    { value: '', label: t('tickets.unassigned') },
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

  const canManageAssignment =
    user?.role === 'admin' ||
    (user?.role === 'department_head' && ticket.departmentId && user.departmentId === ticket.departmentId);

  const isCustomerOwner =
    Boolean(user?.id) &&
    (ticket.customer?.id === user?.id || ticket.customerId === user?.id);

  const canUpload =
    ticket.status !== 'closed' &&
    user?.role !== 'head' &&
    (user?.role === 'admin' ||
      isCustomerOwner ||
      ticket.assigneeId === user?.id ||
      ticket.assignee?.id === user?.id ||
      user?.role === 'department_head');

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

      {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {successMessage && <Alert type="success" onDismiss={() => setSuccessMessage(null)}>{successMessage}</Alert>}

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
                    {ticket.customer?.name || ticket.guestName || t('common.customer')}
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
                  required={replyFiles.length === 0}
                />

                {/* Selected Files Preview List */}
                {replyFiles.length > 0 && (
                  <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                      <span>{t('attachments.selectedFiles', 'Attached Files')} ({replyFiles.length})</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        {5 - (attachments.length + replyFiles.length)} {t('attachments.slotsRemaining', 'slots remaining')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {replyFiles.map((file, idx) => (
                        <div
                          key={`${file.name}-${idx}`}
                          className="flex items-center justify-between py-1 px-2.5 bg-white border border-slate-200 rounded text-xs"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <Paperclip className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="font-medium text-slate-800 truncate">{file.name}</span>
                            <span className="text-[11px] text-slate-400 shrink-0">({formatFileSize(file.size)})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeReplyFile(idx)}
                            disabled={isSubmitting}
                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                            title={t('common.remove', 'Remove file')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                  <div className="flex items-center gap-2.5">
                    <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
                      {t('tickets.sendReply')}
                    </Button>

                    {canUpload && (
                      <>
                        <input
                          type="file"
                          ref={replyFileInputRef}
                          onChange={handleReplyFileChange}
                          multiple
                          accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.docx,.xlsx"
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => replyFileInputRef.current?.click()}
                          disabled={isSubmitting || attachments.length + replyFiles.length >= 5}
                          className="flex items-center gap-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                          <span>{t('attachments.attachFile', 'Attach File')}</span>
                        </Button>
                      </>
                    )}
                  </div>

                  {canUpload && replyFiles.length === 0 && (
                    <span className="text-[11px] text-slate-400">
                      {5 - attachments.length} {t('attachments.slotsRemaining', 'slots remaining')} (max 10MB each)
                    </span>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Ticket details & Attachments */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('tickets.ticketDetails')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3.5 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-400 block text-xs">{t('common.customer')}</span>
                  <span className="font-semibold text-[#0F172A]">
                    {ticket.customer?.name || ticket.guestName || t('common.you')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">{t('tickets.category')}</span>
                  <span className="font-medium text-slate-700 capitalize">
                    {ticket.category}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-xs">{t('tickets.department', 'Department')}</span>
                  <span className="font-medium text-slate-700">
                    {ticket.department?.name || <span className="text-slate-400 italic">{t('common.none', 'None (Unassigned)')}</span>}
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

                {/* Admin Department Control */}
                {user?.role === 'admin' && (
                  <div className="pt-3 border-t border-[#E2E8F0]">
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
                {canManageAssignment && (
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

          {/* Attachments Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-slate-600" />
                <span>{t('attachments.title', 'Attachments')}</span>
                <span className="text-xs text-slate-400">({attachments.length})</span>
              </CardTitle>

              {canUpload && (
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
                canDelete={user?.role === 'admin' || (ticket.status !== 'closed' && isCustomerOwner)}
                deletingId={deletingAttId}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
