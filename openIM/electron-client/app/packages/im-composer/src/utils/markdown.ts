import type { Editor } from '@tiptap/core';

/**
 * Markdown serializer for Tiptap editor content.
 * Converts the editor document to Markdown string.
 */
export function editorToMarkdown(editor: Editor): string {
  const doc = editor.state.doc;
  return nodeToMarkdown(doc);
}

function nodeToMarkdown(node: any, depth = 0): string {
  const parts: string[] = [];

  node.forEach((child: any, offset: number, index: number) => {
    parts.push(childNodeToMarkdown(child, depth, index));
  });

  return parts.join('');
}

function childNodeToMarkdown(node: any, depth: number, index: number): string {
  const typeName = node.type.name;

  switch (typeName) {
    case 'doc':
      return nodeToMarkdown(node, depth);

    case 'paragraph': {
      const paragraphContent = inlineContentToMarkdown(node);
      const textAlign = node.attrs?.textAlign;
      const prefix = index > 0 ? '\n\n' : '';

      if (textAlign && textAlign !== 'left') {
        return `${prefix}<p align="${textAlign}">${paragraphContent}</p>`;
      }
      return prefix + paragraphContent;
    }

    case 'heading': {
      const level = node.attrs.level || 1;
      const hashPrefix = '#'.repeat(level) + ' ';
      const content = inlineContentToMarkdown(node);
      const textAlign = node.attrs?.textAlign;
      const prefix = index > 0 ? '\n\n' : '';

      if (textAlign && textAlign !== 'left') {
        return `${prefix}<h${level} align="${textAlign}">${content}</h${level}>`;
      }
      return prefix + hashPrefix + content;
    }

    case 'bulletList':
      return (index > 0 ? '\n\n' : '') + listToMarkdown(node, '-', depth);

    case 'orderedList':
      return (index > 0 ? '\n\n' : '') + listToMarkdown(node, '1.', depth);

    case 'listItem':
      return nodeToMarkdown(node, depth);

    case 'blockquote': {
      const content = nodeToMarkdown(node, depth);
      const lines = content.split('\n').map((line) => '> ' + line);
      return (index > 0 ? '\n\n' : '') + lines.join('\n');
    }

    case 'codeBlock': {
      const language = node.attrs.language || '';
      const code = node.textContent;
      return (index > 0 ? '\n\n' : '') + '```' + language + '\n' + code + '\n```';
    }

    case 'horizontalRule':
      return (index > 0 ? '\n\n' : '') + '---';

    case 'hardBreak':
      return '\n';

    case 'image': {
      const { src, alt, title } = node.attrs;
      const titlePart = title ? ` "${title}"` : '';
      return `![${alt || ''}](${src}${titlePart})`;
    }

    default:
      if (node.isText) {
        return formatTextWithMarks(node);
      }
      return node.textContent || '';
  }
}

function listToMarkdown(node: any, marker: string, depth: number): string {
  const items: string[] = [];
  const indent = '  '.repeat(depth);

  node.forEach((item: any, offset: number, index: number) => {
    const itemMarker = marker === '1.' ? `${index + 1}.` : marker;
    const content = inlineContentToMarkdown(item.firstChild);
    items.push(indent + itemMarker + ' ' + content);

    // Handle nested lists
    item.forEach((child: any, childOffset: number, childIndex: number) => {
      if (childIndex > 0) {
        if (child.type.name === 'bulletList' || child.type.name === 'orderedList') {
          items.push(listToMarkdown(child, child.type.name === 'bulletList' ? '-' : '1.', depth + 1));
        }
      }
    });
  });

  return items.join('\n');
}

function inlineContentToMarkdown(node: any): string {
  if (!node) return '';

  const parts: string[] = [];

  node.forEach((child: any) => {
    if (child.isText) {
      parts.push(formatTextWithMarks(child));
    } else if (child.type.name === 'hardBreak') {
      parts.push('\n');
    } else if (child.type.name === 'image') {
      const { src, alt, title } = child.attrs;
      const titlePart = title ? ` "${title}"` : '';
      parts.push(`![${alt || ''}](${src}${titlePart})`);
    } else {
      parts.push(child.textContent || '');
    }
  });

  return parts.join('');
}

function formatTextWithMarks(node: any): string {
  let text = node.text || '';

  if (!node.marks || node.marks.length === 0) {
    return escapeMarkdown(text);
  }

  // Sort marks for consistent output
  const marks = [...node.marks].sort((a, b) => {
    const order = ['link', 'code', 'bold', 'italic', 'strike', 'superscript', 'subscript'];
    return order.indexOf(a.type.name) - order.indexOf(b.type.name);
  });

  for (const mark of marks) {
    switch (mark.type.name) {
      case 'bold':
        text = `**${text}**`;
        break;
      case 'italic':
        text = `*${text}*`;
        break;
      case 'strike':
        text = `~~${text}~~`;
        break;
      case 'code':
        text = `\`${text}\``;
        break;
      case 'link':
        const href = mark.attrs.href || '';
        text = `[${text}](${href})`;
        break;
      case 'superscript':
        text = `<sup>${text}</sup>`;
        break;
      case 'subscript':
        text = `<sub>${text}</sub>`;
        break;
    }
  }

  return text;
}

