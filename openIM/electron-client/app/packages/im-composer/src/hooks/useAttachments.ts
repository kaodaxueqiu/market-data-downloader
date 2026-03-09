import { useState, useCallback, useRef, useEffect } from 'react';
import type { Attachment, AttachmentLimitReason } from '../types';
import {
  createAttachment,
  revokeAttachmentUrl,
  revokeAllAttachmentUrls,
  validateFile,
} from '../utils/attachment';

export interface UseAttachmentsOptions {
  /** Maximum number of attachments */
  maxAttachments?: number;
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Allowed MIME types */
  allowedMimeTypes?: string[];
  /** Called when limit is exceeded */
  onLimitExceeded?: (reason: AttachmentLimitReason, file: File) => void;
  /** Called when attachments change */
  onChange?: (attachments: Attachment[]) => void;
}

export interface UseAttachmentsReturn {
  /** Current attachments */
  attachments: Attachment[];
  /** Add files to attachments */
  addFiles: (files: FileList | File[]) => void;
  /** Remove attachment by ID */
  removeAttachment: (id: string) => void;
  /** Clear all attachments */
  clearAttachments: () => void;
  /** Set attachments directly */
  setAttachments: (attachments: Attachment[]) => void;
  /** Get current attachments */
  getAttachments: () => Attachment[];
}

/**
 * Hook for managing file attachments with proper objectURL lifecycle.
 */
export function useAttachments(options: UseAttachmentsOptions = {}): UseAttachmentsReturn {
  const {
    maxAttachments = 10,
    maxFileSize,
    allowedMimeTypes,
    onLimitExceeded,
    onChange,
  } = options;

  const [attachments, setAttachmentsState] = useState<Attachment[]>([]);
  const attachmentsRef = useRef<Attachment[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Cleanup all URLs on unmount
  useEffect(() => {
    return () => {
      revokeAllAttachmentUrls(attachmentsRef.current);
    };
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const currentAttachments = attachmentsRef.current;
      const newAttachments: Attachment[] = [];
      let currentCount = currentAttachments.length;

      for (const file of fileArray) {
        const validationError = validateFile(file, currentCount, {
          maxAttachments,
          maxFileSize,
          allowedMimeTypes,
        });

        if (validationError) {
          onLimitExceeded?.(validationError, file);
          continue;
        }

        const attachment = createAttachment(file);
        newAttachments.push(attachment);
        currentCount++;
      }

      if (newAttachments.length > 0) {
        const updated = [...currentAttachments, ...newAttachments];
        setAttachmentsState(updated);
        onChange?.(updated);
      }
    },
    [maxAttachments, maxFileSize, allowedMimeTypes, onLimitExceeded, onChange]
  );

  const removeAttachment = useCallback(
    (id: string) => {
      const attachment = attachmentsRef.current.find((a) => a.id === id);
      if (attachment) {
        revokeAttachmentUrl(attachment);
      }

      const updated = attachmentsRef.current.filter((a) => a.id !== id);
      setAttachmentsState(updated);
      onChange?.(updated);
    },
    [onChange]
  );

  const clearAttachments = useCallback(() => {
    revokeAllAttachmentUrls(attachmentsRef.current);
    setAttachmentsState([]);
    onChange?.([]);
  }, [onChange]);

  const setAttachments = useCallback(
    (newAttachments: Attachment[]) => {
      // Revoke URLs for attachments being removed
      const currentIds = new Set(newAttachments.map((a) => a.id));
      const toRevoke = attachmentsRef.current.filter((a) => !currentIds.has(a.id));
      revokeAllAttachmentUrls(toRevoke);

      // Regenerate previewUrl for images if file exists but previewUrl is missing/invalid
      const processedAttachments = newAttachments.map((att) => {
        if (att.file && att.mime.startsWith('image/')) {
          return {
            ...att,
            previewUrl: URL.createObjectURL(att.file),
          };
        }
        return att;
      });

      setAttachmentsState(processedAttachments);
      onChange?.(processedAttachments);
    },
    [onChange]
  );

  const getAttachments = useCallback(() => {
    return attachmentsRef.current;
  }, []);

  return {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    setAttachments,
    getAttachments,
  };
}
