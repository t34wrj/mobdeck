/**
 * Security Tests: Input Validation
 * Tests for all input validation and sanitization functions
 */

import {
  validateUrl,
  validateToken,
  sanitizeInput,
  sanitizeForSQL,
  validateFilePath,
  validatePassword,
  validateEmail,
  maskSensitiveData,
  generateSecureRandom,
  hashData,
} from '../../src/utils/security';

describe('Security: URL Validation', () => {
  describe('validateUrl', () => {
    it('should validate correct HTTPS URLs', () => {
      const urls = [
        'https://example.com',
        'https://api.readeck.com/v1',
        'https://subdomain.example.com:8080/path',
        'https://192.168.1.1:3000/api',
      ];

      urls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBeTruthy();
        expect(result.error).toBeUndefined();
      });
    });

    it('should validate localhost URLs in development', () => {
      const urls = [
        'http://localhost:8000',
        'http://127.0.0.1:3000',
        'https://localhost:8443/api',
      ];

      urls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject dangerous protocols', () => {
      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox',
        'file:///etc/passwd',
        'about:blank',
        'blob:https://example.com',
      ];

      dangerousUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('dangerous protocol');
      });
    });

    it('should reject URLs with XSS patterns', () => {
      const xssUrls = [
        'https://example.com/<script>alert(1)</script>',
        'https://example.com/"><script>alert(1)</script>',
        'https://example.com/path?param=<iframe src="evil.com">',
        'https://example.com/onclick=alert(1)',
      ];

      xssUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('XSS attack pattern');
      });
    });

    it('should enforce URL length limits', () => {
      const shortUrl = 'http://a.co';
      const longUrl = 'https://example.com/' + 'a'.repeat(2100);

      expect(validateUrl(shortUrl).isValid).toBe(false);
      expect(validateUrl(shortUrl).error).toContain('length');

      expect(validateUrl(longUrl).isValid).toBe(false);
      expect(validateUrl(longUrl).error).toContain('length');
    });

    it('should sanitize valid URLs', () => {
      const url = 'https://example.com/path with spaces/<tag>';
      const result = validateUrl(url);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).not.toContain(' ');
      expect(result.sanitized).not.toContain('<');
      expect(result.sanitized).not.toContain('>');
    });
  });
});

describe('Security: Token Validation', () => {
  describe('validateToken', () => {
    it('should validate correct JWT tokens', () => {
      const validJWT =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const result = validateToken(validJWT, 'jwt');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid JWT formats', () => {
      const invalidJWTs = [
        'not.a.jwt',
        'only.two',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'a.b.c.d', // Too many parts
        '',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc',
      ];

      invalidJWTs.forEach(token => {
        const result = validateToken(token, 'jwt');
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });

    it('should validate API tokens with Bearer prefix', () => {
      const validBearer =
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc';

      const result = validateToken(validBearer, 'bearer');
      expect(result.isValid).toBe(true);
    });

    it('should validate API keys', () => {
      const validKeys = [
        'sk_test_4eC39HqLyjWDarjtT1zdp7dc',
        'pk_live_51H3bgmHzQK2M7A0EUVLpV5kD',
        generateSecureRandom(32),
      ];

      validKeys.forEach(key => {
        const result = validateToken(key, 'api_key');
        expect(result.isValid).toBe(true);
      });
    });

    it('should enforce token length limits', () => {
      const shortToken = 'abc';
      const longToken = 'a'.repeat(5000);

      expect(validateToken(shortToken, 'jwt').isValid).toBe(false);
      expect(validateToken(longToken, 'jwt').isValid).toBe(false);
    });
  });
});

describe('Security: Input Sanitization', () => {
  describe('sanitizeInput', () => {
    it('should remove HTML tags by default', () => {
      const inputs = [
        { input: '<script>alert(1)</script>', expected: 'alert(1)' },
        { input: '<img src="x" onerror="alert(1)">', expected: '' },
        { input: 'Hello <b>World</b>!', expected: 'Hello World!' },
        { input: '<div><p>Text</p></div>', expected: 'Text' },
      ];

      inputs.forEach(({ input, expected }) => {
        const result = sanitizeInput(input);
        expect(result).toBe(expected);
      });
    });

    it('should escape HTML when stripHtml is false', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizeInput(input, { stripHtml: false });

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&quot;');
    });

    it('should enforce max length', () => {
      const longInput = 'a'.repeat(2000);
      const result = sanitizeInput(longInput, { maxLength: 100 });

      expect(result.length).toBe(100);
    });

    it('should remove null bytes', () => {
      const input = 'Hello\0World\x00!';
      const result = sanitizeInput(input);

      expect(result).toBe('Hello World !');
      expect(result).not.toContain('\0');
    });

    it('should normalize whitespace', () => {
      const input = '  Hello   \n\t  World  \r\n  ';
      const result = sanitizeInput(input);

      expect(result).toBe('Hello World');
    });
  });

  describe('sanitizeForSQL', () => {
    it('should escape single quotes', () => {
      const input = "O'Brien's Restaurant";
      const result = sanitizeForSQL(input);

      expect(result).toBe("O''Brien''s Restaurant");
    });

    it('should remove SQL injection patterns', () => {
      const injections = [
        { input: "'; DROP TABLE users; --", expected: ' DROP TABLE users ' },
        { input: "1' OR '1'='1", expected: "1'' OR ''1''=''1" },
        { input: "admin'--", expected: "admin''" },
        { input: '1; DELETE FROM users', expected: '1 DELETE FROM users' },
      ];

      injections.forEach(({ input, expected }) => {
        const result = sanitizeForSQL(input);
        expect(result).toBe(expected);
      });
    });

    it('should remove comment indicators', () => {
      const input = 'SELECT * FROM users -- comment /* block */';
      const result = sanitizeForSQL(input);

      expect(result).not.toContain('--');
      expect(result).not.toContain('/*');
      expect(result).not.toContain('*/');
    });
  });
});

describe('Security: File Path Validation', () => {
  describe('validateFilePath', () => {
    it('should validate safe file paths', () => {
      const safePaths = [
        '/home/user/documents/file.txt',
        'documents/file.pdf',
        './relative/path/file.json',
        'C:/Users/Documents/file.docx',
      ];

      safePaths.forEach(path => {
        const result = validateFilePath(path);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBeTruthy();
      });
    });

    it('should reject path traversal attempts', () => {
      const traversalPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        'documents/../../../sensitive',
        './valid/../../../../../../etc/passwd',
      ];

      traversalPaths.forEach(path => {
        const result = validateFilePath(path);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('traversal');
      });
    });

    it('should reject null byte injection', () => {
      const nullBytePaths = [
        'file.txt%00.jpg',
        'document\x00.pdf',
        'safe\\x00../../etc/passwd',
      ];

      nullBytePaths.forEach(path => {
        const result = validateFilePath(path);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Null byte');
      });
    });

    it('should reject dangerous file extensions', () => {
      const dangerousFiles = [
        'malware.exe',
        'script.bat',
        'command.sh',
        'virus.dll',
        'payload.ps1',
      ];

      dangerousFiles.forEach(path => {
        const result = validateFilePath(path);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Dangerous file extension');
      });
    });

    it('should normalize path separators', () => {
      const path = 'documents\\folder\\file.txt';
      const result = validateFilePath(path);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('documents/folder/file.txt');
    });

    it('should enforce base path when provided', () => {
      const basePath = '/app/data';
      const path = 'user/file.txt';
      const result = validateFilePath(path, basePath);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('/app/data/user/file.txt');
    });
  });
});

