import { Node, mergeAttributes } from '@tiptap/core';
import {
  AllSelection,
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
} from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { QuoteNodeView } from '../../components/QuoteNodeView';

export interface QuoteExtensionOptions {
  /** Callback when quote is removed */
  onQuoteRemoved?: () => void;
  /** Remove button label */
  removeLabel?: string;
  /** Check if composing (IME) */
  isComposing?: () => boolean;
}

const quoteSelectionGuardKey = new PluginKey('quoteSelectionGuard');
const quoteRemovalDetectKey = new PluginKey('quoteRemovalDetect');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    quote: {
      /** Insert a quote at the start of the document */
      insertQuote: (title: string, content: string) => ReturnType;
      /** Remove the quote */
      removeQuote: () => ReturnType;
    };
  }
}

/**
 * Quote node extension for displaying quoted messages in the editor.
 * The quote is always at the top of the document and can be selected/deleted.
 */
export const QuoteExtension = Node.create<QuoteExtensionOptions>({
  name: 'quote',

  addOptions() {
    return {
      onQuoteRemoved: undefined,
      removeLabel: 'Remove quote',
      isComposing: () => false,
    };
  },

  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) => ({
          'data-title': attributes.title,
        }),
      },
      content: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-content'),
        renderHTML: (attributes) => ({
          'data-content': attributes.content,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="quote"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ 'data-type': 'quote', class: 'im-quote-node' }, HTMLAttributes),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuoteNodeView);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: quoteSelectionGuardKey,
        appendTransaction: (transactions, _oldState, newState) => {
          const hasSelectionChange = transactions.some((tr) => tr.selectionSet || tr.docChanged);
          if (!hasSelectionChange) return null;

          const firstNode = newState.doc.firstChild;
          if (!firstNode || firstNode.type.name !== this.name) {
            return null;
          }

          const quoteSize = firstNode.nodeSize;
          const { selection } = newState;

          if (selection instanceof AllSelection) {
            return null;
          }

          const isNodeSelectionOnQuote =
            selection instanceof NodeSelection && selection.node?.type.name === this.name;
          const isCollapsedBeforeOrInQuote = selection.empty && selection.from <= quoteSize;
          const isRangeWithinQuote =
            selection instanceof TextSelection &&
            !selection.empty &&
            selection.from <= quoteSize &&
            selection.to <= quoteSize;

          if (!isNodeSelectionOnQuote && !isCollapsedBeforeOrInQuote && !isRangeWithinQuote) {
            return null;
          }

          let tr = newState.tr;
          const $after = newState.doc.resolve(quoteSize);
          const nextTextSelection = Selection.findFrom($after, 1, true);
          if (nextTextSelection) {
            tr = tr.setSelection(nextTextSelection);
          } else {
            const paragraphType = newState.schema.nodes.paragraph;
            if (!paragraphType) return null;
            const end = newState.doc.content.size;
            tr = tr.insert(end, paragraphType.create());
            tr = tr.setSelection(TextSelection.near(tr.doc.resolve(end + 1)));
          }

          tr.setMeta('addToHistory', false);
          return tr;
        },
      }),
      new Plugin({
        key: quoteRemovalDetectKey,
        appendTransaction: (transactions, oldState, newState) => {
          const hasDocChange = transactions.some((tr) => tr.docChanged);
          if (!hasDocChange) return null;

          const hadQuote = oldState.doc.firstChild?.type.name === this.name;
          const hasQuote = newState.doc.firstChild?.type.name === this.name;

          if (hadQuote && !hasQuote) {
            this.options.onQuoteRemoved?.();
          }

          return null;
        },
      }),
    ];
  },

  addCommands() {
    return {
      insertQuote:
        (title: string, content: string) =>
        ({ tr, dispatch, editor }) => {
          if (dispatch) {
            const node = this.type.create({ title, content });
            // Check if first node is already a quote
            const firstNode = tr.doc.firstChild;
            if (firstNode?.type.name === 'quote') {
              // Replace existing quote
              tr.replaceWith(0, firstNode.nodeSize, node);
            } else {
              // Insert at the beginning
              tr.insert(0, node);
            }
            // Focus at the end of the document
            tr.setSelection(Selection.atEnd(tr.doc));
          }
          return true;
        },

      removeQuote:
        () =>
        ({ tr, dispatch, state }) => {
          if (dispatch) {
            const firstNode = state.doc.firstChild;
            if (firstNode?.type.name === 'quote') {
              const quoteSize = firstNode.nodeSize;
              const { selection } = state;
              // If cursor is after quote, preserve relative position; otherwise go to start
              const cursorAfterQuote = selection.from > quoteSize;
              tr.delete(0, quoteSize);
              if (cursorAfterQuote) {
                const newPos = selection.from - quoteSize;
                tr.setSelection(Selection.near(tr.doc.resolve(newPos)));
              }
              // If cursor was in/before quote, ProseMirror will auto-place it at valid position
            }
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        // Skip during IME composition
        if (this.options.isComposing?.()) {
          return false;
        }

        const { selection } = editor.state;
        if (!(selection instanceof NodeSelection) && !selection.empty) {
          return false;
        }

        const { $anchor, empty } = selection;
        const firstNode = editor.state.doc.firstChild;

        // If quote node is selected, delete it
        if (firstNode?.type.name === 'quote') {
          const quoteSize = firstNode.nodeSize;

          // Cursor is right after quote (at start of first paragraph)
          if (empty && $anchor.pos === quoteSize + 1) {
            editor.commands.removeQuote();
            return true;
          }

          // Quote is selected
          if (selection instanceof NodeSelection && selection.node?.type.name === 'quote') {
            editor.commands.removeQuote();
            return true;
          }
        }

        return false;
      },
      Delete: ({ editor }) => {
        // Skip during IME composition
        if (this.options.isComposing?.()) {
          return false;
        }

        const { selection } = editor.state;
        if (!(selection instanceof NodeSelection) && !selection.empty) {
          return false;
        }

        if (selection instanceof NodeSelection && selection.node?.type.name === 'quote') {
          editor.commands.removeQuote();
          return true;
        }
        return false;
      },
    };
  },
});
