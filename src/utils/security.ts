/**
 * Security utilities for input validation, sanitization, and protection
 * against common security vulnerabilities in mobile applications.
 */

import { Platform } from 'react-native';
import CryptoJS from 'crypto-js';

/**
 * URL validation patterns and security checks
 */
const URL_PATTERNS = {
  // Standard URL with protocol
  FULL_URL: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  // IP address with protocol
  IP_URL: /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/,
  // Localhost URL
  LOCALHOST: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/,
  // Dangerous protocols
  DANGEROUS_PROTOCOLS: /^(javascript|data|vbscript|file|about|blob):/i,
};

/**
 * Token validation patterns
 */
const TOKEN_PATTERNS = {
  // JWT token format
  JWT: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
  // Bearer token format
  BEARER: /^Bearer\s+[A-Za-z0-9-_]+\.?[A-Za-z0-9-_]*\.?[A-Za-z0-9-_]*$/,
  // API key format (alphanumeric with dashes, dots, slashes, plus, equals for base64)
  API_KEY: /^[A-Za-z0-9-_.+=\/]{20,}$/,
};

/**
 * SQL injection patterns to detect and prevent
 */
const SQL_INJECTION_PATTERNS = [
  /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
  /(--|#|\/\*|\*\/|;|\||&&)/,
  /(\bor\b\s*\d+\s*=\s*\d+|\band\b\s*\d+\s*=\s*\d+)/i,
  /(\'|\"|`|\\)/,
];

/**
 * XSS attack patterns to detect and prevent
 */
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<img[^>]+src[\\s]*=[\\s]*["\']javascript:/gi,
];

/**
 * File path validation patterns
 */
const FILE_PATH_PATTERNS = {
  // Path traversal attempts
  PATH_TRAVERSAL: /\.\.[\/\\]/,
  // Null byte injection
  NULL_BYTE: /%00|\\x00/,
  // Restricted file extensions
  DANGEROUS_EXTENSIONS: /\.(exe|dll|bat|cmd|sh|ps1|vbs|js|jar|app|dmg|pkg)$/i,
  // Hidden files
  HIDDEN_FILES: /^\./,
};

/**
 * Input length constraints
 */
const LENGTH_CONSTRAINTS = {
  URL: { min: 10, max: 2048 },
  TOKEN: { min: 20, max: 4096 },
  USERNAME: { min: 3, max: 50 },
  PASSWORD: { min: 8, max: 128 },
  SEARCH_QUERY: { min: 1, max: 200 },
  FILE_PATH: { min: 1, max: 255 },
};

/**
 * Validates and sanitizes URLs for secure API communication
 */
export const validateUrl = (url: string): { isValid: boolean; sanitized: string | null; error?: string } => {
  if (!url || typeof url !== 'string') {
    return { isValid: false, sanitized: null, error: 'URL must be a non-empty string' };
  }

  // Trim and normalize
  const trimmedUrl = url.trim();

  // Check length constraints
  if (trimmedUrl.length < LENGTH_CONSTRAINTS.URL.min || trimmedUrl.length > LENGTH_CONSTRAINTS.URL.max) {
    return { isValid: false, sanitized: null, error: 'URL length must be between 10 and 2048 characters' };
  }

  // Check for dangerous protocols
  if (URL_PATTERNS.DANGEROUS_PROTOCOLS.test(trimmedUrl)) {
    return { isValid: false, sanitized: null, error: 'URL contains dangerous protocol' };
  }

  // Check for XSS patterns
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(trimmedUrl)) {
      return { isValid: false, sanitized: null, error: 'URL contains potential XSS attack pattern' };
    }
  }

  // Validate URL format
  const isValidFormat = 
    URL_PATTERNS.FULL_URL.test(trimmedUrl) || 
    URL_PATTERNS.IP_URL.test(trimmedUrl) || 
    URL_PATTERNS.LOCALHOST.test(trimmedUrl);

  if (!isValidFormat) {
    return { isValid: false, sanitized: null, error: 'Invalid URL format' };
  }

  // Force HTTPS for non-localhost URLs in production
  let sanitizedUrl = trimmedUrl;
  if (__DEV__ === false && !URL_PATTERNS.LOCALHOST.test(trimmedUrl) && trimmedUrl.startsWith('http://')) {
    sanitizedUrl = trimmedUrl.replace(/^http:/, 'https:');
  }

  // Encode potentially dangerous characters
  sanitizedUrl = sanitizedUrl
    .replace(/[<>'"]/g, (char) => encodeURIComponent(char))
    .replace(/\s/g, '%20');

  return { isValid: true, sanitized: sanitizedUrl };
};

/**
 * Validates authentication tokens
 */
export const validateToken = (token: string, type: 'jwt' | 'bearer' | 'api_key' = 'jwt'): { isValid: boolean; error?: string } => {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Token must be a non-empty string' };
  }

  // Check length constraints
  if (token.length < LENGTH_CONSTRAINTS.TOKEN.min || token.length > LENGTH_CONSTRAINTS.TOKEN.max) {
    return { isValid: false, error: 'Token length is invalid' };
  }

  // Validate based on token type
  switch (type) {
    case 'jwt':
      if (!TOKEN_PATTERNS.JWT.test(token)) {
        return { isValid: false, error: 'Invalid JWT token format' };
      }
      // Additional JWT structure validation
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { isValid: false, error: 'JWT must have three parts' };
      }
      break;

    case 'bearer':
      if (!TOKEN_PATTERNS.BEARER.test(token)) {
        return { isValid: false, error: 'Invalid Bearer token format' };
      }
      break;

    case 'api_key':
      if (!TOKEN_PATTERNS.API_KEY.test(token)) {
        return { isValid: false, error: 'Invalid API key format' };
      }
      break;

    default:
      return { isValid: false, error: 'Unknown token type' };
  }

  return { isValid: true };
};

