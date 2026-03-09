import { describe, it, expect } from 'vitest';
import { markdownToEditorContent, editorToMarkdown } from '../utils/markdown';

describe('Markdown Utils', () => {
  describe('markdownToEditorContent', () => {
    it('should parse simple paragraph', () => {
      const content = markdownToEditorContent('Hello world');

      expect(content.type).toBe('doc');
      expect(content.content).toHaveLength(1);
      expect(content.content[0].type).toBe('paragraph');
    });

    it('should parse headings', () => {
      const content = markdownToEditorContent('# Heading 1\n## Heading 2');

      expect(content.content).toHaveLength(2);
      expect(content.content[0].type).toBe('heading');
      expect(content.content[0].attrs.level).toBe(1);
      expect(content.content[1].type).toBe('heading');
      expect(content.content[1].attrs.level).toBe(2);
    });

    it('should parse bullet list', () => {
      const content = markdownToEditorContent('- Item 1\n- Item 2');

      expect(content.content).toHaveLength(1);
      expect(content.content[0].type).toBe('bulletList');
      expect(content.content[0].content).toHaveLength(2);
    });

    it('should parse ordered list', () => {
      const content = markdownToEditorContent('1. First\n2. Second');

      expect(content.content).toHaveLength(1);
      expect(content.content[0].type).toBe('orderedList');
      expect(content.content[0].content).toHaveLength(2);
    });

    it('should parse code block', () => {
      const content = markdownToEditorContent('```js\nconst x = 1;\n```');

      expect(content.content).toHaveLength(1);
      expect(content.content[0].type).toBe('codeBlock');
      expect(content.content[0].attrs.language).toBe('js');
    });

    it('should parse blockquote', () => {
      const content = markdownToEditorContent('> This is a quote');

      expect(content.content).toHaveLength(1);
      expect(content.content[0].type).toBe('blockquote');
    });

    it('should parse inline formatting', () => {
      const content = markdownToEditorContent('**bold** and *italic*');

      expect(content.content[0].content).toBeDefined();
      // Check that bold and italic marks are present
      const boldText = content.content[0].content.find(
        (n: any) => n.marks?.some((m: any) => m.type === 'bold')
      );
      const italicText = content.content[0].content.find(
        (n: any) => n.marks?.some((m: any) => m.type === 'italic')
      );

      expect(boldText).toBeDefined();
      expect(italicText).toBeDefined();
    });

    it('should parse image', () => {
      const content = markdownToEditorContent('![alt text](https://example.com/img.png)');

      const imageNode = content.content[0].content.find((n: any) => n.type === 'image');
      expect(imageNode).toBeDefined();
      expect(imageNode.attrs.src).toBe('https://example.com/img.png');
      expect(imageNode.attrs.alt).toBe('alt text');
    });
  });
});
