/**
 * Unit tests for helper functions
 * Testing utility functions for date formatting, filtering, and debouncing
 */

import {
  formatDate,
  filterArticlesByKeyword,
  debounce,
} from '../../src/utils/helpers';

describe('Helper Functions', () => {
  describe('formatDate', () => {
    beforeEach(() => {
      // Mock date locale for consistent testing
      jest
        .spyOn(Date.prototype, 'toLocaleDateString')
        .mockImplementation(function (
          this: Date,
          locale?: string,
          options?: Intl.DateTimeFormatOptions
        ) {
          // Return consistent format for testing
          const year = this.getFullYear();
          const month = this.toLocaleString('en-US', { month: 'long' });
          const day = this.getDate();
          return `${month} ${day}, ${year}`;
        });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should format date string correctly', () => {
      const dateString = '2024-01-15T10:30:00Z';
      const formatted = formatDate(dateString);

      expect(formatted).toBe('January 15, 2024');
    });

    it('should handle different date formats', () => {
      const dates = [
        '2024-12-25',
        '2024-12-25T00:00:00',
        '2024-12-25T00:00:00Z',
        '2024-12-25T00:00:00.000Z',
      ];

      dates.forEach(date => {
        const formatted = formatDate(date);
        expect(formatted).toBe('December 25, 2024');
      });
    });

    it('should handle invalid date strings', () => {
      const invalidDates = [
        'invalid-date',
        '',
        'not-a-date',
        '2024-13-45', // Invalid month/day
      ];

      invalidDates.forEach(date => {
        const formatted = formatDate(date);
        expect(formatted).toContain('Invalid Date');
      });
    });

    it('should handle edge cases', () => {
      // Leap year
      expect(formatDate('2024-02-29')).toBe('February 29, 2024');

      // Year boundaries
      expect(formatDate('2023-12-31')).toBe('December 31, 2023');
      expect(formatDate('2024-01-01')).toBe('January 1, 2024');

      // Different centuries
      expect(formatDate('1999-12-31')).toBe('December 31, 1999');
      expect(formatDate('2000-01-01')).toBe('January 1, 2000');
    });

    it('should handle timestamps', () => {
      const timestamp = new Date('2024-06-15').getTime();
      const formatted = formatDate(new Date(timestamp).toISOString());

      expect(formatted).toBe('June 15, 2024');
    });
  });

  describe('filterArticlesByKeyword', () => {
    const testArticles = [
      {
        id: '1',
        title: 'JavaScript Best Practices',
        summary: 'Learn about modern JavaScript development techniques',
      },
      {
        id: '2',
        title: 'React Performance Tips',
        summary: 'Optimize your React applications for better performance',
      },
      {
        id: '3',
        title: 'TypeScript Advanced Features',
        summary: 'Deep dive into TypeScript generics and decorators',
      },
      {
        id: '4',
        title: 'Node.js Security Guide',
        summary: 'Best practices for securing Node.js applications',
      },
    ];

    it('should filter articles by title keyword', () => {
      const filtered = filterArticlesByKeyword(testArticles, 'React');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should filter articles by summary keyword', () => {
      const filtered = filterArticlesByKeyword(testArticles, 'security');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('4');
    });

    it('should be case insensitive', () => {
      const filtered1 = filterArticlesByKeyword(testArticles, 'JAVASCRIPT');
      const filtered2 = filterArticlesByKeyword(testArticles, 'javascript');
      const filtered3 = filterArticlesByKeyword(testArticles, 'JaVaScRiPt');

      expect(filtered1).toHaveLength(1);
      expect(filtered2).toHaveLength(1);
      expect(filtered3).toHaveLength(1);
      expect(filtered1[0].id).toBe(filtered2[0].id);
      expect(filtered2[0].id).toBe(filtered3[0].id);
    });

    it('should filter by partial matches', () => {
      const filtered = filterArticlesByKeyword(testArticles, 'Script');

      expect(filtered).toHaveLength(2); // JavaScript and TypeScript
      expect(filtered.map(a => a.id)).toContain('1');
      expect(filtered.map(a => a.id)).toContain('3');
    });

    it('should return empty array when no matches', () => {
      const filtered = filterArticlesByKeyword(testArticles, 'Python');

      expect(filtered).toHaveLength(0);
      expect(filtered).toEqual([]);
    });

    it('should return all articles for empty keyword', () => {
      const filtered = filterArticlesByKeyword(testArticles, '');

      expect(filtered).toHaveLength(testArticles.length);
      expect(filtered).toEqual(testArticles);
    });

    it('should handle special characters in keyword', () => {
      const articlesWithSpecialChars = [
        {
          id: '1',
          title: 'C++ Programming',
          summary: 'Learn C++ basics',
        },
        {
          id: '2',
          title: 'Regular Expressions (RegEx)',
          summary: 'Master regex patterns',
        },
      ];

      const filtered1 = filterArticlesByKeyword(
        articlesWithSpecialChars,
        'C++'
      );
      const filtered2 = filterArticlesByKeyword(
        articlesWithSpecialChars,
        '(RegEx)'
      );

      expect(filtered1).toHaveLength(1);
      expect(filtered2).toHaveLength(1);
    });

    it('should handle empty articles array', () => {
      const filtered = filterArticlesByKeyword([], 'keyword');

      expect(filtered).toHaveLength(0);
      expect(filtered).toEqual([]);
    });

    it('should match multiple articles', () => {
      const filtered = filterArticlesByKeyword(testArticles, 'practices');

      expect(filtered).toHaveLength(2); // Best Practices articles
      expect(filtered.map(a => a.id)).toContain('1');
      expect(filtered.map(a => a.id)).toContain('4');
    });

    it('should handle whitespace in keyword', () => {
      const filtered = filterArticlesByKeyword(testArticles, 'React');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should delay function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);

      debouncedFn('test');

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should cancel previous calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);

      debouncedFn('first');
      jest.advanceTimersByTime(200);

      debouncedFn('second');
      jest.advanceTimersByTime(200);

      debouncedFn('third');
      jest.advanceTimersByTime(500);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('third');
    });

    it('should handle multiple arguments', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn('arg1', 'arg2', { key: 'value' });

      jest.advanceTimersByTime(300);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' });
    });

    it('should work with different delay values', () => {
      const mockFn = jest.fn();
      const debounced100 = debounce(mockFn, 100);
      const debounced1000 = debounce(mockFn, 1000);

      debounced100('fast');
      debounced1000('slow');

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('fast');

      jest.advanceTimersByTime(900);
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('slow');
    });

    it('should handle rapid successive calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 200);

      // Rapid calls
      for (let i = 0; i < 10; i++) {
        debouncedFn(i);
        jest.advanceTimersByTime(50);
      }

      // Final wait
      jest.advanceTimersByTime(200);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(9); // Last call
    });

    it('should handle zero delay', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 0);

      debouncedFn('immediate');

      jest.advanceTimersByTime(0);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('immediate');
    });

    it('should preserve function context', () => {
      const originalMethod = jest.fn(function (this: any) {
        return this.value;
      });

      const obj = {
        value: 'test',
        method: originalMethod,
      };

      obj.method = debounce(originalMethod, 100);

      obj.method();
      jest.advanceTimersByTime(100);

      expect(originalMethod).toHaveBeenCalled();
    });

    it('should handle errors in debounced function', () => {
      const errorFn = jest.fn(() => {
        throw new Error('Test error');
      });
      const debouncedFn = debounce(errorFn, 100);

      debouncedFn();

      // Should not throw immediately
      expect(() => jest.advanceTimersByTime(100)).toThrow('Test error');
      expect(errorFn).toHaveBeenCalled();
    });

    it('should clean up timeouts properly', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 500);

      // Multiple calls
      debouncedFn('call1');
      const timeout1 = jest.getTimerCount();

      debouncedFn('call2');
      const timeout2 = jest.getTimerCount();

      // Should have cleared previous timeout
      expect(timeout2).toBe(timeout1);

      jest.advanceTimersByTime(500);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call2');
    });
  });
});
