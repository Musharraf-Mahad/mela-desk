import { useTranslation } from 'react-i18next';
import type { Attachment } from '../../types/ticket';
import { Download, Trash2, FileText, Image, File as FileIcon } from 'lucide-react';

interface AttachmentListProps {
  attachments: Attachment[];
  getDownloadUrl: (attachmentId: string) => string;
  onDelete?: (attachmentId: string) => void;
  canDelete?: boolean;
  deletingId?: string | null;
}

export function AttachmentList({
  attachments,
  getDownloadUrl,
  onDelete,
  canDelete = false,
  deletingId = null,
}: AttachmentListProps) {
  const { t } = useTranslation();

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string, filename: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="w-4 h-4 text-blue-500 shrink-0" />;
    }
    if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) {
      return <FileText className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    return <FileIcon className="w-4 h-4 text-indigo-500 shrink-0" />;
  };

  if (!attachments || attachments.length === 0) {
    return (
      <p className="text-xs text-slate-400 italic">
        {t('attachments.noAttachments', 'No attachments uploaded.')}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-[#E2E8F0] bg-white overflow-hidden text-xs">
      {attachments.map((att) => (
        <li
          key={att.id}
          className="flex items-center justify-between p-2.5 hover:bg-slate-50/60 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0 pr-3">
            {getFileIcon(att.mimeType, att.originalFilename)}
            <div className="min-w-0">
              <p className="font-medium text-slate-800 truncate" title={att.originalFilename}>
                {att.originalFilename}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                {formatSize(att.fileSize)}
                {att.uploadedBy?.name && (
                  <span className="ml-1 text-slate-500 font-sans">
                    · {att.uploadedBy.name}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={getDownloadUrl(att.id)}
              download={att.originalFilename}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition-colors"
              title={t('attachments.download', 'Download')}
            >
              <Download className="w-3 h-3 text-slate-600" />
              <span>{t('attachments.download', 'Download')}</span>
            </a>

            {canDelete && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(att.id)}
                disabled={deletingId === att.id}
                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors disabled:opacity-50"
                title={t('common.delete', 'Delete')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
