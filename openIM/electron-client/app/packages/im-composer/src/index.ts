// Styles - must be imported by the consumer
import './styles/_variables.scss';
import './styles/_keyframe-animations.scss';

// Node styles
import './components/tiptap-node/blockquote-node/blockquote-node.scss';
import './components/tiptap-node/code-block-node/code-block-node.scss';
import './components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss';
import './components/tiptap-node/list-node/list-node.scss';
import './components/tiptap-node/image-node/image-node.scss';
import './components/tiptap-node/heading-node/heading-node.scss';
import './components/tiptap-node/paragraph-node/paragraph-node.scss';
import './components/tiptap-node/image-upload-node/image-upload-node.scss';

// UI primitive styles
import './components/tiptap-ui-primitive/button/button.scss';
import './components/tiptap-ui-primitive/button/button-colors.scss';
import './components/tiptap-ui-primitive/button/button-group.scss';
import './components/tiptap-ui-primitive/toolbar/toolbar.scss';
import './components/tiptap-ui-primitive/separator/separator.scss';
import './components/tiptap-ui-primitive/tooltip/tooltip.scss';
import './components/tiptap-ui-primitive/dropdown-menu/dropdown-menu.scss';
import './components/tiptap-ui-primitive/popover/popover.scss';
import './components/tiptap-ui-primitive/input/input.scss';
import './components/tiptap-ui-primitive/card/card.scss';
import './components/tiptap-ui-primitive/badge/badge.scss';
import './components/tiptap-ui-primitive/badge/badge-colors.scss';
import './components/tiptap-ui-primitive/badge/badge-group.scss';

// UI component styles
import './components/tiptap-ui/color-highlight-button/color-highlight-button.scss';

// Rich editor styles
import './styles/common.scss';

// Main component
export { IMComposer } from './components/IMComposer';

// Rich Editor component (for standalone use)
export { RichEditor } from './components/RichEditor';
export type { RichEditorProps, RichEditorRef, RichToolbarConfig } from './components/RichEditor';

// Types
export type {
  Attachment,
  MentionInfo,
  Member,
  QuoteInfo,
  PlainMessagePayload,
  MarkdownMessagePayload,
  MessagePayload,
  ComposerDraft,
  IMComposerLocale,
  SendKeymap,
  EditorMode,
  AttachmentLimitReason,
  IMComposerProps,
  IMComposerRef,
  UploadImageResult,
  UploadProgressEvent,
  UploadImageFn,
} from './types';

export { defaultLocale } from './types';

// Locale context (for advanced customization)
export { LocaleProvider, useLocale } from './contexts/LocaleContext';

// Sub-components (for advanced customization)
export { MentionList } from './components/MentionList';
export type { MentionListProps } from './components/MentionList';
export { AttachmentPreview } from './components/AttachmentPreview';
export type { AttachmentPreviewProps } from './components/AttachmentPreview';
export { QuoteBar } from './components/QuoteBar';
export type { QuoteBarProps } from './components/QuoteBar';

// Hooks (for building custom editors)
export { useAttachments } from './hooks/useAttachments';
export type { UseAttachmentsOptions, UseAttachmentsReturn } from './hooks/useAttachments';
export { usePlainEditor } from './hooks/usePlainEditor';
export type { UsePlainEditorOptions, UsePlainEditorReturn } from './hooks/usePlainEditor';

// Utilities
export {
  extractPlainTextWithMentions,
  validateMentionIndices,
  createMentionInfo,
} from './utils/mention';
export {
  createAttachment,
  revokeAttachmentUrl,
  revokeAllAttachmentUrls,
  validateFile,
  formatFileSize,
} from './utils/attachment';
export { editorToMarkdown, markdownToEditorContent } from './utils/markdown';
export {
  sanitizeLinkUrl,
  sanitizeImageUrl,
  isAllowedLinkProtocol,
  isAllowedImageProtocol,
} from './utils/security';
