import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, X, FileText, Image, File as FileIcon, AlertCircle } from 'lucide-react';

interface FileUploadZoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
}

const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt', '.csv', '.docx', '.xlsx'];

export function FileUploadZone({
  files,
  onChange,
  maxFiles = 5,
  maxSizeMB = 10,
  disabled = false,
}: FileUploadZoneProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateAndAddFiles = (newFiles: FileList | File[]) => {
    setError(null);
    const addedList = Array.from(newFiles);
    const currentCount = files.length;

    if (currentCount + addedList.length > maxFiles) {
      setError(t('attachments.maxFilesExceeded', `You can upload at most ${maxFiles} files.`));
      return;
    }

    const validNewFiles: File[] = [];
    for (const f of addedList) {
      const ext = '.' + f.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTS.includes(ext)) {
        setError(t('attachments.invalidType', `File "${f.name}" format is not supported.`));
        return;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(t('attachments.oversizedFile', `File "${f.name}" exceeds the ${maxSizeMB}MB limit.`));
        return;
      }
      validNewFiles.push(f);
    }

    onChange([...files, ...validNewFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onChange(updated);
    setError(null);
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="w-4 h-4 text-blue-500" />;
    }
    if (['pdf', 'txt', 'csv'].includes(ext || '')) {
      return <FileText className="w-4 h-4 text-emerald-500" />;
    }
    return <FileIcon className="w-4 h-4 text-indigo-500" />;
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          disabled
            ? 'bg-slate-100 border-slate-300 opacity-60 cursor-not-allowed'
            : isDragging
            ? 'bg-blue-50 border-blue-500'
            : 'bg-slate-50/70 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={disabled}
          className="hidden"
          accept={ALLOWED_EXTS.join(',')}
          onChange={(e) => {
            if (e.target.files) validateAndAddFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
        <p className="text-xs sm:text-sm font-medium text-slate-700">
          {t('attachments.clickOrDrag', 'Click to upload or drag and drop files')}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {t('attachments.allowedFormatsDesc', 'PNG, JPG, PDF, TXT, CSV, DOCX, XLSX (max 10MB each, up to 5 files)')}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selected File Badges */}
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E2E8F0] shadow-2xs text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                {getFileIcon(file.name)}
                <span className="font-medium text-slate-800 truncate">{file.name}</span>
                <span className="text-slate-400 text-[10px] shrink-0 font-mono">({formatSize(file.size)})</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(idx);
                }}
                disabled={disabled}
                className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                title={t('common.remove', 'Remove')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
