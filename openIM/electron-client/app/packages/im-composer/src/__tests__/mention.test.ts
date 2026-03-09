import { describe, it, expect } from 'vitest';
import { validateMentionIndices, createMentionInfo } from '../utils/mention';

describe('Mention Utils', () => {
  describe('createMentionInfo', () => {
    it('should create mention info with correct indices (test case #2)', () => {
      // Test UTF-16 index calculation
      const mention = createMentionInfo('user123', 'John Doe', 0);

      expect(mention.userId).toBe('user123');
      expect(mention.display).toBe('John Doe');
      expect(mention.start).toBe(0);
      expect(mention.end).toBe(8); // "@user123".length = 8
    });

    it('should handle Unicode in userId', () => {
      const mention = createMentionInfo('用户123', 'Test User', 5);

      expect(mention.start).toBe(5);
      // "@用户123".length = 6 (@ + 用户123), end = 5 + 6 = 11
      expect(mention.end).toBe(11);
    });
  });

  describe('validateMentionIndices', () => {
    it('should validate correct indices (test case #2)', () => {
      const plainText = '@user1 hello @user2 world';
      const mentions = [
        { userId: 'user1', display: 'User One', start: 0, end: 6 },
        { userId: 'user2', display: 'User Two', start: 13, end: 19 },
      ];

      expect(validateMentionIndices(plainText, mentions)).toBe(true);
    });

    it('should reject invalid start index', () => {
      const plainText = '@user1 hello';
      const mentions = [
        { userId: 'user1', display: 'User One', start: -1, end: 6 },
      ];

      expect(validateMentionIndices(plainText, mentions)).toBe(false);
    });

    it('should reject when end exceeds text length', () => {
      const plainText = '@user1';
      const mentions = [
        { userId: 'user1', display: 'User One', start: 0, end: 100 },
      ];

      expect(validateMentionIndices(plainText, mentions)).toBe(false);
    });

    it('should reject when extracted text does not match', () => {
      const plainText = '@wronguser hello';
      const mentions = [
        { userId: 'user1', display: 'User One', start: 0, end: 10 },
      ];

      expect(validateMentionIndices(plainText, mentions)).toBe(false);
    });

    it('should handle half-open interval correctly [start, end)', () => {
      const plainText = '@abc test';
      const mentions = [
        { userId: 'abc', display: 'ABC', start: 0, end: 4 }, // @abc = 4 chars
      ];

      const extracted = plainText.slice(0, 4);
      expect(extracted).toBe('@abc');
      expect(validateMentionIndices(plainText, mentions)).toBe(true);
    });
  });
});
