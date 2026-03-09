import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  FloatingPortal,
  type Placement,
} from '@floating-ui/react';
import type { Editor } from '@tiptap/react';
import type { MentionSuggestionState } from '../types';
import { MentionList, type MentionListProps } from './MentionList';

export interface MentionPopoverProps extends Omit<MentionListProps, 'items' | 'selectedIndex' | 'loading' | 'error'> {
  /** Mention state from editor */
  mentionState: MentionSuggestionState;
  /** The Tiptap editor instance */
  editor: Editor | null;
  /** Placement of the popover relative to cursor: 'top' or 'bottom' */
  placement?: 'top' | 'bottom';
  /** Container element for portal (defaults to document.body) */
  portalContainer?: HTMLElement | null;
  /** Z-index for the popover */
  zIndex?: number;
}

/**
 * Get cursor bounding rect from the Tiptap editor.
 */
function getCursorRect(editor: Editor | null): DOMRect | null {
  if (!editor || !editor.view) return null;

  try {
    const { state } = editor.view;
    const { from } = state.selection;

    // Get coordinates at the cursor position
    const coords = editor.view.coordsAtPos(from);

    // Create a DOMRect-like object
    return new DOMRect(coords.left, coords.top, 1, coords.bottom - coords.top);
  } catch {
    return null;
  }
}

/**
 * MentionPopover - A floating popover for mention suggestions.
 * Uses Portal to render outside the DOM hierarchy, avoiding overflow:hidden issues.
 */
export function MentionPopover({
  mentionState,
  editor,
  placement = 'bottom',
  portalContainer,
  zIndex = 9999,
  onSelect,
  onHover,
  renderItem,
  locale,
}: MentionPopoverProps) {
  const [isPositioned, setIsPositioned] = useState(false);
  const cursorRectRef = useRef<DOMRect | null>(null);

  // Convert placement to floating-ui placement
  const floatingPlacement: Placement = placement === 'top' ? 'top-start' : 'bottom-start';
  const fallbackPlacements: Placement[] = placement === 'top'
    ? ['bottom-start', 'top-end', 'bottom-end']
    : ['top-start', 'bottom-end', 'top-end'];

  // Virtual reference element that always reads from ref
  const virtualReference = useRef({
    getBoundingClientRect: () => cursorRectRef.current || new DOMRect(0, 0, 0, 0),
  }).current;

  const { refs, floatingStyles, update } = useFloating({
    open: mentionState.active && isPositioned,
    placement: floatingPlacement,
    middleware: [
      offset(4),
      flip({
        fallbackPlacements,
      }),
      shift({ padding: 8 }),
      size({
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.min(availableHeight - 16, 300)}px`,
          });
        },
        padding: 8,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Set virtual reference once
  useEffect(() => {
    refs.setReference(virtualReference);
  }, [refs, virtualReference]);

  // Update cursor position when mention becomes active or query changes
  useLayoutEffect(() => {
    if (mentionState.active && editor) {
      // Use requestAnimationFrame to ensure DOM is updated
      const frame = requestAnimationFrame(() => {
        const rect = getCursorRect(editor);
        if (rect) {
          cursorRectRef.current = rect;
          setIsPositioned(true);
          update?.();
        }
      });
      return () => cancelAnimationFrame(frame);
    } else {
      cursorRectRef.current = null;
      setIsPositioned(false);
    }
  }, [mentionState.active, mentionState.query, editor, update]);

  // Update position when items change (list height may change)
  useEffect(() => {
    if (mentionState.active && isPositioned && update) {
      update();
    }
  }, [mentionState.items, mentionState.loading, update, mentionState.active, isPositioned]);

  // Don't render if not active or not positioned
  if (!mentionState.active || !isPositioned) {
    return null;
  }

  return (
    <FloatingPortal root={portalContainer}>
      <div
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          zIndex,
        }}
        className="im-mention-popover"
      >
        <MentionList
          items={mentionState.items}
          selectedIndex={mentionState.selectedIndex}
          loading={mentionState.loading}
          error={mentionState.error}
          onSelect={onSelect}
          onHover={onHover}
          renderItem={renderItem}
          locale={locale}
        />
      </div>
    </FloatingPortal>
  );
}
