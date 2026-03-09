import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface CompositionExtensionStorage {
  isComposing: boolean;
}

export const compositionPluginKey = new PluginKey('composition');

/**
 * Extension to track IME composition state.
 * This is critical for handling CJK input correctly.
 */
export const CompositionExtension = Extension.create<{}, CompositionExtensionStorage>({
  name: 'composition',

  addStorage() {
    return {
      isComposing: false,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: compositionPluginKey,
        props: {
          handleDOMEvents: {
            compositionstart: () => {
              extension.storage.isComposing = true;
              return false;
            },
            compositionend: () => {
              extension.storage.isComposing = false;
              return false;
            },
          },
        },
      }),
    ];
  },
});
