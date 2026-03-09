import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttachmentPreview } from '../components/AttachmentPreview';
import type { Attachment } from '../types';

describe('AttachmentPreview Component', () => {
  const mockAttachments: Attachment[] = [
    {
      id: '1',
      file: new File(['test'], 'image.png', { type: 'image/png' }),
      name: 'image.png',
      size: 1024,
      mime: 'image/png',
      previewUrl: 'blob:test1',
    },
    {
      id: '2',
      file: new File(['test'], 'document.pdf', { type: 'application/pdf' }),
      name: 'document.pdf',
      size: 2048,
      mime: 'application/pdf',
    },
  ];

  describe('rendering', () => {
    it('should render attachment list', () => {
      render(
        <AttachmentPreview
          attachments={mockAttachments}
          onRemove={() => {}}
        />
      );

      expect(screen.getByText('image.png')).toBeInTheDocument();
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });

    it('should render file sizes', () => {
      render(
        <AttachmentPreview
          attachments={mockAttachments}
          onRemove={() => {}}
        />
      );

      expect(screen.getByText('1 KB')).toBeInTheDocument();
      expect(screen.getByText('2 KB')).toBeInTheDocument();
    });

    it('should render image thumbnail for image files', () => {
      render(
        <AttachmentPreview
          attachments={mockAttachments}
          onRemove={() => {}}
        />
      );

      const thumbnail = screen.getByAltText('image.png');
      expect(thumbnail).toBeInTheDocument();
      expect(thumbnail).toHaveAttribute('src', 'blob:test1');
    });

    it('should return null for empty attachments', () => {
      const { container } = render(
        <AttachmentPreview
          attachments={[]}
          onRemove={() => {}}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe('interactions', () => {
    it('should call onRemove when remove button clicked', () => {
      const onRemove = vi.fn();

      render(
        <AttachmentPreview
          attachments={mockAttachments}
          onRemove={onRemove}
        />
      );

      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      fireEvent.click(removeButtons[0]);

      expect(onRemove).toHaveBeenCalledWith('1');
    });
  });

  describe('placement', () => {
    it('should apply top placement class', () => {
      const { container } = render(
        <AttachmentPreview
          attachments={mockAttachments}
          onRemove={() => {}}
          placement="top"
        />
      );

      expect(container.firstChild).toHaveClass('im-attachment-preview--top');
    });

    it('should apply bottom placement class', () => {
      const { container } = render(
        <AttachmentPreview
          attachments={mockAttachments}
          onRemove={() => {}}
          placement="bottom"
        />
      );

      expect(container.firstChild).toHaveClass('im-attachment-preview--bottom');
    });
  });
});
