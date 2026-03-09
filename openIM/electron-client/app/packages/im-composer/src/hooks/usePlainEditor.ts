import { useRef, useCallback, useMemo } from 'react';
import { useEditor } from '@tiptap/react';
import { Selection, TextSelection } from '@tiptap/pm/state';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Placeholder from '@tiptap/extension-placeholder';
import { CompositionExtension } from '../extensions/common/CompositionExtension';
import { KeymapExtension } from '../extensions/common/KeymapExtension';
import { PlainTextExtension } from '../extensions/plain/PlainTextExtension';
import { createMentionExtension } from '../extensions/plain/MentionExtension';
import { QuoteExtension } from '../extensions/plain/QuoteExtension';
import type {
  Member,
  MentionSuggestionState,
  SendKeymap,
  ComposerDraft,
  PlainMessagePayload,
  Attachment,
  QuoteInfo,
} from '../types';
import { extractPlainTextWithMentions } from '../utils/mention';

/** Helper to get quote from editor */
function getQuoteFromEditor(editor: ReturnType<typeof useEditor>): QuoteInfo | undefined {
  if (!editor) return undefined;
  const firstNode = editor.state.doc.firstChild;
  if (firstNode?.type.name === 'quote') {
    return {
      title: firstNode.attrs.title,
      content: firstNode.attrs.content,
    };
  }
  return undefined;
}

function syncDomSelection(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  selection: Selection
) {
  const { view } = editor;
  const domSelection = view.dom.ownerDocument.getSelection();
  if (!domSelection) return;

  const from = view.domAtPos(selection.from);
  const to = view.domAtPos(selection.to);

  if (!view.dom.contains(from.node) || !view.dom.contains(to.node)) {
    return;
  }

  const range = view.dom.ownerDocument.createRange();
  try {
    range.setStart(from.node, from.offset);
    if (selection.empty) {
      range.collapse(true);
    } else {
      range.setEnd(to.node, to.offset);
    }
  } catch {
    return;
  }

  domSelection.removeAllRanges();
  domSelection.addRange(range);
}

export interface UsePlainEditorOptions {
  /** Placeholder text */
  placeholder?: string;
  /** Keymap for send */
  sendKeymap?: SendKeymap;
  /** Called when send is triggered */
  onSend?: () => void;
  /** Enable mention */
  enableMention?: boolean;
  /** Mention provider */
  mentionProvider?: (query: string) => Promise<Member[]>;
  /** Max mentions */
  maxMentions?: number;
  /** Called when mention limit is exceeded */
  onMentionLimitExceeded?: () => void;
  /** Called when mention state changes */
  onMentionStateChange?: (state: MentionSuggestionState) => void;
  /** Called when files are pasted */
  onPasteFiles?: (files: File[]) => void;
  /** Get current uploading state */
  isUploading?: () => boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Called on content change */
  onChange?: () => void;
  /** Called when quote is removed */
  onQuoteRemoved?: () => void;
}

export interface UsePlainEditorReturn {
  /** Tiptap editor instance */
  editor: ReturnType<typeof useEditor>;
  /** Check if composing (IME) */
  isComposing: () => boolean;
  /** Check if mention list is open */
  isMentionListOpen: () => boolean;
  /** Export payload */
  exportPayload: (attachments: Attachment[]) => PlainMessagePayload | null;
  /** Get draft */
  getDraft: (attachments: Attachment[]) => ComposerDraft;
  /** Set draft */
  setDraft: (draft: ComposerDraft) => void;
  /** Insert mention programmatically */
  insertMention: (userId: string, display: string) => void;
  /** Insert quote */
  insertQuote: (title: string, content: string) => void;
  /** Remove quote */
  removeQuote: () => void;
  /** Get current quote */
  getQuote: () => QuoteInfo | undefined;
  /** Set text content */
  setText: (text: string) => void;
  /** Insert text at cursor */
  insertText: (text: string) => void;
  /** Clear editor */
  clear: () => void;
  /** Focus editor */
  focus: () => void;
}

/**
 * Hook for managing plain text editor.
 */
