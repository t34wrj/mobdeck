/**
 * Comprehensive Input Validation and Sanitization Utilities
 * 
 * This module provides security-focused validation and sanitization functions
 * for all user inputs across the Mobdeck application. It prevents common
 * security vulnerabilities including XSS, SQL injection, and injection attacks.
 * 
 * Key Features:
 * - URL validation with security checks
 * - API token validation
 * - Input sanitization with XSS prevention
 * - Search query validation
 * - Label/tag input validation
 * - Comprehensive error handling
 * - Type-safe interfaces
 */

import { validateUrl as urlValidatorUtil } from './urlValidation';
import { validateUrl as securityValidator } from './security';

// Re-export security utilities for backward compatibility
export { 
  validateUrl as validateUrlSecurity,
  validateToken,
  sanitizeInput as sanitizeInputSecurity,
  sanitizeForSQL,
  validateFilePath,
  validateEmail,
  maskSensitiveData,
  generateSecureRandom,
  hashData,
  validatePassword,
  getSecurityHeaders,
  getEnhancedSecurityHeaders,
  RateLimiter,
  defaultRateLimiter,
} from './security';

// Validation result interfaces
export interface ValidationResult {
  isValid: boolean;
  value?: string;
  error?: string;
  warnings?: string[];
}

export interface ValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => boolean;
  sanitize?: boolean;
}

// Input constraint definitions
export const INPUT_CONSTRAINTS = {
  URL: { minLength: 10, maxLength: 2048 },
  TOKEN: { minLength: 20, maxLength: 4096 },
  SEARCH_QUERY: { minLength: 1, maxLength: 200 },
  LABEL_NAME: { minLength: 1, maxLength: 50 },
  ARTICLE_TITLE: { minLength: 1, maxLength: 500 },
  SYNC_INTERVAL: { min: 1, max: 1440 }, // 1 minute to 24 hours
  BATCH_SIZE: { min: 1, max: 100 },
} as const;

