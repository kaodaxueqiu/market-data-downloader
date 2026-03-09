import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteBar } from '../components/QuoteBar';

describe('QuoteBar Component', () => {
  describe('rendering', () => {
    it('should render quote title and content (test case #5)', () => {
      const quote = {
        title: 'Reply to Alice:',
        content: 'Hello world',
      };

      render(<QuoteBar quote={quote} onRemove={() => {}} />);

      expect(screen.getByText('Reply to Alice:')).toBeInTheDocument();
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });

  describe('onRemove callback', () => {
    it('should call onRemove when remove button clicked (test case #5)', () => {
      const onRemove = vi.fn();
      const quote = {
        title: 'Test',
        content: 'Content',
      };

      render(<QuoteBar quote={quote} onRemove={onRemove} />);

      const removeButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(removeButton);

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });
});
