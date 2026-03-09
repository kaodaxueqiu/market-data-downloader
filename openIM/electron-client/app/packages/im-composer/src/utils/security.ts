/**
 * Allowed protocols for links in rich mode.
 */
export const ALLOWED_LINK_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/**
 * Allowed protocols for images in rich mode.
 */
export const ALLOWED_IMAGE_PROTOCOLS = ['https:', 'http:', 'blob:', 'data:'];

/**
 * Check if a URL has an allowed protocol for links.
 */
export function isAllowedLinkProtocol(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_LINK_PROTOCOLS.includes(parsed.protocol);
  } catch {
    // Invalid URL or relative path
    return true; // Allow relative URLs
  }
}

/**
 * Check if a URL has an allowed protocol for images.
 */
export function isAllowedImageProtocol(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_IMAGE_PROTOCOLS.includes(parsed.protocol);
  } catch {
    // Invalid URL or relative path
    return true; // Allow relative URLs
  }
}

/**
 * Sanitize a URL for links.
 * - Adds https:// if no protocol is present
 * - Returns null if protocol is not allowed (including javascript:, vbscript:, etc.)
 */
export function sanitizeLinkUrl(url: string): string | null {
  if (!url) return null;

  // Check for dangerous protocols BEFORE adding https prefix
  const trimmedUrl = url.trim().toLowerCase();
  if (
    trimmedUrl.startsWith('javascript:') ||
    trimmedUrl.startsWith('vbscript:') ||
    trimmedUrl.startsWith('data:')
  ) {
    return null;
  }

  // Check if URL has a protocol
  if (!url.includes('://') && !url.startsWith('mailto:')) {
    url = 'https://' + url;
  }

  if (!isAllowedLinkProtocol(url)) {
    return null;
  }

  return url;
}

/**
 * Sanitize a URL for images.
 * Returns null if protocol is not allowed.
 */
export function sanitizeImageUrl(url: string): string | null {
  if (!url) return null;

  if (!isAllowedImageProtocol(url)) {
    return null;
  }

  return url;
}

/**
 * Escape HTML entities to prevent XSS.
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Strip HTML tags from text.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Check if text contains potentially dangerous content.
 */
export function containsUnsafeContent(text: string): boolean {
  // Check for javascript: protocol
  if (/javascript:/i.test(text)) {
    return true;
  }

  // Check for data: protocol with script
  if (/data:text\/html/i.test(text)) {
    return true;
  }

  // Check for event handlers
  if (/on\w+\s*=/i.test(text)) {
    return true;
  }

  return false;
}
