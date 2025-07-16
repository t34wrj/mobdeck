/**
 * Simplified Input Validation Tests
 * Focus on essential validation for mobile bookmark app
 */

import {
  validateUrl,
  validateSearchQuery,
  validateLabelName,
  validateArticleTitle,
  sanitizeInput,
} from '../../src/utils/validation';

describe('Essential Input Validation', () => {
  describe('URL Validation', () => {
    it('should validate basic URLs', () => {
      const validUrls = [
        'https://example.com',
        'https://readeck.example.com/api',
        'http://localhost:3000',
      ];

      validUrls.forEach(url => {
        const result = validateUrl(url, {
          allowHttp: true,
          allowLocalhost: true,
        });
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject dangerous URLs', () => {
      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
      ];

      dangerousUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Search Query Validation', () => {
    it('should validate basic search queries', () => {
      const validQueries = [
        'react native',
        'mobile development',
        'API integration',
      ];

      validQueries.forEach(query => {
        const result = validateSearchQuery(query);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject XSS attempts', () => {
      const xssQueries = [
        '<script>alert(1)</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(1)',
      ];

      xssQueries.forEach(query => {
        const result = validateSearchQuery(query);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Label Name Validation', () => {
    it('should validate basic label names', () => {
      const validNames = ['work', 'personal', 'Mobile Development'];

      validNames.forEach(name => {
        const result = validateLabelName(name);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid characters', () => {
      const invalidNames = [
        '<script>alert(1)</script>',
        'name@domain.com',
        'name$$$',
      ];

      invalidNames.forEach(name => {
        const result = validateLabelName(name);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Article Title Validation', () => {
    it('should validate basic article titles', () => {
      const validTitles = [
        'How to Build React Native Apps',
        'Security Best Practices',
        'API Integration Guide',
      ];

      validTitles.forEach(title => {
        const result = validateArticleTitle(title);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject XSS attempts', () => {
      const xssTitles = [
        '<script>alert(1)</script>',
        '<iframe src="javascript:alert(1)"></iframe>',
        'javascript:alert(1)',
      ];

      xssTitles.forEach(title => {
        const result = validateArticleTitle(title);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should remove dangerous content', () => {
      const dangerousInputs = [
        '<script>alert(1)</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(1)',
      ];

      dangerousInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror');
      });
    });

    it('should normalize whitespace', () => {
      const messy = '  multiple   spaces  ';
      const sanitized = sanitizeInput(messy);
      expect(sanitized).toBe('multiple spaces');
    });
  });
});