export function usePlainEditor(options: UsePlainEditorOptions = {}): UsePlainEditorReturn {
  const {
    placeholder = 'Type a message...',
    sendKeymap = 'enter',
    onSend,
    enableMention = true,
    mentionProvider,
    maxMentions,
    onMentionLimitExceeded,
    onMentionStateChange,
    onPasteFiles,
    isUploading = () => false,
    disabled = false,
    onChange,
    onQuoteRemoved,
  } = options;

  const mentionListOpenRef = useRef(false);
  const compositionRef = useRef(false);
  const sendKeymapRef = useRef(sendKeymap);
  const onSendRef = useRef(onSend);

  // Keep refs in sync
  sendKeymapRef.current = sendKeymap;
  onSendRef.current = onSend;

  // Track mention list state
  const handleMentionStateChange = useCallback(
    (state: MentionSuggestionState) => {
      mentionListOpenRef.current = state.active;
      onMentionStateChange?.(state);
    },
    [onMentionStateChange]
  );

  const extensions = useMemo(() => {
    const exts = [
      Document,
      Paragraph,
      Text,
      HardBreak,
      History,
      Placeholder.configure({
        placeholder,
      }),
      CompositionExtension.configure({
        // Track composition state
      }),
      PlainTextExtension.configure({
        onPasteFiles,
      }),
      KeymapExtension.configure({
        send: () => sendKeymapRef.current,
        onSend: () => onSendRef.current?.(),
        isMentionListOpen: () => mentionListOpenRef.current,
        isUploading,
        isComposing: () => compositionRef.current,
      }),
      QuoteExtension.configure({
        onQuoteRemoved,
        isComposing: () => compositionRef.current,
      }),
    ];

    if (enableMention) {
      exts.push(
        createMentionExtension({
          mentionProvider,
          maxMentions,
          onMentionLimitExceeded,
          onMentionStateChange: handleMentionStateChange,
          isComposing: () => compositionRef.current,
        })
      );
    }

    return exts;
  }, [
    placeholder,
    enableMention,
    mentionProvider,
    maxMentions,
    onMentionLimitExceeded,
    handleMentionStateChange,
    onPasteFiles,
    isUploading,
    onQuoteRemoved,
  ]);

  const editor = useEditor({
    extensions,
    editable: !disabled,
    onUpdate: () => {
      onChange?.();
    },
    onCreate: ({ editor }) => {
      // Update composition state from editor storage
      const updateComposition = () => {
        const storage = editor.storage as unknown as Record<string, { isComposing?: boolean } | undefined>;
        compositionRef.current = storage.composition?.isComposing ?? false;
      };

      // Listen for composition events
      const editorElement = editor.view.dom;
      editorElement.addEventListener('compositionstart', () => {
        compositionRef.current = true;
      });
      editorElement.addEventListener('compositionend', () => {
        compositionRef.current = false;
      });
    },
  });

  const isComposing = useCallback(() => {
    return compositionRef.current;
  }, []);

  const isMentionListOpen = useCallback(() => {
    return mentionListOpenRef.current;
  }, []);

  const exportPayload = useCallback(
    (attachments: Attachment[]): PlainMessagePayload | null => {
      if (!editor) return null;

      const { plainText, mentions } = extractPlainTextWithMentions(editor);
      const quote = getQuoteFromEditor(editor);

      // Empty text and no attachments → null
      if (!plainText.trim() && attachments.length === 0) {
        return null;
      }

      return {
        type: 'text',
        plainText,
        mentions,
        attachments,
        quote,
      };
    },
    [editor]
  );

  const getDraft = useCallback(
    (attachments: Attachment[]): ComposerDraft => {
      if (!editor) {
        return {
          mode: 'plain',
        };
      }

      const { plainText } = extractPlainTextWithMentions(editor);
      const quote = getQuoteFromEditor(editor);

      // Return empty draft if everything is empty
      const isEmpty = !plainText.trim() && !quote && attachments.length === 0;
      if (isEmpty) {
        return {
          mode: 'plain',
        };
      }

      return {
        mode: 'plain',
        editorState: JSON.stringify(editor.getJSON()),
        attachments,
        text: plainText,
        quote,
      };
    },
    [editor]
  );

  const setDraft = useCallback(
    (draft: ComposerDraft) => {
      if (!editor) return;

      try {
        if (draft.json) {
          editor.commands.setContent(draft.json);
        } else if (draft.editorState) {
          const content = JSON.parse(draft.editorState);
          editor.commands.setContent(content);
        }
      } catch (e) {
        console.error('Failed to restore draft:', e);
      }
    },
    [editor]
  );

  const insertMention = useCallback(
    (userId: string, display: string) => {
      if (!editor) return;

      // Check mention limit
      if (maxMentions) {
        let mentionCount = 0;
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'mention') {
            mentionCount++;
          }
        });
        if (mentionCount >= maxMentions) {
          onMentionLimitExceeded?.();
          return;
        }
      }

      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: 'mention',
            attrs: { userId, display },
          },
          { type: 'text', text: ' ' },
        ])
        .run();
    },
    [editor, maxMentions, onMentionLimitExceeded]
  );

  const insertQuote = useCallback(
    (title: string, content: string) => {
      if (!editor) return;
      // Use queueMicrotask to avoid flushSync warning from ReactNodeViewRenderer
      queueMicrotask(() => {
        editor.chain().insertQuote(title, content).run();
        const schedule =
          typeof globalThis.requestAnimationFrame === 'function'
            ? globalThis.requestAnimationFrame.bind(globalThis)
            : (cb: FrameRequestCallback) => globalThis.setTimeout(cb, 0);

        schedule(() => {
          if (!editor.view.hasFocus()) {
            editor.view.focus();
          }
          const { state } = editor;
          let { selection } = state;
          if (!(selection instanceof TextSelection)) {
            const nextTextSelection =
              Selection.findFrom(selection.$from, 1, true) ??
              Selection.findFrom(selection.$from, -1, true);
            if (nextTextSelection) {
              selection = nextTextSelection;
            }
          }
          if (!selection.eq(state.selection)) {
            const tr = state.tr.setSelection(selection);
            tr.setMeta('addToHistory', false);
            editor.view.dispatch(tr);
          }
          // Force DOM selection to match editor state for IME stability.
          syncDomSelection(editor, selection);
        });
      });
    },
    [editor]
  );

  const removeQuote = useCallback(() => {
    if (!editor) return;
    editor.commands.removeQuote();
  }, [editor]);

  const getQuote = useCallback((): QuoteInfo | undefined => {
    return getQuoteFromEditor(editor);
  }, [editor]);

  const setText = useCallback(
    (text: string) => {
      if (!editor) return;

      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: text ? [{ type: 'text', text }] : [],
          },
        ],
      });
    },
    [editor]
  );

  const insertText = useCallback(
    (text: string) => {
      if (!editor) return;
      editor.commands.insertContent(text);
    },
    [editor]
  );

  const clear = useCallback(() => {
    if (!editor) return;
    editor.commands.clearContent();
  }, [editor]);

  const focus = useCallback(() => {
    if (!editor) return;
    editor.commands.focus();
  }, [editor]);

  return {
    editor,
    isComposing,
    isMentionListOpen,
    exportPayload,
    getDraft,
    setDraft,
    insertMention,
    insertQuote,
    removeQuote,
    getQuote,
    setText,
    insertText,
    clear,
    focus,
  };
}
