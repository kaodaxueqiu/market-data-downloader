import type { Editor } from '@tiptap/core';
import type { MentionInfo } from '../types';

/**
 * Extract plain text and mention information from the editor.
 * Mention tokens are output as @{userId} followed by a space.
 *
 * @param editor Tiptap editor instance
 * @returns Object containing plainText and mentions array with UTF-16 indices
 */
export function extractPlainTextWithMentions(editor: Editor): {
  plainText: string;
  mentions: MentionInfo[];
} {
  const mentions: MentionInfo[] = [];
  let plainText = '';

  const doc = editor.state.doc;

  // Track if we need to add space after mention
  let lastWasMention = false;

  doc.descendants((node, pos) => {
    if (node.type.name === 'mention') {
      const userId = node.attrs.userId;
      const display = node.attrs.display;

      // Calculate start index (UTF-16)
      const start = plainText.length;

      // Mention text format: @{userId}
      const mentionText = `@${userId}`;
      plainText += mentionText;

      // End index (exclusive)
      const end = plainText.length;

      mentions.push({
        userId,
        display,
        start,
        end,
      });

      lastWasMention = true;
      return false; // Don't descend into mention node
    }

    if (node.isText) {
      const text = node.text || '';
      // If last was mention and text doesn't start with space, add one
      if (lastWasMention && text.length > 0 && !text.startsWith(' ')) {
        plainText += ' ';
      }
      plainText += text;
      lastWasMention = false;
      return false;
    }

    if (node.type.name === 'hardBreak') {
      // Add space after mention if needed before the line break
      if (lastWasMention) {
        plainText += ' ';
      }
      plainText += '\n';
      lastWasMention = false;
      return false;
    }

    if (node.type.name === 'paragraph') {
      // Add space after mention if needed, then add newline before paragraph (except first)
      if (plainText.length > 0) {
        if (lastWasMention) {
          plainText += ' ';
        }
        if (!plainText.endsWith('\n')) {
          plainText += '\n';
        }
      }
      lastWasMention = false;
      return true; // Descend into paragraph
    }

    return true;
  });

  // If document ends with a mention, add trailing space
  if (lastWasMention) {
    plainText += ' ';
  }

  return { plainText: plainText.trim(), mentions };
}

/**
 * Calculate UTF-16 code unit length of a string.
 * JavaScript strings are already in UTF-16, so this is just the length.
 */
export function utf16Length(str: string): number {
  return str.length;
}

/**
 * Check if mention indices are valid and aligned with the plainText.
 */
export function validateMentionIndices(
  plainText: string,
  mentions: MentionInfo[]
): boolean {
  for (const mention of mentions) {
    if (mention.start < 0 || mention.end > plainText.length || mention.start >= mention.end) {
      return false;
    }

    // Check that the text at the indices matches the expected format
    const extracted = plainText.slice(mention.start, mention.end);
    const expected = `@${mention.userId}`;

    if (extracted !== expected) {
      return false;
    }
  }

  return true;
}

/**
 * Create a mention info object with calculated indices.
 */
export function createMentionInfo(
  userId: string,
  display: string,
  startIndex: number
): MentionInfo {
  const mentionText = `@${userId}`;
  return {
    userId,
    display,
    start: startIndex,
    end: startIndex + utf16Length(mentionText),
  };
}

/**
 * Parse text with @userId mentions and return structured data.
 * This is useful for restoring content from plainText.
 */
export function parseMentionsFromText(
  text: string,
  knownMembers: Map<string, string>
): {
  plainText: string;
  mentions: MentionInfo[];
} {
  const mentions: MentionInfo[] = [];
  const mentionRegex = /@(\w+)/g;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const userId = match[1];
    const display = knownMembers.get(userId) || userId;

    mentions.push({
      userId,
      display,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return { plainText: text, mentions };
}
