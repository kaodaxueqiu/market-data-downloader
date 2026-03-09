import type { Attachment, AttachmentLimitReason } from '../types';

/**
 * Generate a unique ID for attachments.
 */
export function generateAttachmentId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create an Attachment object from a File.
 */
export function createAttachment(file: File): Attachment {
  const isImage = file.type.startsWith('image/');

  return {
    id: generateAttachmentId(),
    file,
    name: file.name,
    size: file.size,
    mime: file.type,
    lastModified: file.lastModified,
    previewUrl: isImage ? URL.createObjectURL(file) : undefined,
  };
}

/**
 * Revoke object URL for an attachment.
 */
export function revokeAttachmentUrl(attachment: Attachment): void {
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
}

/**
 * Revoke all object URLs for a list of attachments.
 */
export function revokeAllAttachmentUrls(attachments: Attachment[]): void {
  attachments.forEach(revokeAttachmentUrl);
}

/**
 * Check if a MIME type matches an allowed pattern.
 * Supports wildcards like "image/*".
 */
export function matchesMimeType(mime: string, pattern: string): boolean {
  if (pattern === '*/*' || pattern === '*') {
    return true;
  }

  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return mime.startsWith(prefix + '/');
  }

  return mime === pattern;
}

/**
 * Check if a MIME type is allowed by any of the patterns.
 */
export function isMimeTypeAllowed(mime: string, allowedTypes?: string[]): boolean {
  if (!allowedTypes || allowedTypes.length === 0) {
    return true;
  }

  return allowedTypes.some((pattern) => matchesMimeType(mime, pattern));
}

/**
 * Validate a file against attachment constraints.
 * Returns the reason for rejection, or null if valid.
 */
export function validateFile(
  file: File,
  currentCount: number,
  options: {
    maxAttachments?: number;
    maxFileSize?: number;
    allowedMimeTypes?: string[];
  }
): AttachmentLimitReason | null {
  // Check count limit
  if (options.maxAttachments !== undefined && currentCount >= options.maxAttachments) {
    return 'count';
  }

  // Check file size
  if (options.maxFileSize !== undefined && file.size > options.maxFileSize) {
    return 'size';
  }

  // Check MIME type
  if (!isMimeTypeAllowed(file.type, options.allowedMimeTypes)) {
    return 'mime';
  }

  return null;
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
