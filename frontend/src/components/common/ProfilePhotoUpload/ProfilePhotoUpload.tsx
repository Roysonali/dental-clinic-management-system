import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FC } from 'react';
import { Camera, Image, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../Button/Button';
import { FormField } from '../Form/FormField';
import { Icon } from '../Icon/Icon';

/* ── Constants ──────────────────────────────────────────────────────── */

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.webp';
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const HELPER_TEXT = `JPG, PNG, or WebP · Max ${MAX_FILE_SIZE_MB} MB`;

/* ── Types ──────────────────────────────────────────────────────────── */

export interface ProfilePhotoUploadProps {
  /**
   * Full URL to the existing photo (from the serve endpoint).
   * When set, the component renders the existing photo with replace/remove.
   */
  existingPhotoUrl?: string | null;
  /** Called when a new file is selected (with the File object). */
  onFileSelected?: (file: File | null) => void;
  /** Called when the user requests photo removal. */
  onRemove?: () => void;
  /** Disable all interactions */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Additional wrapper classes */
  className?: string;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtensionLabel(file: File): string {
  const ext = file.name.split('.').pop()?.toUpperCase();
  return ext || 'IMG';
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type as typeof ACCEPTED_MIME_TYPES[number])) {
    const allowed = ACCEPTED_MIME_TYPES.map((t) => t.split('/')[1].toUpperCase()).join(', ');
    return `Please upload a ${allowed} image.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Profile photo must be ${MAX_FILE_SIZE_MB} MB or smaller.`;
  }
  return null;
}

/* ── Component ──────────────────────────────────────────────────────── */

/**
 * ProfilePhotoUpload — profile photo upload control for DensCare forms.
 *
 * Uses FormField for consistent label/error/helper treatment.
 * Uses Button component for action controls.
 * Shows a compact circular avatar preview with inline actions.
 */
export const ProfilePhotoUpload: FC<ProfilePhotoUploadProps> = ({
  existingPhotoUrl,
  onFileSelected,
  onRemove,
  disabled = false,
  error,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const processFile = useCallback(
    (file: File) => {
      const fileError = validateFile(file);
      if (fileError) {
        setValidationError(fileError);
        setSelectedFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        onFileSelected?.(null);
        return;
      }

      setValidationError(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setSelectedFile(file);
      onFileSelected?.(file);
    },
    [previewUrl, onFileSelected],
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processFile(file);
      // Reset the input so re-selecting the same file triggers onChange
      e.target.value = '';
    },
    [processFile],
  );

  const handleRemove = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setValidationError(null);
    onRemove?.();
  }, [previewUrl, onRemove]);

  const handleCancelPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    setValidationError(null);
    onFileSelected?.(null);
  }, [previewUrl, onFileSelected]);

  const handleClick = useCallback(() => {
    if (!disabled) fileInputRef.current?.click();
  }, [disabled]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      // Visual feedback is minimal — no full overlay for a small profile photo
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [disabled, processFile],
  );

  const displayError = validationError || error;
  const hasExistingPhoto = !!existingPhotoUrl && !previewUrl && !imgError;
  const hasPreview = !!previewUrl;

  /** Determine which file info to display. */
  const fileInfo = selectedFile
    ? `${getFileExtensionLabel(selectedFile)} · ${formatFileSize(selectedFile.size)}`
    : null;

  return (
    <FormField
      label="Profile Photo"
      error={displayError}
      helperText={!displayError ? HELPER_TEXT : undefined}
      className={className}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileChange}
        className="sr-only"
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Avatar preview + actions */}
      <div className="flex items-center gap-4">
        {/* Clickable avatar area */}
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={hasPreview ? 'Change profile photo' : 'Upload profile photo'}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`
            relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center
            overflow-hidden rounded-full transition-all duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
            ${hasPreview || hasExistingPhoto
              ? 'bg-neutral-100'
              : 'border-2 border-dashed border-neutral-300 bg-neutral-50 hover:border-primary-400 hover:bg-primary-50/50'
            }
            ${disabled ? 'cursor-not-allowed opacity-50' : ''}
          `}
        >
          {hasPreview && previewUrl && (
            <img
              src={previewUrl}
              alt="Profile photo preview"
              className="h-full w-full object-cover"
            />
          )}
          {hasExistingPhoto && existingPhotoUrl && (
            <img
              key={existingPhotoUrl}
              src={existingPhotoUrl}
              alt="Current profile photo"
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          )}
          {!hasPreview && !hasExistingPhoto && (
            <Icon
              icon={Camera}
              size="lg"
              className={disabled ? 'text-neutral-300' : 'text-neutral-400'}
            />
          )}
          {/* Subtle hover overlay when photo exists */}
          {(hasPreview || hasExistingPhoto) && !disabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/30">
              <Icon icon={Pencil} size="sm" className="text-white opacity-0 transition-opacity hover:opacity-100" />
            </div>
          )}
        </div>

        {/* Actions column */}
        <div className="flex flex-col gap-1.5">
          {/* Primary action: Upload or Change */}
          {!hasExistingPhoto && !hasPreview && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              leftIcon={<Icon icon={Image} size="sm" />}
              onClick={handleClick}
            >
              Upload Photo
            </Button>
          )}

          {hasPreview && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled}
                leftIcon={<Icon icon={Pencil} size="sm" />}
                onClick={handleClick}
              >
                Change Photo
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                leftIcon={<Icon icon={Trash2} size="sm" className="text-danger" />}
                onClick={handleCancelPreview}
                className="text-danger hover:bg-danger/5"
              >
                Remove
              </Button>
            </>
          )}

          {hasExistingPhoto && !hasPreview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              leftIcon={<Icon icon={Trash2} size="sm" className="text-danger" />}
              onClick={handleRemove}
              className="text-danger hover:bg-danger/5"
            >
              Remove
            </Button>
          )}

          {/* File info when a new file is selected */}
          {fileInfo && hasPreview && (
            <p className="text-caption text-neutral-500">{fileInfo}</p>
          )}
        </div>
      </div>
    </FormField>
  );
};