/**
 * Sanitizes user input to prevent XSS attacks
 */
export const sanitizeInput = (input: string, options: { 
  allowedTags?: string[]; 
  maxLength?: number;
  stripHtml?: boolean;
} = {}): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const { allowedTags = [], maxLength = 1000, stripHtml = true } = options;

  let sanitized = input.trim();

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Strip or escape HTML
  if (stripHtml) {
    // Remove all HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  } else {
    // Escape HTML entities
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Remove any remaining script tags or event handlers
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\0\x00]/g, '');

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
};

/**
 * Prevents SQL injection in query parameters
 */
export const sanitizeForSQL = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Check for and remove SQL injection patterns
  for (const pattern of SQL_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Escape single quotes (most common SQL injection vector)
  sanitized = sanitized.replace(/'/g, "''");

  // Remove semicolons to prevent statement chaining
  sanitized = sanitized.replace(/;/g, '');

  // Remove comment indicators
  sanitized = sanitized.replace(/--/g, '').replace(/#/g, '').replace(/\/\*/g, '').replace(/\*\//g, '');

  return sanitized;
};

/**
 * Validates file paths to prevent directory traversal attacks
 */
export const validateFilePath = (path: string, basePath?: string): { isValid: boolean; sanitized: string | null; error?: string } => {
  if (!path || typeof path !== 'string') {
    return { isValid: false, sanitized: null, error: 'Path must be a non-empty string' };
  }

  // Check length constraints
  if (path.length > LENGTH_CONSTRAINTS.FILE_PATH.max) {
    return { isValid: false, sanitized: null, error: 'Path exceeds maximum length' };
  }

  // Check for path traversal attempts
  if (FILE_PATH_PATTERNS.PATH_TRAVERSAL.test(path)) {
    return { isValid: false, sanitized: null, error: 'Path traversal attempt detected' };
  }

  // Check for null byte injection (more comprehensive)
  if (FILE_PATH_PATTERNS.NULL_BYTE.test(path) || path.includes('\0') || path.includes('\x00')) {
    return { isValid: false, sanitized: null, error: 'Null byte injection detected' };
  }

  // Check for dangerous file extensions
  if (FILE_PATH_PATTERNS.DANGEROUS_EXTENSIONS.test(path)) {
    return { isValid: false, sanitized: null, error: 'Dangerous file extension detected' };
  }

  // Normalize path separators
  let sanitized = path.replace(/\\/g, '/');

  // Remove multiple slashes
  sanitized = sanitized.replace(/\/+/g, '/');

  // If base path is provided, ensure the path stays within it
  if (basePath) {
    const normalizedBase = basePath.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!sanitized.startsWith(normalizedBase)) {
      sanitized = `${normalizedBase}/${sanitized}`.replace(/\/+/g, '/');
    }
  }

  // Platform-specific path validation
  if (Platform.OS === 'android') {
    // Android-specific path restrictions
    if (sanitized.includes(':') && !sanitized.match(/^[a-zA-Z]:\//)) {
      return { isValid: false, sanitized: null, error: 'Invalid Android file path' };
    }
  }

  return { isValid: true, sanitized };
};

/**
 * Generates secure random strings for tokens and nonces
 */
export const generateSecureRandom = (length: number = 32): string => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint8Array(length);
  
  // Use crypto.getRandomValues for secure random generation
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomValues);
  } else {
    // Fallback for environments without crypto API
    for (let i = 0; i < length; i++) {
      randomValues[i] = Math.floor(Math.random() * 256);
    }
  }

  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[randomValues[i] % charset.length];
  }

  return result;
};

