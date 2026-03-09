# IM Composer

A dual-mode input editor component for IM (Instant Messaging) applications, built with Tiptap and React.

## Features

### Plain Text Mode

- **@Mention**: Type `@` to trigger member suggestions with async search
- **File Attachments**: Paste or drag files to attach (with preview)
- **Quote Messages**: Insert quoted replies that appear above the editor
- **Atomic Mention Tokens**: Mention tokens cannot be edited - backspace deletes the whole token

### Rich Text Mode

- **Markdown Shortcuts**: Type `**bold**`, `*italic*`, etc.
- **Toolbar**: Bold, italic, headings, lists, blockquote, code block, links
- **Image Upload**: Paste or select images to upload via external handler
- **Markdown Import/Export**: Programmatically set or get Markdown content

### Common Features

- **Mode Isolation**: Plain and rich modes maintain completely separate editor states
- **Configurable Keymap**: Enter/Ctrl+Enter/Cmd+Enter for send
- **IME Support**: Proper handling of CJK input composition
- **Draft Support**: Save and restore editor state
- **i18n Ready**: Customizable locale strings

## Installation

```bash
npm install @openim/im-composer
# or
pnpm add @openim/im-composer
# or
yarn add @openim/im-composer
```

## Quick Start

```tsx
import { useRef } from "react";
import {
  IMComposer,
  type IMComposerRef,
  type PlainMessagePayload,
} from "@openim/im-composer";

function ChatInput() {
  const composerRef = useRef<IMComposerRef>(null);

  const handleSend = (payload: PlainMessagePayload) => {
    console.log("Message:", payload.plainText);
    console.log("Mentions:", payload.mentions);
    console.log("Attachments:", payload.attachments);
  };

  return (
    <IMComposer
      ref={composerRef}
      mode="plain"
      onSend={handleSend}
      enableMention={true}
      mentionProvider={async (query) => {
        // Return filtered members based on query
        const response = await fetch(`/api/members?q=${query}`);
        return response.json();
      }}
      enableAttachments={true}
      placeholder="Type a message..."
    />
  );
}
```

## Props

### Mode Control

| Prop          | Type                | Default   | Description                 |
| ------------- | ------------------- | --------- | --------------------------- |
| `mode`        | `'plain' \| 'rich'` | -         | Controlled mode             |
| `defaultMode` | `'plain' \| 'rich'` | `'plain'` | Initial mode (uncontrolled) |

### Plain Mode - Mentions

| Prop                | Type                                   | Default | Description              |
| ------------------- | -------------------------------------- | ------- | ------------------------ |
| `enableMention`     | `boolean`                              | `true`  | Enable @mention feature  |
| `mentionProvider`   | `(query: string) => Promise<Member[]>` | -       | Async search handler     |
| `maxMentions`       | `number`                               | -       | Maximum mentions allowed |
| `renderMentionItem` | `(props) => ReactNode`                 | -       | Custom mention list item |

### Plain Mode - Attachments

| Prop                         | Type                     | Default    | Description                             |
| ---------------------------- | ------------------------ | ---------- | --------------------------------------- |
| `enableAttachments`          | `boolean`                | `true`     | Enable file attachments                 |
| `maxAttachments`             | `number`                 | `10`       | Maximum attachments                     |
| `maxFileSize`                | `number`                 | -          | Max file size in bytes                  |
| `allowedMimeTypes`           | `string[]`               | -          | Allowed MIME types (supports wildcards) |
| `attachmentPreviewPlacement` | `'top' \| 'bottom'`      | `'bottom'` | Preview bar position                    |
| `onAttachmentLimitExceeded`  | `(reason, file) => void` | -          | Called when limit exceeded              |
| `onFilesChange`              | `(attachments) => void`  | -          | Called when attachments change          |

### Rich Mode

| Prop          | Type                                   | Default | Description          |
| ------------- | -------------------------------------- | ------- | -------------------- |
| `uploadImage` | `(file: File) => Promise<{url, alt?}>` | -       | Image upload handler |

### Keymap

| Prop          | Type                                   | Default   | Description            |
| ------------- | -------------------------------------- | --------- | ---------------------- |
| `keymap.send` | `'enter' \| 'ctrlEnter' \| 'cmdEnter'` | `'enter'` | Send key configuration |

### Common

