import { useRef, useState, type ChangeEvent, type DragEvent, type FC } from 'react';
import { FileText, Trash2, UploadCloud } from 'lucide-react';
import { FormField } from '../Form/FormField';
import { Icon } from '../Icon/Icon';

/* ── Helpers ───────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/* ── Stable per-file identity ────────────────────────────────────────
   Keys must stay stable across file removal, duplicate filenames and
   identical sizes. A module-level WeakMap keyed by the File object gives
   a unique, reference-stable id without touching React refs during
   render (which eslint-plugin-react-hooks flags). */

const fileIdByObject = new WeakMap<File, string>();
let fileUid = 0;

function getStableFileId(file: File): string {
  let id = fileIdByObject.get(file);
  if (id === undefined) {
    id = `file-${fileUid++}`;
    fileIdByObject.set(file, id);
  }
  return id;
}

/* ── Props ─────────────────────────────────────────────────────────── */

interface FileUploadProps {
  /** Label text */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Required marker */
  required?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Selected files (controlled) */
  value?: readonly File[];
  /** Default files (uncontrolled) */
  defaultValue?: readonly File[];
  /** Called when the file list changes */
  onChange?: (files: File[]) => void;
  /** Accepted MIME types / extensions (e.g. '.pdf,image/*') */
  accept?: string;
  /** Allow multiple files */
  multiple?: boolean;
  /** Maximum file size in MB (files above are rejected) */
  maxSizeMB?: number;
  /** Drop zone label */
  dropLabel?: string;
  /** Drop zone hint */
  dropHint?: string;
  /** Additional wrapper classes */
  wrapperClassName?: string;
  /** Additional classes */
  className?: string;
}

/**
 * FileUpload — drag-and-drop + click-to-browse file input with size
 * validation and a removable file list. Composes FormField.
 *
 * @example
 * ```tsx
 * <FileUpload
 *   label="Attachments"
 *   accept=".pdf,image/*"
 *   maxSizeMB={5}
 *   value={files}
 *   onChange={setFiles}
 * />
 * ```
 */
export const FileUpload: FC<FileUploadProps> = ({
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  value: controlledValue,
  defaultValue,
  onChange,
  accept,
  multiple = false,
  maxSizeMB,
  dropLabel = 'Drop files here or click to browse',
  dropHint = 'PNG, JPG, PDF up to 10MB',
  wrapperClassName = '',
  className = '',
}) => {
  const [internalFiles, setInternalFiles] = useState<File[]>(() =>
    controlledValue !== undefined ? [...controlledValue] : [...(defaultValue ?? [])],
  );
  const [dragOver, setDragOver] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const files = controlledValue !== undefined ? [...controlledValue] : internalFiles;
  const isControlled = controlledValue !== undefined;

  const update = (next: File[]) => {
    if (!isControlled) setInternalFiles(next);
    onChange?.(next);
  };

  const acceptFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const maxBytes = maxSizeMB ? maxSizeMB * 1024 * 1024 : undefined;

    const oversized = list.filter((f) => maxBytes !== undefined && f.size > maxBytes);
    const accepted = list.filter((f) => maxBytes === undefined || f.size <= maxBytes);

    if (oversized.length > 0) {
      setRejectionMessage(
        `${oversized.length} file${oversized.length > 1 ? 's' : ''} skipped — exceeds ${maxSizeMB}MB limit.`,
      );
    } else {
      setRejectionMessage(null);
    }

    const next = multiple ? [...files, ...accepted] : accepted.slice(0, 1);
    update(next);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) acceptFiles(e.target.files);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files) acceptFiles(e.dataTransfer.files);
  };

  const removeFile = (file: File) => {
    update(files.filter((f) => f !== file));
  };

  return (
    <FormField
      label={label}
      error={error ?? rejectionMessage ?? undefined}
      helperText={helperText}
      required={required}
      disabled={disabled}
      className={wrapperClassName}
    >
      <div className={`space-y-2 ${className}`}>
        {/* Hidden input */}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleInputChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={dropLabel}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`
            flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
            ${
              dragOver
                ? 'border-primary-500 bg-primary-50'
                : 'border-neutral-300 bg-neutral-50/50 hover:border-neutral-400 hover:bg-neutral-50'
            }
            ${disabled ? 'cursor-not-allowed opacity-50' : ''}
            ${error || rejectionMessage ? 'border-danger/40' : ''}
          `}
        >
          <Icon
            icon={UploadCloud}
            size="xl"
            className={dragOver ? 'text-primary-500' : 'text-neutral-400'}
          />
          <p className="text-body-sm font-medium text-neutral-700">{dropLabel}</p>
          <p className="text-caption text-neutral-400">{dropHint}</p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <ul className="space-y-1.5">
            {files.map((file) => (
              <li
                key={getStableFileId(file)}
                className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-3 py-2"
              >
                <Icon icon={FileText} size="sm" className="shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1 truncate text-body-sm text-neutral-800">
                  {file.name}
                </span>
                <span className="shrink-0 text-caption text-neutral-400">
                  {formatBytes(file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(file)}
                  aria-label={`Remove ${file.name}`}
                  disabled={disabled}
                  className="shrink-0 rounded p-1 text-neutral-400 transition-colors duration-100 hover:bg-danger/10 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon icon={Trash2} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormField>
  );
};
