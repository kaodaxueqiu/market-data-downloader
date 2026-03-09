import { describe, it, expect } from 'vitest';
import {
  sanitizeLinkUrl,
  sanitizeImageUrl,
  isAllowedLinkProtocol,
  isAllowedImageProtocol,
  escapeHtml,
  containsUnsafeContent,
} from '../utils/security';

describe('Security Utils', () => {
  describe('sanitizeLinkUrl', () => {
    it('should accept https URLs', () => {
      expect(sanitizeLinkUrl('https://example.com')).toBe('https://example.com');
    });

    it('should accept http URLs', () => {
      expect(sanitizeLinkUrl('http://example.com')).toBe('http://example.com');
    });

    it('should accept mailto URLs', () => {
      expect(sanitizeLinkUrl('mailto:test@example.com')).toBe('mailto:test@example.com');
    });

    it('should auto-prefix https for URLs without protocol', () => {
      expect(sanitizeLinkUrl('example.com')).toBe('https://example.com');
    });

    it('should reject javascript protocol', () => {
      expect(sanitizeLinkUrl('javascript:alert(1)')).toBeNull();
    });

    it('should return null for empty input', () => {
      expect(sanitizeLinkUrl('')).toBeNull();
    });
  });

  describe('sanitizeImageUrl', () => {
    it('should accept https URLs', () => {
      expect(sanitizeImageUrl('https://example.com/img.png')).toBe('https://example.com/img.png');
    });

    it('should accept blob URLs', () => {
      expect(sanitizeImageUrl('blob:http://localhost/123')).toBe('blob:http://localhost/123');
    });

    it('should accept data URLs', () => {
      expect(sanitizeImageUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    });

    it('should reject javascript protocol', () => {
      expect(sanitizeImageUrl('javascript:alert(1)')).toBeNull();
    });
  });

  describe('isAllowedLinkProtocol', () => {
    it('should allow http, https, mailto', () => {
      expect(isAllowedLinkProtocol('https://example.com')).toBe(true);
      expect(isAllowedLinkProtocol('http://example.com')).toBe(true);
      expect(isAllowedLinkProtocol('mailto:test@example.com')).toBe(true);
    });

    it('should reject other protocols', () => {
      expect(isAllowedLinkProtocol('ftp://example.com')).toBe(false);
      expect(isAllowedLinkProtocol('file:///etc/passwd')).toBe(false);
    });

    it('should allow relative URLs', () => {
      expect(isAllowedLinkProtocol('/path/to/page')).toBe(true);
    });
  });

  describe('isAllowedImageProtocol', () => {
    it('should allow https, http, blob, data', () => {
      expect(isAllowedImageProtocol('https://example.com/img.png')).toBe(true);
      expect(isAllowedImageProtocol('http://example.com/img.png')).toBe(true);
      expect(isAllowedImageProtocol('blob:test')).toBe(true);
      expect(isAllowedImageProtocol('data:image/png;base64,abc')).toBe(true);
    });

    it('should reject javascript protocol', () => {
      expect(isAllowedImageProtocol('javascript:alert(1)')).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('should escape special characters', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
      expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(escapeHtml("'single'")).toBe('&#039;single&#039;');
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });
  });

  describe('containsUnsafeContent', () => {
    it('should detect javascript protocol', () => {
      expect(containsUnsafeContent('javascript:alert(1)')).toBe(true);
      expect(containsUnsafeContent('JAVASCRIPT:foo')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(containsUnsafeContent('onclick=foo()')).toBe(true);
      expect(containsUnsafeContent('onload = bar')).toBe(true);
    });

    it('should detect data text/html', () => {
      expect(containsUnsafeContent('data:text/html,<script>')).toBe(true);
    });

    it('should return false for safe content', () => {
      expect(containsUnsafeContent('Hello world')).toBe(false);
      expect(containsUnsafeContent('https://example.com')).toBe(false);
    });
  });
});
