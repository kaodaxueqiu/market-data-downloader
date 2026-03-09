import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  useRef,
} from 'react';
import { EditorContent } from '@tiptap/react';
import type {
  IMComposerProps,
  IMComposerRef,
  EditorMode,
  MentionSuggestionState,
  ComposerDraft,
} from '../types';
import { defaultLocale } from '../types';
import { usePlainEditor } from '../hooks/usePlainEditor';
import { useAttachments } from '../hooks/useAttachments';
import { MentionPopover } from './MentionPopover';
import { AttachmentPreview } from './AttachmentPreview';
import { RichEditor, type RichEditorRef } from './RichEditor';
import { LocaleProvider } from '../contexts/LocaleContext';

/**
 * IM Composer component supporting plain text and rich text modes.
 */
export const IMComposer = forwardRef<IMComposerRef, IMComposerProps>(function IMComposer(
  {
    mode: controlledMode,
    defaultMode = 'plain',
    onSend,
    onChange,
    onContextMenu,
    onQuoteRemoved,

    // Plain - Mention
    enableMention = true,
    mentionProvider,
    maxMentions,
    onMentionLimitExceeded,
    renderMentionItem,
    mentionPlacement = 'bottom',

    // Plain - Attachments
    enableAttachments = true,
    attachmentPreviewPlacement = 'bottom',
    maxAttachments = 10,
    allowedMimeTypes,
    maxFileSize,
    onAttachmentLimitExceeded,
    onFilesChange,
    showAttachmentPreview = true,

    // Rich
    uploadImage,
    richToolbarConfig,

    // Keymap
    keymap,

    // Common
    placeholder,
    disabled = false,
    className,

    // i18n
    locale: customLocale,
  },
  ref
) {
  const locale = { ...defaultLocale, ...customLocale };

  // Mode state (controlled or uncontrolled)
  const [internalMode, setInternalMode] = useState<EditorMode>(defaultMode);
  const mode = controlledMode ?? internalMode;

  // Mention state
  const [mentionState, setMentionState] = useState<MentionSuggestionState>({
    active: false,
    query: '',
    items: [],
    selectedIndex: 0,
    loading: false,
    error: false,
    command: null,
  });

  // Upload state for rich mode
  const [uploadingCount, setUploadingCount] = useState(0);

  // Rich editor ref
  const richEditorRef = useRef<RichEditorRef>(null);

  // Get placeholder for current mode
  const getPlaceholder = () => {
    if (typeof placeholder === 'string') {
      return placeholder;
    }
    if (placeholder) {
      return mode === 'plain' ? placeholder.plain : placeholder.rich;
    }
    return mode === 'plain' ? locale.placeholderPlain : locale.placeholderRich;
  };

  // Attachments hook
  const attachments = useAttachments({
    maxAttachments,
    maxFileSize,
    allowedMimeTypes,
    onLimitExceeded: onAttachmentLimitExceeded,
    onChange: onFilesChange,
  });

  // Handle send
  const handlePlainSend = useCallback(() => {
    if (disabled) return;

    const payload = plainEditor.exportPayload(attachments.getAttachments());
    if (payload && onSend) {
      onSend(payload);
      plainEditor.clear();
      attachments.clearAttachments();
    }
  }, [disabled, onSend]);

  const handleRichSend = useCallback(() => {
    if (disabled || uploadingCount > 0) return;

    const payload = richEditorRef.current?.exportPayload();
    if (payload && onSend) {
      onSend(payload);
      richEditorRef.current?.clear();
    }
  }, [disabled, onSend, uploadingCount]);

  // Plain editor
  const plainEditor = usePlainEditor({
    placeholder: getPlaceholder(),
    sendKeymap: keymap?.send || 'enter',
    onSend: handlePlainSend,
    enableMention,
    mentionProvider,
    maxMentions,
    onMentionLimitExceeded,
    onMentionStateChange: setMentionState,
    onPasteFiles: enableAttachments ? attachments.addFiles : undefined,
    isUploading: () => false,
    disabled,
    onChange,
    onQuoteRemoved,
  });

  // Handle mention selection
  const handleMentionSelect = useCallback(
    (member: { userId: string; display: string }) => {
      // Use the command from suggestion to properly replace @ trigger
      if (mentionState.command) {
        mentionState.command(member);
      }
      setMentionState((s) => ({ ...s, active: false, command: null }));
    },
    [mentionState.command]
  );

  // Expose ref methods
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (mode === 'plain') {
          plainEditor.focus();
        } else {
          richEditorRef.current?.focus();
        }
      },

      clear: () => {
        if (mode === 'plain') {
          plainEditor.clear();
          attachments.clearAttachments();
        } else {
          richEditorRef.current?.clear();
        }
      },

      exportPayload: () => {
        if (mode === 'plain') {
          return plainEditor.exportPayload(attachments.getAttachments());
        } else {
          return richEditorRef.current?.exportPayload() || null;
        }
      },

      // Rich mode
      importMarkdown: (markdown: string) => {
        richEditorRef.current?.importMarkdown(markdown);
      },

      // Attachments
      getAttachments: () => attachments.getAttachments(),
      setAttachments: (atts) => attachments.setAttachments(atts),
      addFiles: (files) => attachments.addFiles(files),
      removeAttachment: (id) => attachments.removeAttachment(id),
      clearAttachments: () => attachments.clearAttachments(),

      // Quote
      insertQuote: (title: string, content: string) => {
        plainEditor.insertQuote(title, content);
      },

      // Mention
      insertMention: (userId: string, display: string) => {
        plainEditor.insertMention(userId, display);
      },

      // Draft
      getDraft: () => {
        if (mode === 'plain') {
          return plainEditor.getDraft(attachments.getAttachments());
        } else {
          return richEditorRef.current?.getDraft() || { mode: 'rich' };
        }
      },

      setDraft: (draft: ComposerDraft) => {
        if (mode === 'plain') {
          plainEditor.setDraft(draft);
          if (draft.attachments) {
            attachments.setAttachments(draft.attachments);
          }
        } else {
          richEditorRef.current?.setDraft(draft);
        }
      },

      // Text ops
      setText: (text: string) => {
        if (mode === 'plain') {
          plainEditor.setText(text);
        } else {
          richEditorRef.current?.setText(text);
        }
      },

      insertText: (text: string) => {
        if (mode === 'plain') {
          plainEditor.insertText(text);
        } else {
          richEditorRef.current?.insertText(text);
        }
      },
    }),
    [mode, plainEditor, attachments]
  );

  // Render plain mode
  const renderPlainMode = () => (
    <div className="im-composer__plain-wrapper">
      {/* Attachment preview (top) */}
      {showAttachmentPreview &&
        attachmentPreviewPlacement === 'top' &&
        attachments.attachments.length > 0 && (
          <AttachmentPreview
            attachments={attachments.attachments}
            onRemove={attachments.removeAttachment}
            placement="top"
            removeLabel={locale.removeAttachment}
          />
        )}

      {/* Editor */}
      <div className="im-composer__editor-wrapper">
        <EditorContent
          editor={plainEditor.editor}
          className="im-composer__editor"
        />
      </div>

      {/* Mention popover - rendered via Portal to avoid overflow:hidden issues */}
      <MentionPopover
        mentionState={mentionState}
        editor={plainEditor.editor}
        placement={mentionPlacement}
        onSelect={handleMentionSelect}
        onHover={(index) => setMentionState((s) => ({ ...s, selectedIndex: index }))}
        renderItem={renderMentionItem}
        locale={{
          noResults: locale.mentionNoResults,
          loading: locale.mentionLoading,
          error: locale.mentionError,
        }}
      />

      {/* Attachment preview (bottom) */}
      {showAttachmentPreview &&
        attachmentPreviewPlacement === 'bottom' &&
        attachments.attachments.length > 0 && (
          <AttachmentPreview
            attachments={attachments.attachments}
            onRemove={attachments.removeAttachment}
            placement="bottom"
            removeLabel={locale.removeAttachment}
          />
        )}
    </div>
  );

  // Render rich mode
  const renderRichMode = () => (
    <div className="im-composer__rich-wrapper">
      <RichEditor
        ref={richEditorRef}
        placeholder={getPlaceholder()}
        disabled={disabled}
        uploadImage={uploadImage}
        onUploadingChange={setUploadingCount}
        onSend={handleRichSend}
        onChange={onChange}
        sendKeymap={keymap?.send}
        toolbarConfig={richToolbarConfig}
      />
    </div>
  );

  return (
    <LocaleProvider locale={locale}>
      <div
        className={`im-composer ${className || ''} ${disabled ? 'im-composer--disabled' : ''}`}
        onContextMenu={onContextMenu}
      >
        {mode === 'plain' ? renderPlainMode() : renderRichMode()}
      </div>
    </LocaleProvider>
  );
});
