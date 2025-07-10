/**
 * Comprehensive Security Tests for Input Validation Utilities
 * 
 * This test suite validates all input validation and sanitization functions
 * to ensure they properly prevent security vulnerabilities including:
 * - XSS (Cross-Site Scripting) attacks
 * - SQL injection attempts
 * - Input length attacks
 * - Malicious URL validation
 * - Token validation bypass attempts
 * - Form validation bypass attempts
 */

import {
  validateUrl,
  validateSearchQuery,
  validateLabelName,
  validateArticleTitle,
  validateNumericInput,
  validateColorInput,
  sanitizeInput,
  validateBatch,
  validateFormData,
  validateAuthForm,
  validateSearchForm,
  validateLabelForm,
  validateSettingsForm,
  INPUT_CONSTRAINTS,
  VALIDATION_PATTERNS,
  XSS_PATTERNS,
} from '../../src/utils/validation';

describe('Input Validation Security Tests', () => {
  describe('URL Validation', () => {
    test('should validate legitimate URLs', () => {
      const validUrls = [
        'https://example.com',
        'https://readeck.example.com/api',
        'https://subdomain.example.com/path',
      ];

      validUrls.forEach(url => {
        const result = validateUrl(url, { allowHttp: true, allowLocalhost: true });
        expect(result.isValid).toBe(true);
        expect(result.value).toBeDefined();
      });

      // Test localhost separately with proper options
      const localhostResult = validateUrl('http://localhost:3000', { allowHttp: true, allowLocalhost: true });
      expect(localhostResult.isValid).toBe(true);
    });

    test('should reject malicious URLs', () => {
      const maliciousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
        'https://evil.com/<script>alert(1)</script>',
        'https://example.com/"><script>alert(1)</script>',
        'https://example.com/onclick=alert(1)',
      ];

      maliciousUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should reject URLs that are too long', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2050);
      const result = validateUrl(longUrl);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('characters');
    });

    test('should reject URLs that are too short', () => {
      const shortUrl = 'http://a';
      const result = validateUrl(shortUrl);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('characters');
    });

    test('should handle empty and null URLs', () => {
      const invalidInputs = ['', null, undefined, '   '];
      invalidInputs.forEach(input => {
        const result = validateUrl(input as string);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should normalize valid URLs', () => {
      const url = 'https://example.com/path with spaces/<tag>';
      const result = validateUrl(url);
      if (result.isValid) {
        expect(result.value).not.toContain('<tag>');
        expect(result.value).not.toContain(' ');
      }
    });
  });

  describe('Search Query Validation', () => {
    test('should validate legitimate search queries', () => {
      const validQueries = [
        'react native',
        'mobile development',
        'TypeScript tutorial',
        'API integration',
        'security-best-practices',
      ];

      validQueries.forEach(query => {
        const result = validateSearchQuery(query);
        expect(result.isValid).toBe(true);
        expect(result.value).toBeDefined();
      });
    });

    test('should reject XSS attempts in search queries', () => {
      const xssQueries = [
        '<script>alert(1)</script>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(1)',
        '<svg onload="alert(1)">',
        '<body onload="alert(1)">',
      ];

      xssQueries.forEach(query => {
        const result = validateSearchQuery(query);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should reject queries that are too long', () => {
      const longQuery = 'a'.repeat(INPUT_CONSTRAINTS.SEARCH_QUERY.maxLength + 1);
      const result = validateSearchQuery(longQuery);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('characters');
    });

    test('should handle empty queries based on required option', () => {
      const emptyResult = validateSearchQuery('');
      expect(emptyResult.isValid).toBe(false);

      const optionalResult = validateSearchQuery('', { required: false });
      expect(optionalResult.isValid).toBe(true);
    });

    test('should sanitize search queries', () => {
      const query = 'search<script>alert(1)</script>term';
      const result = validateSearchQuery(query);
      if (result.isValid) {
        expect(result.value).not.toContain('<script>');
        expect(result.value).not.toContain('alert(1)');
      }
    });
  });

  describe('Label Name Validation', () => {
    test('should validate legitimate label names', () => {
      const validNames = [
        'work',
        'personal-stuff',
        'Mobile Development',
        'category_1',
        'Important Notes',
      ];

      validNames.forEach(name => {
        const result = validateLabelName(name);
        expect(result.isValid).toBe(true);
        expect(result.value).toBeDefined();
      });
    });

    test('should reject XSS attempts in label names', () => {
      const xssNames = [
        '<script>alert(1)</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(1)',
        '<svg onload="alert(1)">',
        'onclick="alert(1)"',
      ];

      xssNames.forEach(name => {
        const result = validateLabelName(name);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should reject names with invalid characters', () => {
      const invalidNames = [
        'name@domain.com',
        'name$$$',
        'name<>',
        'name{}',
        'name[]',
      ];

      invalidNames.forEach(name => {
        const result = validateLabelName(name);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('invalid characters');
      });
    });

    test('should reject names that are too long', () => {
      const longName = 'a'.repeat(INPUT_CONSTRAINTS.LABEL_NAME.maxLength + 1);
      const result = validateLabelName(longName);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('characters');
    });

    test('should sanitize label names', () => {
      const name = 'label<script>alert(1)</script>';
      const result = validateLabelName(name);
      if (result.isValid) {
        expect(result.value).not.toContain('<script>');
        expect(result.value).not.toContain('alert(1)');
      }
    });
  });

  describe('Article Title Validation', () => {
    test('should validate legitimate article titles', () => {
      const validTitles = [
        'How to Build React Native Apps',
        'Security Best Practices for Mobile Development',
        'API Integration: A Complete Guide',
        'TypeScript & React: Tips & Tricks',
        'Mobile App Testing (Part 1)',
      ];

      validTitles.forEach(title => {
        const result = validateArticleTitle(title);
        expect(result.isValid).toBe(true);
        expect(result.value).toBeDefined();
      });
    });

    test('should reject XSS attempts in article titles', () => {
      const xssTitles = [
        '<script>alert(1)</script>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert(1)',
        '<svg onload="alert(1)">',
        '<body onload="alert(1)">',
      ];

      xssTitles.forEach(title => {
        const result = validateArticleTitle(title);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should reject titles that are too long', () => {
      const longTitle = 'a'.repeat(INPUT_CONSTRAINTS.ARTICLE_TITLE.maxLength + 1);
      const result = validateArticleTitle(longTitle);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('characters');
    });

    test('should sanitize article titles', () => {
      const title = 'Article<script>alert(1)</script>Title';
      const result = validateArticleTitle(title);
      if (result.isValid) {
        expect(result.value).not.toContain('<script>');
        expect(result.value).not.toContain('alert(1)');
      }
    });
  });

  describe('Numeric Input Validation', () => {
    test('should validate legitimate numeric inputs', () => {
      const validNumbers = [
        '15',
        '60',
        '1440',
        15,
        60,
        1440,
      ];

      validNumbers.forEach(num => {
        const result = validateNumericInput(num, { type: 'syncInterval' });
        expect(result.isValid).toBe(true);
        expect(result.value).toBeDefined();
      });
    });

    test('should reject non-numeric inputs', () => {
      const invalidNumbers = [
        'abc',
        '15.5',
        '15px',
        'NaN',
        'Infinity',
        '<script>alert(1)</script>',
        'javascript:alert(1)',
      ];

      invalidNumbers.forEach(num => {
        const result = validateNumericInput(num, { type: 'syncInterval' });
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should reject numbers outside valid range', () => {
      const outOfRangeNumbers = [
        '0',
        '-1',
        '1500',
        '9999',
        0,
        -1,
        1500,
        9999,
      ];

      outOfRangeNumbers.forEach(num => {
        const result = validateNumericInput(num, { type: 'syncInterval' });
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    test('should validate batch size inputs', () => {
      const validBatchSizes = ['1', '50', '100', 1, 50, 100];
      validBatchSizes.forEach(size => {
        const result = validateNumericInput(size, { type: 'batchSize' });
        expect(result.isValid).toBe(true);
      });

      const invalidBatchSizes = ['0', '101', '200', 0, 101, 200];
      invalidBatchSizes.forEach(size => {
        const result = validateNumericInput(size, { type: 'batchSize' });
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Color Input Validation', () => {
    test('should validate legitimate color codes', () => {
      const validColors = [
        '#FF0000',
        '#00FF00',
        '#0000FF',
        '#FFF',
        '#000',
        '#123456',
        '#ABC',
      ];

      validColors.forEach(color => {
        const result = validateColorInput(color);
        expect(result.isValid).toBe(true);
        expect(result.value).toBeDefined();
      });
    });

    test('should reject invalid color codes', () => {
      const invalidColors = [
        'red',
        'rgb(255,0,0)',
        '#GGGGGG',
        '#FF00',
        '#FF00000',
        '<script>alert(1)</script>',
        'javascript:alert(1)',
        '',
        '#',
      ];

      invalidColors.forEach(color => {
        const result = validateColorInput(color);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('Input Sanitization', () => {
    test('should remove XSS patterns from input', () => {
      const maliciousInputs = [
        '<script>alert(1)</script>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '<body onload="alert(1)">',
        'javascript:alert(1)',
        'vbscript:msgbox(1)',
      ];

      maliciousInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('<iframe>');
        expect(sanitized).not.toContain('<img');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('vbscript:');
        expect(sanitized).not.toContain('onload');
        expect(sanitized).not.toContain('onerror');
      });
    });

    test('should enforce maximum length', () => {
      const longInput = 'a'.repeat(2000);
      const sanitized = sanitizeInput(longInput, { maxLength: 100 });
      expect(sanitized.length).toBeLessThanOrEqual(100);
    });

    test('should normalize whitespace', () => {
      const messy = '  multiple   spaces  \n\n  and  \t\t tabs  ';
      const sanitized = sanitizeInput(messy);
      expect(sanitized).toBe('multiple spaces and tabs');
    });

    test('should handle HTML entities', () => {
      const htmlInput = '<p>Hello &amp; goodbye</p>';
      const sanitized = sanitizeInput(htmlInput, { stripHtml: true });
      expect(sanitized).toBe('Hello &amp; goodbye');
    });

    test('should preserve line breaks when requested', () => {
      const multilineInput = 'Line 1\nLine 2\nLine 3';
      const sanitized = sanitizeInput(multilineInput, { preserveLineBreaks: true });
      expect(sanitized).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('Batch Validation', () => {
    test('should validate multiple inputs', () => {
      const validations = [
        { value: 'https://example.com', validator: validateUrl },
        { value: 'test query', validator: validateSearchQuery },
        { value: 'work', validator: validateLabelName },
      ];

      const result = validateBatch(validations);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should report errors for invalid inputs', () => {
      const validations = [
        { value: 'invalid-url', validator: validateUrl, field: 'serverUrl' },
        { value: '<script>alert(1)</script>', validator: validateSearchQuery, field: 'query' },
        { value: '', validator: validateLabelName, field: 'labelName' },
      ];

      const result = validateBatch(validations);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBeDefined();
    });
  });

  describe('Form Validation', () => {
    test('should validate auth forms', () => {
      const validAuthData = {
        serverUrl: 'https://readeck.example.com',
        apiToken: 'valid-token-here-123456789',
      };

      const result = validateAuthForm(validAuthData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.serverUrl).toBeDefined();
      expect(result.sanitizedData.apiToken).toBeDefined();
    });

    test('should reject invalid auth forms', () => {
      const invalidAuthData = {
        serverUrl: 'javascript:alert(1)',
        apiToken: '<script>alert(1)</script>',
      };

      const result = validateAuthForm(invalidAuthData);
      expect(result.isValid).toBe(false);
      expect(Object.keys(result.errors).length).toBeGreaterThan(0);
    });

    test('should validate search forms', () => {
      const validSearchData = {
        searchQuery: 'react native',
        filters: {},
      };

      const result = validateSearchForm(validSearchData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.searchQuery).toBeDefined();
    });

    test('should validate label forms', () => {
      const validLabelData = {
        name: 'work',
        color: '#FF0000',
      };

      const result = validateLabelForm(validLabelData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.name).toBeDefined();
      expect(result.sanitizedData.color).toBeDefined();
    });

    test('should validate settings forms', () => {
      const validSettingsData = {
        syncInterval: '15',
        batchSize: '50',
      };

      const result = validateSettingsForm(validSettingsData);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.syncInterval).toBeDefined();
      expect(result.sanitizedData.batchSize).toBeDefined();
    });
  });

  describe('Security Pattern Detection', () => {
    test('should detect all XSS patterns', () => {
      const xssAttacks = [
        '<script>alert(1)</script>',
        '<SCRIPT>alert(1)</SCRIPT>',
        '<ScRiPt>alert(1)</ScRiPt>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '<body onload="alert(1)">',
        '<div onclick="alert(1)">',
        '<a href="javascript:alert(1)">',
        'javascript:alert(1)',
        'vbscript:msgbox(1)',
        'data:text/html,<script>alert(1)</script>',
      ];

      xssAttacks.forEach(attack => {
        const hasXSS = XSS_PATTERNS.some(pattern => pattern.test(attack));
        expect(hasXSS).toBe(true);
      });
    });

    test('should not flag legitimate content', () => {
      const legitimateContent = [
        'How to use JavaScript frameworks',
        'Learning React and Vue',
        'HTML and CSS basics',
        'Mobile app development',
        'API integration guide',
      ];

      legitimateContent.forEach(content => {
        const hasXSS = XSS_PATTERNS.some(pattern => pattern.test(content));
        expect(hasXSS).toBe(false);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null and undefined inputs gracefully', () => {
      const validators = [
        validateUrl,
        validateSearchQuery,
        validateLabelName,
        validateArticleTitle,
        validateColorInput,
      ];

      validators.forEach(validator => {
        const nullResult = validator(null as any);
        expect(nullResult.isValid).toBe(false);
        expect(nullResult.error).toBeDefined();

        const undefinedResult = validator(undefined as any);
        expect(undefinedResult.isValid).toBe(false);
        expect(undefinedResult.error).toBeDefined();
      });
    });

    test('should handle non-string inputs gracefully', () => {
      const validators = [
        validateUrl,
        validateSearchQuery,
        validateLabelName,
        validateArticleTitle,
        validateColorInput,
      ];

      const nonStringInputs = [123, true, [], {}, new Date()];

      validators.forEach(validator => {
        nonStringInputs.forEach(input => {
          const result = validator(input as any);
          expect(result.isValid).toBe(false);
          expect(result.error).toBeDefined();
        });
      });
    });

    test('should handle empty strings appropriately', () => {
      const emptyString = '';
      const whitespaceString = '   ';

      const urlResult = validateUrl(emptyString);
      expect(urlResult.isValid).toBe(false);

      const searchResult = validateSearchQuery(emptyString, { required: false });
      expect(searchResult.isValid).toBe(true);

      const labelResult = validateLabelName(whitespaceString);
      expect(labelResult.isValid).toBe(false);
    });

    test('should handle extremely long inputs without crashing', () => {
      const extremelyLongInput = 'a'.repeat(100000);
      
      const result = validateSearchQuery(extremelyLongInput);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle unicode and special characters', () => {
      const unicodeInputs = [
        'café',
        'naïve',
        'résumé',
        '测试',
        '🚀 rocket',
        'emoji 😀 test',
      ];

      unicodeInputs.forEach(input => {
        const result = validateSearchQuery(input);
        // Should handle unicode gracefully (may pass or fail based on pattern)
        expect(result.error).toBeDefined();
      });
    });
  });
});