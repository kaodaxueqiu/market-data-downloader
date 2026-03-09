import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAttachments } from '../hooks/useAttachments';

describe('useAttachments Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addFiles', () => {
    it('should add valid files to attachments (test case #3)', () => {
      const { result } = renderHook(() =>
        useAttachments({
          maxAttachments: 10,
          allowedMimeTypes: ['image/*'],
        })
      );

      const file = new File(['test'], 'test.png', { type: 'image/png' });

      act(() => {
        result.current.addFiles([file]);
      });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].name).toBe('test.png');
    });

    it('should not add files that fail validation (test case #3)', () => {
      const onLimitExceeded = vi.fn();
      const { result } = renderHook(() =>
        useAttachments({
          maxAttachments: 10,
          allowedMimeTypes: ['image/*'],
          onLimitExceeded,
        })
      );

      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      act(() => {
        result.current.addFiles([file]);
      });

      expect(result.current.attachments).toHaveLength(0);
      expect(onLimitExceeded).toHaveBeenCalledWith('mime', file);
    });

    it('should not add files when count limit reached', () => {
      const onLimitExceeded = vi.fn();
      const { result } = renderHook(() =>
        useAttachments({
          maxAttachments: 1,
          onLimitExceeded,
        })
      );

      const file1 = new File(['1'], '1.png', { type: 'image/png' });
      const file2 = new File(['2'], '2.png', { type: 'image/png' });

      act(() => {
        result.current.addFiles([file1]);
      });

      act(() => {
        result.current.addFiles([file2]);
      });

      expect(result.current.attachments).toHaveLength(1);
      expect(onLimitExceeded).toHaveBeenCalledWith('count', file2);
    });
  });

  describe('removeAttachment', () => {
    it('should remove attachment and revoke URL (test case #4)', () => {
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
      const { result } = renderHook(() => useAttachments());

      const file = new File(['test'], 'test.png', { type: 'image/png' });

      act(() => {
        result.current.addFiles([file]);
      });

      const attachmentId = result.current.attachments[0].id;
      const previewUrl = result.current.attachments[0].previewUrl;

      act(() => {
        result.current.removeAttachment(attachmentId);
      });

      expect(result.current.attachments).toHaveLength(0);
      expect(revokeObjectURL).toHaveBeenCalledWith(previewUrl);
    });
  });

  describe('clearAttachments', () => {
    it('should clear all attachments and revoke all URLs (test case #4)', () => {
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
      const { result } = renderHook(() => useAttachments());

      const files = [
        new File(['1'], '1.png', { type: 'image/png' }),
        new File(['2'], '2.png', { type: 'image/png' }),
      ];

      act(() => {
        result.current.addFiles(files);
      });

      expect(result.current.attachments).toHaveLength(2);

      act(() => {
        result.current.clearAttachments();
      });

      expect(result.current.attachments).toHaveLength(0);
      expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    });
  });

  describe('setAttachments', () => {
    it('should replace attachments and revoke old URLs', () => {
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');
      const { result } = renderHook(() => useAttachments());

      const file1 = new File(['1'], '1.png', { type: 'image/png' });

      act(() => {
        result.current.addFiles([file1]);
      });

      const oldAttachment = result.current.attachments[0];

      const newAttachments = [
        {
          id: 'new-1',
          file: new File(['2'], '2.png', { type: 'image/png' }),
          name: '2.png',
          size: 1,
          mime: 'image/png',
          previewUrl: 'blob:new',
        },
      ];

      act(() => {
        result.current.setAttachments(newAttachments);
      });

      expect(result.current.attachments).toHaveLength(1);
      expect(result.current.attachments[0].id).toBe('new-1');
      expect(revokeObjectURL).toHaveBeenCalledWith(oldAttachment.previewUrl);
    });
  });

  describe('onChange callback', () => {
    it('should call onChange when attachments change', () => {
      const onChange = vi.fn();
      const { result } = renderHook(() => useAttachments({ onChange }));

      const file = new File(['test'], 'test.png', { type: 'image/png' });

      act(() => {
        result.current.addFiles([file]);
      });

      expect(onChange).toHaveBeenCalled();
    });
  });
});