/**
 * Hashes sensitive data for secure comparison or storage
 */
export const hashData = (data: string, salt?: string): string => {
  if (!data) {
    throw new Error('Data to hash cannot be empty');
  }

  const saltedData = salt ? `${data}${salt}` : data;
  return CryptoJS.SHA256(saltedData).toString();
};

/**
 * Validates password strength
 */
export const validatePassword = (password: string): { 
  isValid: boolean; 
  score: number; 
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  if (!password || typeof password !== 'string') {
    return { isValid: false, score: 0, feedback: ['Password is required'] };
  }

  // Length check
  if (password.length < LENGTH_CONSTRAINTS.PASSWORD.min) {
    feedback.push(`Password must be at least ${LENGTH_CONSTRAINTS.PASSWORD.min} characters`);
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }

  // Complexity checks
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Add uppercase letters');

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push('Add numbers');

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1;
  else feedback.push('Add special characters');

  // Common patterns check
  const commonPatterns = [
    /^123456/,
    /^password/i,
    /^qwerty/i,
    /^admin/i,
    /^letmein/i,
    /(.)\1{3,}/, // Repeated characters
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score -= 2;
      feedback.push('Avoid common patterns');
      break;
    }
  }

  const isValid = score >= 4 && password.length >= LENGTH_CONSTRAINTS.PASSWORD.min;

  return { isValid, score: Math.max(0, Math.min(5, score)), feedback };
};

/**
 * Masks sensitive data for logging
 */
export const maskSensitiveData = (data: string, visibleChars: number = 4): string => {
  if (!data || data.length <= visibleChars * 2) {
    return '***';
  }

  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const maskedLength = data.length - visibleChars * 2;
  const masked = '*'.repeat(Math.max(3, maskedLength));

  return `${start}${masked}${end}`;
};

/**
 * Validates email format
 */
export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sanitized = email.trim().toLowerCase();

  // More strict validation
  if (!sanitized || sanitized.indexOf('@') === -1 || sanitized.indexOf('.') === -1 || !emailRegex.test(sanitized)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  if (sanitized.length > 254) {
    return { isValid: false, error: 'Email too long' };
  }

  return { isValid: true };
};

/**
 * Security headers for API requests
 */
export const getSecurityHeaders = (): Record<string, string> => {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
    'X-Requested-With': 'XMLHttpRequest',
  };
};

/**
 * Rate limiting helper
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxAttempts: number;

  constructor(windowMs: number = 60000, maxAttempts: number = 10) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the window
    const validAttempts = attempts.filter(timestamp => now - timestamp < this.windowMs);

    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }

    validAttempts.push(now);
    this.attempts.set(key, validAttempts);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      this.cleanup();
    }

    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, attempts] of this.attempts.entries()) {
      const validAttempts = attempts.filter(timestamp => now - timestamp < this.windowMs);
      if (validAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, validAttempts);
      }
    }
  }
}

// Export a default rate limiter instance
export const defaultRateLimiter = new RateLimiter();