describe('Security: Password Validation', () => {
  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'MyStr0ng!Pass123',
        'C0mpl3x#P@ssw0rd',
        '!QAZ2wsx#EDC4rfv',
        'P@ssw0rd_With_Length_123',
      ];

      strongPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(4);
        expect(result.feedback).toHaveLength(0);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        { password: 'short', reason: 'length' },
        { password: 'password123', reason: 'common' },
        { password: 'qwertyuiop', reason: 'common' },
        { password: '12345678', reason: 'complexity' },
        { password: 'aaaaaaaa', reason: 'repeated' },
      ];

      weakPasswords.forEach(({ password }) => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.feedback.length).toBeGreaterThan(0);
      });
    });

    it('should provide helpful feedback', () => {
      const password = 'simplepassword';
      const result = validatePassword(password);

      expect(result.feedback).toContain('Add uppercase letters');
      expect(result.feedback).toContain('Add numbers');
      expect(result.feedback).toContain('Add special characters');
    });

    it('should detect common patterns', () => {
      const commonPatterns = [
        'password123',
        'admin123',
        'qwerty123',
        'letmein123',
      ];

      commonPatterns.forEach(password => {
        const result = validatePassword(password);
        expect(result.feedback).toContain('Avoid common patterns');
      });
    });
  });
});

describe('Security: Email Validation', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.email@subdomain.example.com',
        'user+tag@example.co.uk',
        'firstname.lastname@example.com',
        '123@example.com',
      ];

      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        'user..name@example.com',
        '',
      ];

      invalidEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeTruthy();
      });
    });

    it('should enforce email length limit', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = validateEmail(longEmail);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('too long');
    });
  });
});

describe('Security: Data Masking', () => {
  describe('maskSensitiveData', () => {
    it('should mask tokens properly', () => {
      const token = 'sk_test_4eC39HqLyjWDarjtT1zdp7dc';
      const masked = maskSensitiveData(token);

      expect(masked).toBe('sk_t*********************p7dc');
      expect(masked).not.toContain('4eC39HqLyjWDarjtT1zd');
    });

    it('should handle short strings', () => {
      expect(maskSensitiveData('abc')).toBe('***');
      expect(maskSensitiveData('12345678')).toBe('***');
    });

    it('should handle custom visible characters', () => {
      const data = 'sensitive-data-here';
      const masked = maskSensitiveData(data, 6);

      expect(masked).toBe('sensit*******re');
    });
  });
});

describe('Security: Cryptographic Functions', () => {
  describe('generateSecureRandom', () => {
    it('should generate random strings of correct length', () => {
      const lengths = [16, 32, 64, 128];

      lengths.forEach(length => {
        const random = generateSecureRandom(length);
        expect(random).toHaveLength(length);
        expect(random).toMatch(/^[A-Za-z0-9]+$/);
      });
    });

    it('should generate unique values', () => {
      const values = new Set();
      for (let i = 0; i < 100; i++) {
        values.add(generateSecureRandom(32));
      }

      expect(values.size).toBe(100);
    });
  });

  describe('hashData', () => {
    it('should generate consistent hashes', () => {
      const data = 'test-data';
      const hash1 = hashData(data);
      const hash2 = hashData(data);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it('should generate different hashes with salt', () => {
      const data = 'test-data';
      const salt1 = 'salt1';
      const salt2 = 'salt2';

      const hash1 = hashData(data, salt1);
      const hash2 = hashData(data, salt2);

      expect(hash1).not.toBe(hash2);
    });

    it('should throw on empty data', () => {
      expect(() => hashData('')).toThrow('Data to hash cannot be empty');
    });
  });
});