| Prop             | Type                        | Default | Description                  |
| ---------------- | --------------------------- | ------- | ---------------------------- |
| `placeholder`    | `string \| {plain?, rich?}` | -       | Placeholder text             |
| `disabled`       | `boolean`                   | `false` | Disable the editor           |
| `className`      | `string`                    | -       | Additional CSS class         |
| `locale`         | `IMComposerLocale`          | -       | i18n strings                 |
| `onSend`         | `(payload) => void`         | -       | Called on send               |
| `onChange`       | `() => void`                | -       | Called on content change     |
| `onQuoteRemoved` | `() => void`                | -       | Called when quote is removed |

## Ref Methods

```tsx
interface IMComposerRef {
  focus: () => void;
  clear: () => void;
  exportPayload: () => MessagePayload | null;

  // Rich mode
  importMarkdown: (markdown: string) => void;

  // Attachments (plain mode)
  getAttachments: () => Attachment[];
  setAttachments: (attachments: Attachment[]) => void;
  addFiles: (files: FileList | File[]) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;

  // Quote (plain mode)
  insertQuote: (title: string, content: string) => void;

  // Mention (plain mode)
  insertMention: (userId: string, display: string) => void;

  // Draft
  getDraft: () => ComposerDraft;
  setDraft: (draft: ComposerDraft) => void;

  // Text
  setText: (text: string) => void;
  insertText: (text: string) => void;
}
```

## Payload Types

### Plain Message Payload

```typescript
interface PlainMessagePayload {
  type: "text";
  plainText: string; // Text with mentions as @userId
  mentions: MentionInfo[]; // Mention positions (UTF-16 indices)
  attachments: Attachment[];
  quote?: QuoteInfo;
}

interface MentionInfo {
  userId: string;
  display: string;
  start: number; // UTF-16 index, inclusive
  end: number; // UTF-16 index, exclusive
}
```

### Markdown Message Payload

```typescript
interface MarkdownMessagePayload {
  type: "markdown";
  markdown: string; // Markdown content
}
```

## Implementing mentionProvider

```typescript
const mentionProvider = async (query: string): Promise<Member[]> => {
  const response = await fetch(`/api/members/search?q=${encodeURIComponent(query)}`);

  if (!response.ok) {
    throw new Error("Search failed");
  }

  return response.json();
};

// Member type
interface Member {
  userId: string;
  display: string;
  avatarUrl?: string;
}
```

The provider is called whenever the user types after `@`. Handle errors gracefully - they will be displayed in the mention list.

## Implementing uploadImage

```typescript
const uploadImage = async (file: File): Promise<{ url: string; alt?: string }> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Upload failed");
  }

  const { url } = await response.json();
  return { url, alt: file.name };
};
```

While uploading, `exportPayload()` returns `null` and send is disabled.

## Mention Index Calculation

Mention indices use UTF-16 code units (JavaScript string indices) with half-open intervals `[start, end)`:

```typescript
const plainText = "@alice hello @bob";
//                 ^     ^      ^   ^
//                 0     6      13  17

const mentions = [
  { userId: "alice", display: "Alice", start: 0, end: 6 }, // "@alice"
  { userId: "bob", display: "Bob", start: 13, end: 17 }, // "@bob"
];

// Verify:
plainText.slice(0, 6); // "@alice"
plainText.slice(13, 17); // "@bob"
```

## IME Handling

The component properly handles IME (Input Method Editor) input for CJK languages:

- Mention suggestion is **not** triggered during composition
- Markdown shortcuts are **not** triggered during composition
- Send key is **not** triggered during composition

This prevents unexpected behavior when typing Chinese, Japanese, or Korean.

## FAQ

### How do I switch between modes programmatically?

Use controlled mode with the `mode` prop:

```tsx
const [mode, setMode] = useState<EditorMode>('plain');

<IMComposer mode={mode} />
<button onClick={() => setMode('rich')}>Switch to Rich</button>
```

### How do I save and restore drafts?

```tsx
// Save
const draft = composerRef.current?.getDraft();
localStorage.setItem(`draft:${chatId}`, JSON.stringify(draft));

// Restore
const savedDraft = localStorage.getItem(`draft:${chatId}`);
if (savedDraft) {
  composerRef.current?.setDraft(JSON.parse(savedDraft));
}
```

### Why does exportPayload return null?

`exportPayload()` returns `null` when:

- The editor is empty (no text and no attachments)
- Image upload is in progress (rich mode)

This helps prevent sending empty or incomplete messages.

### How do I customize styles?

The component uses CSS Modules internally. You can override styles using the `className` prop and targeting the internal class names with higher specificity.

## Development

```bash
# Install dependencies
pnpm install

# Start demo
pnpm dev

# Build package
pnpm build

# Run tests
pnpm test
```

## License

MIT
