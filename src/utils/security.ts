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