function escapeMarkdown(text: string): string {
  // Escape special markdown characters in regular text
  // Be conservative - only escape characters that would cause issues
  return text.replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1');
}

/**
 * Parse Markdown to Tiptap-compatible JSON content.
 * This is a simplified parser for the Markdown subset we support.
 */
export function markdownToEditorContent(markdown: string): any {
  const lines = markdown.split('\n');
  const content: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;

      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }

      content.push({
        type: 'codeBlock',
        attrs: { language },
        content: [{ type: 'text', text: codeLines.join('\n') }],
      });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      content.push({
        type: 'heading',
        attrs: { level: headingMatch[1].length },
        content: parseInlineContent(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }

      content.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: parseInlineContent(quoteLines.join('\n')),
          },
        ],
      });
      continue;
    }

    // Horizontal rule
    if (line.match(/^(-{3,}|_{3,}|\*{3,})$/)) {
      content.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    // Bullet list item
    if (line.match(/^[-*+]\s+/)) {
      const items: any[] = [];
      while (i < lines.length && lines[i].match(/^[-*+]\s+/)) {
        const itemText = lines[i].replace(/^[-*+]\s+/, '');
        items.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: parseInlineContent(itemText),
            },
          ],
        });
        i++;
      }

      content.push({
        type: 'bulletList',
        content: items,
      });
      continue;
    }

    // Ordered list item
    const orderedMatch = line.match(/^(\d+)\.\s+/);
    if (orderedMatch) {
      const items: any[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const itemText = lines[i].replace(/^\d+\.\s+/, '');
        items.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: parseInlineContent(itemText),
            },
          ],
        });
        i++;
      }

      content.push({
        type: 'orderedList',
        attrs: { start: parseInt(orderedMatch[1], 10) },
        content: items,
      });
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    content.push({
      type: 'paragraph',
      content: parseInlineContent(line),
    });
    i++;
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
}

function parseInlineContent(text: string): any[] {
  if (!text) return [];

  const content: any[] = [];
  let remaining = text;

  // Simple regex-based parsing for inline elements
  const patterns = [
    // Image: ![alt](url)
    { regex: /!\[([^\]]*)\]\(([^)]+)\)/, type: 'image' },
    // Link: [text](url)
    { regex: /\[([^\]]+)\]\(([^)]+)\)/, type: 'link' },
    // Bold: **text**
    { regex: /\*\*([^*]+)\*\*/, type: 'bold' },
    // Italic: *text*
    { regex: /(?<!\*)\*([^*]+)\*(?!\*)/, type: 'italic' },
    // Strike: ~~text~~
    { regex: /~~([^~]+)~~/, type: 'strike' },
    // Code: `text`
    { regex: /`([^`]+)`/, type: 'code' },
  ];

  while (remaining.length > 0) {
    let earliestMatch: { match: RegExpExecArray; type: string } | null = null;
    let earliestIndex = Infinity;

    for (const pattern of patterns) {
      const match = pattern.regex.exec(remaining);
      if (match && match.index < earliestIndex) {
        earliestMatch = { match, type: pattern.type };
        earliestIndex = match.index;
      }
    }

    if (earliestMatch) {
      // Add text before the match
      if (earliestIndex > 0) {
        content.push({
          type: 'text',
          text: remaining.slice(0, earliestIndex),
        });
      }

      const { match, type } = earliestMatch;

      switch (type) {
        case 'image':
          content.push({
            type: 'image',
            attrs: {
              alt: match[1],
              src: match[2],
            },
          });
          break;
        case 'link':
          content.push({
            type: 'text',
            text: match[1],
            marks: [{ type: 'link', attrs: { href: match[2] } }],
          });
          break;
        case 'bold':
          content.push({
            type: 'text',
            text: match[1],
            marks: [{ type: 'bold' }],
          });
          break;
        case 'italic':
          content.push({
            type: 'text',
            text: match[1],
            marks: [{ type: 'italic' }],
          });
          break;
        case 'strike':
          content.push({
            type: 'text',
            text: match[1],
            marks: [{ type: 'strike' }],
          });
          break;
        case 'code':
          content.push({
            type: 'text',
            text: match[1],
            marks: [{ type: 'code' }],
          });
          break;
      }

      remaining = remaining.slice(earliestIndex + match[0].length);
    } else {
      // No more patterns found, add remaining text
      content.push({
        type: 'text',
        text: remaining,
      });
      break;
    }
  }

  return content;
}
