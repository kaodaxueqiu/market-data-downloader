import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MentionList } from '../components/MentionList';

describe('MentionList Component', () => {
  const mockMembers = [
    { userId: 'user1', display: 'Alice', avatarUrl: 'https://example.com/alice.png' },
    { userId: 'user2', display: 'Bob' },
    { userId: 'user3', display: 'Charlie' },
  ];

  describe('rendering', () => {
    it('should render member list', () => {
      render(
        <MentionList
          items={mockMembers}
          selectedIndex={0}
          loading={false}
          error={false}
          onSelect={() => {}}
          onHover={() => {}}
        />
      );

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('should render loading state', () => {
      render(
        <MentionList
          items={[]}
          selectedIndex={0}
          loading={true}
          error={false}
          onSelect={() => {}}
          onHover={() => {}}
        />
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render error state', () => {
      render(
        <MentionList
          items={[]}
          selectedIndex={0}
          loading={false}
          error={true}
          onSelect={() => {}}
          onHover={() => {}}
        />
      );

      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    it('should render nothing when empty (no items, not loading, no error)', () => {
      const { container } = render(
        <MentionList
          items={[]}
          selectedIndex={0}
          loading={false}
          error={false}
          onSelect={() => {}}
          onHover={() => {}}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('interactions', () => {
    it('should call onSelect when item is clicked (test case #1)', () => {
      const onSelect = vi.fn();

      render(
        <MentionList
          items={mockMembers}
          selectedIndex={0}
          loading={false}
          error={false}
          onSelect={onSelect}
          onHover={() => {}}
        />
      );

      fireEvent.click(screen.getByText('Bob'));

      expect(onSelect).toHaveBeenCalledWith(mockMembers[1]);
    });

    it('should call onHover when mouse enters item', () => {
      const onHover = vi.fn();

      render(
        <MentionList
          items={mockMembers}
          selectedIndex={0}
          loading={false}
          error={false}
          onSelect={() => {}}
          onHover={onHover}
        />
      );

      fireEvent.mouseEnter(screen.getByText('Charlie'));

      expect(onHover).toHaveBeenCalledWith(2);
    });
  });

  describe('custom rendering', () => {
    it('should use custom renderItem when provided', () => {
      const renderItem = vi.fn(({ member, isSelected }) => (
        <div data-testid="custom-item">
          {member.display} {isSelected ? '(selected)' : ''}
        </div>
      ));

      render(
        <MentionList
          items={mockMembers}
          selectedIndex={1}
          loading={false}
          error={false}
          onSelect={() => {}}
          onHover={() => {}}
          renderItem={renderItem}
        />
      );

      expect(renderItem).toHaveBeenCalledTimes(3);
      expect(screen.getAllByTestId('custom-item')).toHaveLength(3);
    });
  });
});