// Common validation patterns
export const VALIDATION_PATTERNS = {
  // Search query - allow letters, numbers, spaces, and common punctuation
  SEARCH_QUERY: /^[a-zA-Z0-9\s\-_.,:;!?'"()[\]{}]+$/,
  // Label name - alphanumeric, spaces, hyphens, underscores
  LABEL_NAME: /^[a-zA-Z0-9\s\-_]+$/,
  // Article title - allow most characters but prevent dangerous patterns
  ARTICLE_TITLE: /^[a-zA-Z0-9\s\-_.,:;!?'"()[\]{}@#$%^&*+=|\\/<>~`]+$/,
  // Numeric input for settings
  NUMERIC: /^\d+$/,
  // Safe color codes (hex)
  COLOR_HEX: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
} as const;

// XSS prevention patterns
export const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gis,
  /<iframe[^>]*>.*?<\/iframe>/gis,
  /<embed[^>]*>.*?<\/embed>/gis,
  /<object[^>]*>.*?<\/object>/gis,
  /<applet[^>]*>.*?<\/applet>/gis,
  /<form[^>]*>.*?<\/form>/gis,
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
  /on\w+\s*=/gi,
  /<img[^>]+src[\s]*=[\s]*["']javascript:/gi,
  /<[^>]*[\s]+(on\w+|href|src)[\s]*=[\s]*["']?javascript:/gi,
] as const;

/**
 * Validates URLs with comprehensive security checks
 * Combines both URL validation utilities for maximum security
 */
export function validateUrl(url: string, options: {
  allowHttp?: boolean;
  allowLocalhost?: boolean;
  maxLength?: number;
} = {}): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required and must be a string' };
  }

  const trimmedUrl = url.trim();
  
  // Check length constraints
  const maxLength = options.maxLength || INPUT_CONSTRAINTS.URL.maxLength;
  if (trimmedUrl.length < INPUT_CONSTRAINTS.URL.minLength || trimmedUrl.length > maxLength) {
    return { 
      isValid: false, 
      error: `URL must be between ${INPUT_CONSTRAINTS.URL.minLength} and ${maxLength} characters` 
    };
  }

  // Check for XSS patterns first
  if (hasXSSPatterns(trimmedUrl)) {
    return { isValid: false, error: 'URL contains dangerous patterns' };
  }

  // Use security validation for additional checks
  const securityResult = securityValidator(trimmedUrl);
  if (!securityResult.isValid) {
    return { 
      isValid: false, 
      error: securityResult.error || 'URL failed security validation' 
    };
  }

  // Use comprehensive URL validation from urlValidation utility
  const urlValidationResult = urlValidatorUtil(trimmedUrl, {
    requireHttps: !options.allowHttp,
    maxUrlLength: maxLength,
    validateDomain: true,
    allowedDomains: options.allowLocalhost ? [] : undefined,
  });

  if (!urlValidationResult.isValid) {
    return { 
      isValid: false, 
      error: urlValidationResult.errors[0] || 'Invalid URL format',
      warnings: urlValidationResult.warnings,
    };
  }

  return { 
    isValid: true, 
    value: urlValidationResult.normalizedUrl || securityResult.sanitized || trimmedUrl,
    warnings: urlValidationResult.warnings,
  };
}

/**
 * Validates search queries with length limits and content filtering
 */
export function validateSearchQuery(query: string, options: ValidationOptions = {}): ValidationResult {
  const opts = {
    required: true,
    minLength: INPUT_CONSTRAINTS.SEARCH_QUERY.minLength,
    maxLength: INPUT_CONSTRAINTS.SEARCH_QUERY.maxLength,
    sanitize: true,
    ...options,
  };

  if (!query || typeof query !== 'string') {
    return opts.required 
      ? { isValid: false, error: 'Search query is required' }
      : { isValid: true, value: '' };
  }

  const trimmedQuery = query.trim();
  
  // Allow empty queries if not required
  if (!opts.required && trimmedQuery.length === 0) {
    return { isValid: true, value: '' };
  }

  // Check length constraints
  if (trimmedQuery.length < opts.minLength || trimmedQuery.length > opts.maxLength) {
    return { 
      isValid: false, 
      error: `Search query must be between ${opts.minLength} and ${opts.maxLength} characters` 
    };
  }

  // Check for dangerous patterns
  if (hasXSSPatterns(trimmedQuery)) {
    return { isValid: false, error: 'Search query contains invalid characters' };
  }

  // Validate pattern if provided
  if (opts.pattern && !opts.pattern.test(trimmedQuery)) {
    return { isValid: false, error: 'Search query contains invalid characters' };
  }

  // Sanitize if requested
  let sanitizedQuery = trimmedQuery;
  if (opts.sanitize) {
    sanitizedQuery = sanitizeInput(trimmedQuery);
    // If sanitization removed everything, it was likely malicious
    if (sanitizedQuery.trim().length === 0 && trimmedQuery.length > 0) {
      return { isValid: false, error: 'Search query contains invalid characters' };
    }
  }

  return { isValid: true, value: sanitizedQuery };
}

/**
 * Validates label names with security checks
 */
export function validateLabelName(name: string, options: ValidationOptions = {}): ValidationResult {
  const opts = {
    required: true,
    minLength: INPUT_CONSTRAINTS.LABEL_NAME.minLength,
    maxLength: INPUT_CONSTRAINTS.LABEL_NAME.maxLength,
    pattern: VALIDATION_PATTERNS.LABEL_NAME,
    sanitize: true,
    ...options,
  };

  if (!name || typeof name !== 'string') {
    return opts.required 
      ? { isValid: false, error: 'Label name is required' }
      : { isValid: true, value: '' };
  }

  const trimmedName = name.trim();
  
  // Check length constraints
  if (trimmedName.length < opts.minLength || trimmedName.length > opts.maxLength) {
    return { 
      isValid: false, 
      error: `Label name must be between ${opts.minLength} and ${opts.maxLength} characters` 
    };
  }

  // Check for dangerous patterns
  if (hasXSSPatterns(trimmedName)) {
    return { isValid: false, error: 'Label name contains invalid characters' };
  }

  // Validate pattern
  if (opts.pattern && !opts.pattern.test(trimmedName)) {
    return { isValid: false, error: 'Label name can only contain letters, numbers, spaces, hyphens, and underscores' };
  }

  // Sanitize if requested
  let sanitizedName = trimmedName;
  if (opts.sanitize) {
    sanitizedName = sanitizeInput(trimmedName);
  }

  return { isValid: true, value: sanitizedName };
}

/**
 * Validates article titles with security checks
 */
export function validateArticleTitle(title: string, options: ValidationOptions = {}): ValidationResult {
  const opts = {
    required: true,
    minLength: INPUT_CONSTRAINTS.ARTICLE_TITLE.minLength,
    maxLength: INPUT_CONSTRAINTS.ARTICLE_TITLE.maxLength,
    pattern: VALIDATION_PATTERNS.ARTICLE_TITLE,
    sanitize: true,
    ...options,
  };

  if (!title || typeof title !== 'string') {
    return opts.required 
      ? { isValid: false, error: 'Article title is required' }
      : { isValid: true, value: '' };
  }

  const trimmedTitle = title.trim();
  
  // Check length constraints
  if (trimmedTitle.length < opts.minLength || trimmedTitle.length > opts.maxLength) {
    return { 
      isValid: false, 
      error: `Article title must be between ${opts.minLength} and ${opts.maxLength} characters` 
    };
  }

  // Check for dangerous patterns
  if (hasXSSPatterns(trimmedTitle)) {
    return { isValid: false, error: 'Article title contains invalid characters' };
  }

  // Sanitize if requested
  let sanitizedTitle = trimmedTitle;
  if (opts.sanitize) {
    sanitizedTitle = sanitizeInput(trimmedTitle);
    // If sanitization removed everything, it was likely malicious
    if (sanitizedTitle.trim().length === 0 && trimmedTitle.length > 0) {
      return { isValid: false, error: 'Article title contains invalid characters' };
    }
  }

  return { isValid: true, value: sanitizedTitle };
}

/**
 * Validates numeric inputs for settings
 */
export function validateNumericInput(
  value: string | number, 
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    type?: 'syncInterval' | 'batchSize' | 'number';
  } = {}
): ValidationResult {
  const opts = {
    required: true,
    type: 'number' as const,
    ...options,
  };

  // Handle different input types
  let numericValue: number;
  if (typeof value === 'string') {
    if (!value.trim()) {
      return opts.required 
        ? { isValid: false, error: 'Numeric input is required' }
        : { isValid: true, value: '0' };
    }
    
    if (!VALIDATION_PATTERNS.NUMERIC.test(value.trim())) {
      return { isValid: false, error: 'Input must be a valid number' };
    }
    
    numericValue = parseInt(value.trim(), 10);
  } else if (typeof value === 'number') {
    numericValue = value;
  } else {
    return { isValid: false, error: 'Input must be a number' };
  }

  // Check if it's a valid number
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return { isValid: false, error: 'Input must be a valid number' };
  }

  // Type-specific validation
  let min: number;
  let max: number;
  let errorMessage: string;

  switch (opts.type) {
    case 'syncInterval':
      min = opts.min || INPUT_CONSTRAINTS.SYNC_INTERVAL.min;
      max = opts.max || INPUT_CONSTRAINTS.SYNC_INTERVAL.max;
      errorMessage = `Sync interval must be between ${min} and ${max} minutes`;
      break;
    case 'batchSize':
      min = opts.min || INPUT_CONSTRAINTS.BATCH_SIZE.min;
      max = opts.max || INPUT_CONSTRAINTS.BATCH_SIZE.max;
      errorMessage = `Batch size must be between ${min} and ${max}`;
      break;
    default:
      min = opts.min || 0;
      max = opts.max || Number.MAX_SAFE_INTEGER;
      errorMessage = `Value must be between ${min} and ${max}`;
  }

  if (numericValue < min || numericValue > max) {
    return { isValid: false, error: errorMessage };
  }

  return { isValid: true, value: numericValue.toString() };
}

