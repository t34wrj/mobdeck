/**
 * Simple Security Utilities for Mobile App
 * Basic input validation and sanitization
 */

export interface ValidationResult {
  isValid: boolean;
  sanitized: string | null;
  error?: string;
}

export function validateUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      sanitized: null,
      error: 'URL must be a non-empty string'
    };
  }

  const trimmed = url.trim();
  
  // Basic URL format check
  try {
    new URL(trimmed);
    return {
      isValid: true,
      sanitized: trimmed
    };
  } catch {
    return {
      isValid: false,
      sanitized: null,
      error: 'Invalid URL format'
    };
  }
}

export function validateToken(token: string): ValidationResult {
  if (!token || typeof token !== 'string') {
    return {
      isValid: false,
      sanitized: null,
      error: 'Token must be a non-empty string'
    };
  }

  const trimmed = token.trim();
  
  if (trimmed.length < 10) {
    return {
      isValid: false,
      sanitized: null,
      error: 'Token too short'
    };
  }

  return {
    isValid: true,
    sanitized: trimmed
  };
}

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input.trim();
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function sanitizeForSQL(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  // Basic SQL injection prevention - escape single quotes
  return input.replace(/'/g, "''");
}

export function validateFilePath(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }
  // Basic path validation - no directory traversal
  return !path.includes('../') && !path.includes('..\\');
}

export function validateEmail(email: string): boolean {
  return isValidEmail(email);
}

export function maskSensitiveData(data: string): string {
  if (!data || typeof data !== 'string') {
    return '';
  }
  if (data.length <= 4) {
    return '*'.repeat(data.length);
  }
  return data.substring(0, 2) + '*'.repeat(data.length - 4) + data.substring(data.length - 2);
}

export function generateSecureRandom(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function hashData(data: string): string {
  // Simple hash function - in production, use a proper crypto library
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

export function validatePassword(password: string): ValidationResult {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      sanitized: null,
      error: 'Password must be a non-empty string'
    };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      sanitized: null,
      error: 'Password must be at least 8 characters long'
    };
  }

  return {
    isValid: true,
    sanitized: password
  };
}

export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
}

export function getEnhancedSecurityHeaders(): Record<string, string> {
  return {
    ...getSecurityHeaders(),
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'",
  };
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  constructor(private maxRequests: number = 100, private windowMs: number = 60000) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }
  
  reset(key: string): void {
    this.requests.delete(key);
  }
}

export const defaultRateLimiter = new RateLimiter();