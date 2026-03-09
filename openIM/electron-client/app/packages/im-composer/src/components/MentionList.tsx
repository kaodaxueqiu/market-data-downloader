import React, { useEffect, useRef } from 'react';
import type { Member } from '../types';

export interface MentionListProps {
  /** List of member suggestions */
  items: Member[];
  /** Currently selected index */
  selectedIndex: number;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: boolean;
  /** Called when item is clicked */
  onSelect: (member: Member) => void;
  /** Called when mouse enters an item */
  onHover: (index: number) => void;
  /** Custom render function */
  renderItem?: (props: { member: Member; isSelected: boolean }) => React.ReactNode;
  /** Locale strings */
  locale?: {
    noResults?: string;
    loading?: string;
    error?: string;
  };
}

/**
 * Mention suggestion list component.
 */
export function MentionList({
  items,
  selectedIndex,
  loading,
  error,
  onSelect,
  onHover,
  renderItem,
  locale = {},
}: MentionListProps) {
  const {
    loading: loadingText = 'Loading...',
    error: errorText = 'Failed to load',
  } = locale;

  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Auto-scroll to selected item when selectedIndex changes
  useEffect(() => {
    const selectedItem = itemRefs.current[selectedIndex];
    if (selectedItem && listRef.current && typeof selectedItem.scrollIntoView === 'function') {
      // Use scrollIntoView with block: 'nearest' to only scroll if needed
      selectedItem.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [selectedIndex]);

  // Reset refs array when items change
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items.length]);

  if (loading) {
    return (
      <div className="im-mention-list" ref={listRef}>
        <div className="im-mention-list__status">{loadingText}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="im-mention-list" ref={listRef}>
        <div className="im-mention-list__status">{errorText}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      null
    );
  }

  return (
    <div className="im-mention-list" ref={listRef}>
      {items.map((member, index) => {
        const isSelected = index === selectedIndex;

        if (renderItem) {
          return (
            <div
              key={member.userId}
              ref={(el) => { itemRefs.current[index] = el; }}
              className={`im-mention-list__item ${isSelected ? 'im-mention-list__item--selected' : ''}`}
              onClick={() => onSelect(member)}
              onMouseEnter={() => onHover(index)}
            >
              {renderItem({ member, isSelected })}
            </div>
          );
        }

        return (
          <div
            key={member.userId}
            ref={(el) => { itemRefs.current[index] = el; }}
            className={`im-mention-list__item ${isSelected ? 'im-mention-list__item--selected' : ''}`}
            onClick={() => onSelect(member)}
            onMouseEnter={() => onHover(index)}
          >
            {member.avatarUrl && (
              <img
                src={member.avatarUrl}
                alt={member.display}
                className="im-mention-list__avatar"
              />
            )}
            <span className="im-mention-list__display">{member.display}</span>
          </div>
        );
      })}
    </div>
  );
}
