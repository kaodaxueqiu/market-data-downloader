import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface PlainTextExtensionOptions {
  /** Callback when files are pasted */
  onPasteFiles?: (files: File[]) => void;
}

export const plainTextPluginKey = new PluginKey('plainText');

/**
 * Serialize document slice to plain text with single newlines between paragraphs.
 */
function serializeToPlainText(slice: any): string {
  let text = '';
  let isFirst = true;

  slice.content.forEach((node: any) => {
    if (node.type.name === 'quote') {
      // Skip quote nodes in clipboard
      return;
    }

    if (node.type.name === 'paragraph') {
      if (!isFirst) {
        text += '\n';
      }
      isFirst = false;

      node.content?.forEach((child: any) => {
        if (child.isText) {
          text += child.text || '';
        } else if (child.type.name === 'mention') {
          text += `@${child.attrs.display || child.attrs.userId}`;
        } else if (child.type.name === 'hardBreak') {
          text += '\n';
        }
      });
    }
  });

  return text;
}

/**
 * Extension for plain text mode.
 * Handles paste events to ensure plain text only and file detection.
 */
export const PlainTextExtension = Extension.create<PlainTextExtensionOptions>({
  name: 'plainText',

  addOptions() {
    return {
      onPasteFiles: undefined,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: plainTextPluginKey,
        props: {
          handlePaste: (view, event) => {
            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            // Check for files
            const files = Array.from(clipboardData.files);
            if (files.length > 0) {
              event.preventDefault();
              extension.options.onPasteFiles?.(files);
              return true;
            }

            // Force plain text paste (strip formatting, keep newlines)
            const text = clipboardData.getData('text/plain');
            if (text) {
              event.preventDefault();

              const { state, dispatch } = view;
              const { tr, schema } = state;

              // Split by newlines and create paragraphs
              const lines = text.split(/\r?\n/);
              const nodes: any[] = [];

              lines.forEach((line, index) => {
                if (index > 0) {
                  // Add hard break for newlines within the paste
                  nodes.push(schema.nodes.hardBreak?.create() || schema.text('\n'));
                }
                if (line) {
                  nodes.push(schema.text(line));
                }
              });

              if (nodes.length > 0) {
                const fragment = state.schema.nodes.doc.create(
                  null,
                  state.schema.nodes.paragraph.create(null, nodes)
                );
                const slice = fragment.slice(1, fragment.content.size - 1);
                dispatch(tr.replaceSelection(slice));
              }

              return true;
            }

            return false;
          },

          // Disable dropping rich content
          handleDrop: (view, event) => {
            const dataTransfer = event.dataTransfer;
            if (!dataTransfer) return false;

            const files = Array.from(dataTransfer.files);
            if (files.length > 0) {
              event.preventDefault();
              extension.options.onPasteFiles?.(files);
              return true;
            }

            return false;
          },

          // Custom clipboard text serializer to avoid double newlines
          clipboardTextSerializer: (slice) => {
            return serializeToPlainText(slice);
          },
        },
      }),
    ];
  },
});