/**
 * Validates color values (hex codes)
 */
export function validateColorInput(color: string, options: ValidationOptions = {}): ValidationResult {
  const opts = {
    required: true,
    ...options,
  };

  if (!color || typeof color !== 'string') {
    return opts.required 
      ? { isValid: false, error: 'Color is required' }
      : { isValid: true, value: '#000000' };
  }

  const trimmedColor = color.trim();
  
  // Check hex pattern
  if (!VALIDATION_PATTERNS.COLOR_HEX.test(trimmedColor)) {
    return { isValid: false, error: 'Color must be a valid hex code (e.g., #FF0000)' };
  }

  return { isValid: true, value: trimmedColor };
}

/**
 * Sanitizes general input to prevent XSS attacks
 */
export function sanitizeInput(input: string, options: {
  maxLength?: number;
  stripHtml?: boolean;
  preserveLineBreaks?: boolean;
} = {}): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const opts = {
    maxLength: 1000,
    stripHtml: true,
    preserveLineBreaks: false,
    ...options,
  };

  let sanitized = input.trim();

  // Enforce max length
  if (sanitized.length > opts.maxLength) {
    sanitized = sanitized.substring(0, opts.maxLength);
  }

  // Remove or escape HTML
  if (opts.stripHtml) {
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

  // Remove XSS patterns
  XSS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Handle line breaks
  if (!opts.preserveLineBreaks) {
    sanitized = sanitized.replace(/\n/g, ' ').replace(/\r/g, ' ');
  }

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Batch validation for multiple inputs
 */
export function validateBatch(validations: Array<{
  value: string;
  validator: (value: string, options?: any) => ValidationResult;
  options?: any;
  field?: string;
}>): { isValid: boolean; errors: Array<{ field?: string; error: string }> } {
  const errors: Array<{ field?: string; error: string }> = [];
  
  validations.forEach(({ value, validator, options, field }) => {
    const result = validator(value, options);
    if (!result.isValid && result.error) {
      errors.push({ field, error: result.error });
    }
  });

  return { isValid: errors.length === 0, errors };
}

/**
 * Checks if input contains XSS patterns
 */
function hasXSSPatterns(input: string): boolean {
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Validates form data with multiple fields
 */
export function validateFormData(
  formData: Record<string, any>,
  validationSchema: Record<string, {
    validator: (value: any, options?: any) => ValidationResult;
    options?: any;
    required?: boolean;
  }>
): { isValid: boolean; errors: Record<string, string>; sanitizedData: Record<string, any> } {
  const errors: Record<string, string> = {};
  const sanitizedData: Record<string, any> = {};

  Object.keys(validationSchema).forEach(field => {
    const { validator, options, required } = validationSchema[field];
    const value = formData[field];

    // Handle required field validation
    if (required && (value === undefined || value === null || value === '')) {
      errors[field] = `${field} is required`;
      return;
    }

    // Skip validation for optional empty fields
    if (!required && (value === undefined || value === null || value === '')) {
      sanitizedData[field] = value;
      return;
    }

    // Validate the field
    const result = validator(value, options);
    if (!result.isValid) {
      errors[field] = result.error || `Invalid ${field}`;
    } else {
      sanitizedData[field] = result.value !== undefined ? result.value : value;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData,
  };
}

/**
 * Security-focused validation for authentication forms
 */
export function validateAuthForm(formData: {
  serverUrl?: string;
  apiToken?: string;
}): { isValid: boolean; errors: Record<string, string>; sanitizedData: Record<string, any> } {
  return validateFormData(formData, {
    serverUrl: {
      validator: (url: string) => validateUrl(url, { allowHttp: true, allowLocalhost: true }),
      required: true,
    },
    apiToken: {
      validator: (token: string) => {
        // Simple token validation - check it's a non-empty string
        if (!token || typeof token !== 'string' || token.trim().length < 10) {
          return { isValid: false, error: 'Invalid token format' };
        }
        return { isValid: true, value: token.trim() };
      },
      required: true,
    },
  });
}

/**
 * Security-focused validation for search forms
 */
export function validateSearchForm(formData: {
  searchQuery?: string;
  filters?: Record<string, any>;
}): { isValid: boolean; errors: Record<string, string>; sanitizedData: Record<string, any> } {
  return validateFormData(formData, {
    searchQuery: {
      validator: validateSearchQuery,
      options: { required: false },
      required: false,
    },
  });
}

/**
 * Security-focused validation for label forms
 */
export function validateLabelForm(formData: {
  name?: string;
  color?: string;
}): { isValid: boolean; errors: Record<string, string>; sanitizedData: Record<string, any> } {
  return validateFormData(formData, {
    name: {
      validator: validateLabelName,
      required: true,
    },
    color: {
      validator: validateColorInput,
      required: false,
    },
  });
}

/**
 * Security-focused validation for settings forms
 */
export function validateSettingsForm(formData: {
  syncInterval?: string | number;
  batchSize?: string | number;
}): { isValid: boolean; errors: Record<string, string>; sanitizedData: Record<string, any> } {
  return validateFormData(formData, {
    syncInterval: {
      validator: (value: string | number) => validateNumericInput(value, { type: 'syncInterval' }),
      required: false,
    },
    batchSize: {
      validator: (value: string | number) => validateNumericInput(value, { type: 'batchSize' }),
      required: false,
    },
  });
}