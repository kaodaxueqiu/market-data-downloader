import { Node, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Mention from '@tiptap/extension-mention';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import type { Member, MentionSuggestionState } from '../../types';

export interface MentionExtensionOptions {
  /** Provider for mention suggestions */
  mentionProvider?: (query: string) => Promise<Member[]>;
  /** Maximum number of mentions allowed */
  maxMentions?: number;
  /** Callback when mention limit is exceeded */
  onMentionLimitExceeded?: () => void;
  /** Callback when mention state changes */
  onMentionStateChange?: (state: MentionSuggestionState) => void;
  /** Check if composing */
  isComposing?: () => boolean;
}

export const mentionPluginKey = new PluginKey('mentionSuggestion');

/**
 * Custom mention node that extends Tiptap's Mention.
 * The node is atomic (cursor cannot enter) and stores both userId and display.
 */
export const MentionNode = Node.create({
  name: 'mention',

  addOptions() {
    return {
      HTMLAttributes: {},
      renderLabel: ({ node }: { node: any }) => `@${node.attrs.display}`,
      suggestion: {},
    };
  },

  group: 'inline',
  inline: true,
  selectable: false,
  atom: true, // Cannot be split, cursor cannot enter

  addAttributes() {
    return {
      userId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-user-id'),
        renderHTML: (attributes) => ({
          'data-user-id': attributes.userId,
        }),
      },
      display: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-display'),
        renderHTML: (attributes) => ({
          'data-display': attributes.display,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-type': this.name, class: 'im-mention' },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      `@${node.attrs.display}`,
    ];
  },

  renderText({ node }) {
    // Output format: @{userId} (with trailing space handled during export)
    return `@${node.attrs.userId}`;
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isMention = false;
          const { selection } = state;
          const { empty, anchor } = selection;

          if (!empty) {
            return false;
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isMention = true;
              tr.insertText('', pos, pos + node.nodeSize);
              return false;
            }
            return true;
          });

          return isMention;
        }),
    };
  },
});

/**
 * Create mention extension with suggestion functionality.
 */
export function createMentionExtension(options: MentionExtensionOptions) {
  let currentState = {
    active: false,
    query: '',
    items: [] as Member[],
    selectedIndex: 0,
    loading: false,
    error: false,
    command: null as ((member: { userId: string; display: string }) => void) | null,
  };

  const updateState = (updates: Partial<typeof currentState>) => {
    currentState = { ...currentState, ...updates };
    options.onMentionStateChange?.(currentState);
  };

  return Mention.extend({
    name: 'mention',

    addOptions() {
      return {
        ...this.parent?.(),
        suggestion: {
          char: '@',
          pluginKey: mentionPluginKey,
          allowedPrefixes: null, // Allow @ trigger after any character

          items: async ({ query }: { query: string }): Promise<Member[]> => {
            if (!options.mentionProvider) {
              return [];
            }

            updateState({ loading: true, error: false, query });

            try {
              const items = await options.mentionProvider(query);
              updateState({ items, loading: false });
              return items;
            } catch {
              updateState({ error: true, loading: false, items: [] });
              return [];
            }
          },

          render: () => {
            return {
              onStart: (props: SuggestionProps) => {
                // Wrap command to match our interface
                const wrappedCommand = (member: { userId: string; display: string }) => {
                  (props.command as any)({
                    userId: member.userId,
                    display: member.display,
                  });
                };

                updateState({
                  active: true,
                  query: props.query,
                  selectedIndex: 0,
                  command: wrappedCommand,
                });
              },

              onUpdate: (props: SuggestionProps) => {
                // Wrap command to match our interface
                const wrappedCommand = (member: { userId: string; display: string }) => {
                  (props.command as any)({
                    userId: member.userId,
                    display: member.display,
                  });
                };

                updateState({
                  query: props.query,
                  selectedIndex: 0,
                  command: wrappedCommand,
                });
              },

              onKeyDown: (props: SuggestionKeyDownProps): boolean => {
                const { event } = props;

                // Don't handle keys during IME composition
                if (options.isComposing?.() || event.isComposing) {
                  return false;
                }

                if (event.key === 'ArrowUp') {
                  updateState({
                    selectedIndex:
                      (currentState.selectedIndex - 1 + currentState.items.length) %
                      currentState.items.length,
                  });
                  return true;
                }

                if (event.key === 'ArrowDown') {
                  updateState({
                    selectedIndex: (currentState.selectedIndex + 1) % currentState.items.length,
                  });
                  return true;
                }

                if (event.key === 'Enter') {
                  const selectedMember = currentState.items[currentState.selectedIndex];
                  if (selectedMember && currentState.command) {
                    currentState.command({
                      userId: selectedMember.userId,
                      display: selectedMember.display,
                    });
                  }
                  return true;
                }

                if (event.key === 'Escape') {
                  updateState({ active: false, command: null });
                  return true;
                }

                return false;
              },

              onExit: () => {
                updateState({
                  active: false,
                  query: '',
                  items: [],
                  selectedIndex: 0,
                  loading: false,
                  error: false,
                  command: null,
                });
              },
            };
          },

          command: ({ editor, range, props }: { editor: any; range: any; props: any }) => {
            // Check mention limit
            if (options.maxMentions) {
              let mentionCount = 0;
              editor.state.doc.descendants((node: any) => {
                if (node.type.name === 'mention') {
                  mentionCount++;
                }
              });
              if (mentionCount >= options.maxMentions) {
                // Delete the @query text when limit reached
                editor.chain().focus().deleteRange(range).run();
                options.onMentionLimitExceeded?.();
                return;
              }
            }

            // Insert mention node without trailing space
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: 'mention',
                  attrs: {
                    userId: props.userId,
                    display: props.display,
                  },
                },
              ])
              .run();
          },
        },
      };
    },

    addAttributes() {
      return {
        userId: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-user-id'),
          renderHTML: (attributes) => ({
            'data-user-id': attributes.userId,
          }),
        },
        display: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-display'),
          renderHTML: (attributes) => ({
            'data-display': attributes.display,
          }),
        },
      };
    },

    parseHTML() {
      return [
        {
          tag: `span[data-type="${this.name}"]`,
        },
      ];
    },

    renderHTML({ node, HTMLAttributes }) {
      return [
        'span',
        mergeAttributes(
          { 'data-type': this.name, class: 'im-mention' },
          HTMLAttributes
        ),
        `@${node.attrs.display}`,
      ];
    },
  });
}

export { mentionPluginKey as MentionPluginKey };
