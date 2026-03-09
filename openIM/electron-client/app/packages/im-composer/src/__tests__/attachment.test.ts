import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAttachment,
  revokeAttachmentUrl,
  revokeAllAttachmentUrls,
  validateFile,
  isMimeTypeAllowed,
  formatFileSize,
} from '../utils/attachment';

describe('Attachment Utils', () => {
  describe('createAttachment', () => {
    it('should create attachment with generated ID', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const attachment = createAttachment(file);

      expect(attachment.id).toMatch(/^att_/);
      expect(attachment.file).toBe(file);
      expect(attachment.name).toBe('test.txt');
      expect(attachment.size).toBe(4);
      expect(attachment.mime).toBe('text/plain');
      expect(attachment.previewUrl).toBeUndefined();
    });

    it('should create preview URL for image files', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const attachment = createAttachment(file);

      expect(attachment.previewUrl).toMatch(/^blob:/);
    });
  });

  describe('revokeAttachmentUrl', () => {
    it('should revoke objectURL for attachment with preview', () => {
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const attachment = createAttachment(file);

      revokeAttachmentUrl(attachment);

      expect(revokeObjectURL).toHaveBeenCalledWith(attachment.previewUrl);
    });

    it('should not fail for attachment without preview', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const attachment = createAttachment(file);

      expect(() => revokeAttachmentUrl(attachment)).not.toThrow();
    });
  });

  describe('revokeAllAttachmentUrls', () => {
    it('should revoke all objectURLs (test case #4)', () => {
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');

      const files = [
        new File(['1'], 'a.png', { type: 'image/png' }),
        new File(['2'], 'b.png', { type: 'image/png' }),
        new File(['3'], 'c.txt', { type: 'text/plain' }),
      ];

      const attachments = files.map(createAttachment);
      revokeAllAttachmentUrls(attachments);

      // Should be called for the 2 image files with previewUrls
      expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe('validateFile', () => {
    it('should reject when count limit exceeded (test case #3)', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = validateFile(file, 10, { maxAttachments: 10 });

      expect(result).toBe('count');
    });

    it('should reject when file size exceeds limit', () => {
      const file = new File(['x'.repeat(1000)], 'test.txt', { type: 'text/plain' });
      const result = validateFile(file, 0, { maxFileSize: 500 });

      expect(result).toBe('size');
    });

    it('should reject when MIME type not allowed', () => {
      const file = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });
      const result = validateFile(file, 0, { allowedMimeTypes: ['image/*', 'text/*'] });

      expect(result).toBe('mime');
    });

    it('should return null for valid file', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const result = validateFile(file, 0, {
        maxAttachments: 10,
        maxFileSize: 1000,
        allowedMimeTypes: ['image/*'],
      });

      expect(result).toBeNull();
    });
  });

  describe('isMimeTypeAllowed', () => {
    it('should match exact MIME type', () => {
      expect(isMimeTypeAllowed('image/png', ['image/png'])).toBe(true);
      expect(isMimeTypeAllowed('image/jpeg', ['image/png'])).toBe(false);
    });

    it('should match wildcard pattern', () => {
      expect(isMimeTypeAllowed('image/png', ['image/*'])).toBe(true);
      expect(isMimeTypeAllowed('image/jpeg', ['image/*'])).toBe(true);
      expect(isMimeTypeAllowed('text/plain', ['image/*'])).toBe(false);
    });

    it('should allow all when no patterns specified', () => {
      expect(isMimeTypeAllowed('anything/here', undefined)).toBe(true);
      expect(isMimeTypeAllowed('anything/here', [])).toBe(true);
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(100)).toBe('100 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
    });
  });
});
