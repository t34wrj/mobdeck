/**
 * API Communication Security Validation Tests
 * Comprehensive security testing for API communication components
 */

import {
  getSecurityHeaders,
  getEnhancedSecurityHeaders,
  validateUrl,
} from '../../src/utils/security';

describe('API Communication Security Tests', () => {
  describe('Security Headers Implementation', () => {
    it('should include comprehensive security headers', () => {
      const securityHeaders = getSecurityHeaders();

      expect(securityHeaders).toEqual({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'",
        'X-Requested-With': 'XMLHttpRequest',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      });
    });

    it('should include enhanced security headers with options', () => {
      const enhancedHeaders = getEnhancedSecurityHeaders({
        requestId: 'req_123',
        timestamp: '2025-01-01T00:00:00Z',
        platform: 'React-Native-Android',
      });

      expect(enhancedHeaders).toMatchObject({
        'X-Request-ID': 'req_123',
        'X-Request-Timestamp': '2025-01-01T00:00:00Z',
        'X-Client-Platform': 'React-Native-Android',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        // Also includes all base security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      });
    });

    it('should include base security headers when no options provided', () => {
      const enhancedHeaders = getEnhancedSecurityHeaders();

      expect(enhancedHeaders).toMatchObject({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      });
    });
  });

  describe('URL Validation Security', () => {
    it('should validate HTTPS URLs', () => {
      const result = validateUrl('https://api.example.com/v1');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('https://api.example.com/v1');
    });

    it('should allow both HTTP and HTTPS URLs in production', () => {
      // Mock production environment
      const originalDev = (global as any).__DEV__;
      (global as any).__DEV__ = false;

      // Test HTTPS URL
      const httpsResult = validateUrl('https://production-api.example.com');
      expect(httpsResult.isValid).toBe(true);
      expect(httpsResult.sanitized).toBe('https://production-api.example.com');

      // Test HTTP URL (now allowed)
      const httpResult = validateUrl('http://production-api.example.com');
      expect(httpResult.isValid).toBe(true);
      expect(httpResult.sanitized).toBe('http://production-api.example.com');

      // Restore original value
      (global as any).__DEV__ = originalDev;
    });

    it('should allow localhost URLs in any environment', () => {
      const localhostTests = [
        'http://localhost:3000/api',
        'https://localhost:8080/api',
        'http://127.0.0.1:3000/api',
        'https://127.0.0.1:8080/api',
      ];

      localhostTests.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toBe(url);
      });
    });

    it('should reject dangerous protocols', () => {
      const dangerousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
      ];

      dangerousUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('URL contains dangerous protocol');
      });
    });

    it('should detect XSS attack patterns in URLs', () => {
      const xssUrls = [
        'https://example.com/<script>alert(1)</script>',
        'https://example.com/"><script>alert(1)</script>',
        'https://example.com/path?param=<iframe src="evil.com">',
        'https://example.com/onclick=alert(1)',
      ];

      xssUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('XSS attack pattern');
      });
    });

    it('should sanitize URLs with spaces and special characters', () => {
      const result = validateUrl('https://example.com/path with spaces/<tag>');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(
        'https://example.com/path%20with%20spaces/%3Ctag%3E'
      );
    });

    it('should enforce URL length constraints', () => {
      const shortUrl = 'http://a.co';
      const result = validateUrl(shortUrl);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(
        'URL length must be between 10 and 2048 characters'
      );

      const longUrl = 'https://example.com/' + 'a'.repeat(2050);
      const longResult = validateUrl(longUrl);
      expect(longResult.isValid).toBe(false);
      expect(longResult.error).toBe(
        'URL length must be between 10 and 2048 characters'
      );
    });
  });

  describe('Content Security Validation', () => {
    it('should prevent content type sniffing', () => {
      const headers = getSecurityHeaders();
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('should prevent XSS attacks', () => {
      const headers = getSecurityHeaders();
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    });

    it('should prevent clickjacking', () => {
      const headers = getSecurityHeaders();
      expect(headers['X-Frame-Options']).toBe('DENY');
    });

    it('should enforce content security policy', () => {
      const headers = getSecurityHeaders();
      expect(headers['Content-Security-Policy']).toBe("default-src 'self'");
    });
  });

  describe('Transport Security', () => {
    it('should enforce HTTPS with HSTS', () => {
      const headers = getSecurityHeaders();
      expect(headers['Strict-Transport-Security']).toBe(
        'max-age=31536000; includeSubDomains'
      );
    });

    it('should configure secure referrer policy', () => {
      const headers = getSecurityHeaders();
      expect(headers['Referrer-Policy']).toBe(
        'strict-origin-when-cross-origin'
      );
    });

    it('should restrict dangerous permissions', () => {
      const headers = getSecurityHeaders();
      expect(headers['Permissions-Policy']).toBe(
        'camera=(), microphone=(), geolocation=()'
      );
    });

    it('should identify as XMLHttpRequest', () => {
      const headers = getSecurityHeaders();
      expect(headers['X-Requested-With']).toBe('XMLHttpRequest');
    });
  });

  describe('Cache Security', () => {
    it('should prevent caching of sensitive data', () => {
      const enhancedHeaders = getEnhancedSecurityHeaders();
      expect(enhancedHeaders['Cache-Control']).toBe(
        'no-cache, no-store, must-revalidate'
      );
      expect(enhancedHeaders['Pragma']).toBe('no-cache');
      expect(enhancedHeaders['Expires']).toBe('0');
    });
  });

  describe('Request Identification Security', () => {
    it('should support request tracing', () => {
      const requestId = 'req_12345';
      const enhancedHeaders = getEnhancedSecurityHeaders({ requestId });
      expect(enhancedHeaders['X-Request-ID']).toBe(requestId);
    });

    it('should support timestamp tracking', () => {
      const timestamp = '2025-07-10T13:00:00Z';
      const enhancedHeaders = getEnhancedSecurityHeaders({ timestamp });
      expect(enhancedHeaders['X-Request-Timestamp']).toBe(timestamp);
    });

    it('should identify platform', () => {
      const platform = 'React-Native-Android';
      const enhancedHeaders = getEnhancedSecurityHeaders({ platform });
      expect(enhancedHeaders['X-Client-Platform']).toBe(platform);
    });
  });

  describe('Security Headers Completeness', () => {
    it('should include all critical security headers', () => {
      const headers = getSecurityHeaders();
      const criticalHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Strict-Transport-Security',
        'Content-Security-Policy',
        'Referrer-Policy',
        'Permissions-Policy',
      ];

      criticalHeaders.forEach(header => {
        expect(headers).toHaveProperty(header);
        expect(headers[header]).toBeTruthy();
      });
    });

    it('should include all enhanced security features', () => {
      const enhancedHeaders = getEnhancedSecurityHeaders({
        requestId: 'test',
        timestamp: 'test',
        platform: 'test',
      });

      const enhancedFeatures = [
        'Cache-Control',
        'Pragma',
        'Expires',
        'X-Request-ID',
        'X-Request-Timestamp',
        'X-Client-Platform',
      ];

      enhancedFeatures.forEach(header => {
        expect(enhancedHeaders).toHaveProperty(header);
        expect(enhancedHeaders[header]).toBeTruthy();
      });
    });
  });

  describe('Security Configuration Validation', () => {
    it('should use secure defaults for all headers', () => {
      const headers = getSecurityHeaders();

      // Verify secure defaults
      expect(headers['X-Frame-Options']).toBe('DENY'); // Most restrictive
      expect(headers['X-Content-Type-Options']).toBe('nosniff'); // Prevent MIME sniffing
      expect(headers['Content-Security-Policy']).toContain(
        "default-src 'self'"
      ); // Restrictive CSP
      expect(headers['Strict-Transport-Security']).toContain(
        'max-age=31536000'
      ); // 1 year HSTS
      expect(headers['Referrer-Policy']).toBe(
        'strict-origin-when-cross-origin'
      ); // Secure referrer
    });

    it('should prevent caching of all API responses', () => {
      const enhancedHeaders = getEnhancedSecurityHeaders();

      expect(enhancedHeaders['Cache-Control']).toBe(
        'no-cache, no-store, must-revalidate'
      );
      expect(enhancedHeaders['Pragma']).toBe('no-cache');
      expect(enhancedHeaders['Expires']).toBe('0');
    });
  });

  describe('API Security Integration', () => {
    it('should provide complete security header set for API requests', () => {
      const headers = getSecurityHeaders();
      const enhancedHeaders = getEnhancedSecurityHeaders();

      // Verify that enhanced headers include all base headers
      Object.keys(headers).forEach(key => {
        expect(enhancedHeaders).toHaveProperty(key);
        expect(enhancedHeaders[key]).toBe(headers[key]);
      });
    });

    it('should be ready for production deployment', () => {
      const headers = getSecurityHeaders();

      // Production readiness checklist
      expect(headers['Strict-Transport-Security']).toBeTruthy(); // HTTPS enforcement
      expect(headers['X-Content-Type-Options']).toBeTruthy(); // MIME type security
      expect(headers['X-Frame-Options']).toBeTruthy(); // Clickjacking protection
      expect(headers['X-XSS-Protection']).toBeTruthy(); // XSS protection
      expect(headers['Content-Security-Policy']).toBeTruthy(); // Content security
      expect(headers['Referrer-Policy']).toBeTruthy(); // Information leakage prevention
      expect(headers['Permissions-Policy']).toBeTruthy(); // Permission restrictions
    });
  });
});
