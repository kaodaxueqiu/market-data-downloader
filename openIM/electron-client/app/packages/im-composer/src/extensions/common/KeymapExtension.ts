import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { SendKeymap } from '../../types';

export interface KeymapExtensionOptions {
  /** Send keymap configuration (can be a function for dynamic value) */
  send: SendKeymap | (() => SendKeymap);
  /** Callback when send is triggered */
  onSend?: () => void;
  /** Check if mention list is open */
  isMentionListOpen?: () => boolean;
  /** Check if uploading */
  isUploading?: () => boolean;
  /** Check if composing (IME) */
  isComposing?: () => boolean;
}

export interface KeymapExtensionStorage {
  options: KeymapExtensionOptions;
}

export const keymapPluginKey = new PluginKey('imKeymap');

/**
 * Extension to handle send/newline keyboard shortcuts with proper priority.
 *
 * Priority order (as per PRD):
 * 1. IME composing → ignore all shortcuts
 * 2. Mention list open → ↑↓ Enter Esc for navigation
 * 3. Uploading → disable send
 * 4. Editor default behavior
 * 5. Send keymap
 */
export const KeymapExtension = Extension.create<KeymapExtensionOptions, KeymapExtensionStorage>({
  name: 'imKeymap',

  addOptions() {
    return {
      send: 'enter',
      onSend: undefined,
      isMentionListOpen: () => false,
      isUploading: () => false,
      isComposing: () => false,
    };
  },

  addStorage() {
    return {
      options: this.options,
    };
  },

  addKeyboardShortcuts() {
    const getSend = (): SendKeymap => {
      const { send } = this.options;
      return typeof send === 'function' ? send() : send;
    };

    const isSendKey = (event: KeyboardEvent): boolean => {
      const send = getSend();

      switch (send) {
        case 'enter':
          return event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey;
        case 'ctrlEnter':
          return event.key === 'Enter' && event.ctrlKey;
        case 'cmdEnter':
          return event.key === 'Enter' && event.metaKey;
        default:
          return false;
      }
    };

    const isNewlineKey = (event: KeyboardEvent): boolean => {
      const send = getSend();

      switch (send) {
        case 'enter':
          return event.key === 'Enter' && event.shiftKey;
        case 'ctrlEnter':
        case 'cmdEnter':
          return event.key === 'Enter' && !event.ctrlKey && !event.metaKey;
        default:
          return false;
      }
    };

    return {
      Enter: ({ editor }) => {
        const event = (editor.view.dom.ownerDocument.defaultView as Window & { event?: KeyboardEvent })?.event;
        if (!event) return false;

        // Priority 1: IME composing
        if (this.options.isComposing?.()) {
          return false;
        }

        // Priority 2: Mention list open (handled by mention extension)
        if (this.options.isMentionListOpen?.()) {
          return false;
        }

        // Check for send
        if (isSendKey(event)) {
          // Priority 3: Uploading
          if (this.options.isUploading?.()) {
            return true; // Block send but consume the event
          }

          // Priority 5: Send
          if (this.options.onSend) {
            this.options.onSend();
            return true;
          }
        }

        // Check for newline
        if (isNewlineKey(event)) {
          return editor.commands.first(({ commands }) => [
            () => commands.newlineInCode(),
            () => commands.createParagraphNear(),
            () => commands.liftEmptyBlock(),
            () => commands.splitBlock(),
          ]);
        }

        return false;
      },

      'Shift-Enter': ({ editor }) => {
        const send = getSend();

        if (this.options.isComposing?.()) {
          return false;
        }

        // For 'enter' mode, Shift+Enter creates newline
        if (send === 'enter') {
          return editor.commands.first(({ commands }) => [
            () => commands.newlineInCode(),
            () => commands.createParagraphNear(),
            () => commands.liftEmptyBlock(),
            () => commands.splitBlock(),
          ]);
        }

        return false;
      },

      'Mod-Enter': ({ editor }) => {
        if (this.options.isComposing?.()) {
          return false;
        }

        if (this.options.isMentionListOpen?.()) {
          return false;
        }

        const send = getSend();

        // Mod-Enter is Cmd+Enter on Mac, Ctrl+Enter on Windows/Linux
        if (send === 'cmdEnter' || send === 'ctrlEnter') {
          if (this.options.isUploading?.()) {
            return true;
          }

          if (this.options.onSend) {
            this.options.onSend();
            return true;
          }
        }

        return false;
      },

      // Explicit Ctrl-Enter for Mac (where Mod is Cmd)
      'Ctrl-Enter': () => {
        if (this.options.isComposing?.()) {
          return false;
        }

        if (this.options.isMentionListOpen?.()) {
          return false;
        }

        const send = getSend();

        if (send === 'ctrlEnter') {
          if (this.options.isUploading?.()) {
            return true;
          }

          if (this.options.onSend) {
            this.options.onSend();
            return true;
          }
        }

        return false;
      },
    };
  },
});
