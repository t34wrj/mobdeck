/**
 * URL Validation Utilities
 * Comprehensive URL validation, normalization, and security checks
 */

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  errors: string[];
  warnings: string[];
}

export interface UrlValidationOptions {
  allowedProtocols?: string[];
  blockedDomains?: string[];
  allowedDomains?: string[];
  requireHttps?: boolean;
  maxUrlLength?: number;
  validateDomain?: boolean;
}

const DEFAULT_VALIDATION_OPTIONS: Required<UrlValidationOptions> = {
  allowedProtocols: ['http', 'https'],
  blockedDomains: [],
  allowedDomains: [],
  requireHttps: false,
  maxUrlLength: 2048,
  validateDomain: true,
};

/**
 * Validates and normalizes a URL with comprehensive security checks
 */
export function validateUrl(
  url: string,
  options: UrlValidationOptions = {}
): UrlValidationResult {
  const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  const result: UrlValidationResult = {
    isValid: false,
    errors: [],
    warnings: [],
  };

  try {
    // Basic input validation
    if (url === null || url === undefined || typeof url !== 'string') {
      result.errors.push('URL is required and must be a string');
      return result;
    }

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      result.errors.push('URL cannot be empty');
      return result;
    }

    // Check URL length
    if (trimmedUrl.length > opts.maxUrlLength) {
      result.errors.push(
        `URL exceeds maximum length of ${opts.maxUrlLength} characters`
      );
      return result;
    }

    // Normalize URL (add protocol if missing)
    const normalizedUrl = normalizeUrl(trimmedUrl);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizedUrl);
    } catch {
      result.errors.push('Invalid URL format');
      return result;
    }

    // Protocol validation
    if (!opts.allowedProtocols.includes(parsedUrl.protocol.slice(0, -1))) {
      result.errors.push(
        `Protocol '${parsedUrl.protocol.slice(0, -1)}' is not allowed. Allowed protocols: ${opts.allowedProtocols.join(', ')}`
      );
      return result;
    }

    // HTTPS requirement check
    if (opts.requireHttps && parsedUrl.protocol !== 'https:') {
      result.errors.push('HTTPS protocol is required');
      return result;
    }

    // Domain validation
    if (opts.validateDomain) {
      const domainValidation = validateDomain(parsedUrl.hostname);
      if (!domainValidation.isValid) {
        result.errors.push(...domainValidation.errors);
        return result;
      }
      result.warnings.push(...domainValidation.warnings);
    }

    // Blocked domains check
    if (
      opts.blockedDomains.length > 0 &&
      isBlockedDomain(parsedUrl.hostname, opts.blockedDomains)
    ) {
      result.errors.push(`Domain '${parsedUrl.hostname}' is blocked`);
      return result;
    }

    // Allowed domains check (if specified)
    if (
      opts.allowedDomains.length > 0 &&
      !isAllowedDomain(parsedUrl.hostname, opts.allowedDomains)
    ) {
      result.errors.push(
        `Domain '${parsedUrl.hostname}' is not in the allowed domains list`
      );
      return result;
    }

    // Security checks
    const securityCheck = performSecurityChecks(parsedUrl);
    result.warnings.push(...securityCheck.warnings);
    if (securityCheck.errors.length > 0) {
      result.errors.push(...securityCheck.errors);
      return result;
    }

    // If we get here, URL is valid
    result.isValid = true;
    result.normalizedUrl = parsedUrl.toString();

    // Add informational warnings
    if (parsedUrl.protocol === 'http:' && !opts.requireHttps) {
      result.warnings.push('Using HTTP instead of HTTPS may be insecure');
    }

    return result;
  } catch (error) {
    console.error(
      '[UrlValidation] Unexpected error during URL validation:',
      error
    );
    result.errors.push('Unexpected error during URL validation');
    return result;
  }
}

/**
 * Normalizes a URL by adding protocol if missing and cleaning up formatting
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim();

  // Add protocol if missing (only if no protocol is present at all)
  if (!normalized.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//)) {
    // Default to https for better security
    normalized = `https://${normalized}`;
  }

  // Remove trailing slash for consistency (except for root domains)
  try {
    const urlObj = new URL(normalized);
    if (urlObj.pathname !== '/' && normalized.endsWith('/')) {
      // Remove trailing slash for paths but not root domains
      normalized = normalized.slice(0, -1);
    }
  } catch {
    // If URL parsing fails, use simple logic
    if (normalized.endsWith('/') && normalized.split('/').length > 3) {
      normalized = normalized.slice(0, -1);
    }
  }

  return normalized;
}

/**
 * Validates domain format and checks for common issues
 */
function validateDomain(hostname: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const result = {
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[],
  };

  if (!hostname) {
    result.isValid = false;
    result.errors.push('Hostname is required');
    return result;
  }

  // Check for localhost/private IPs
  if (isLocalOrPrivateAddress(hostname)) {
    result.warnings.push('URL points to a local or private address');
  }

  // Basic hostname format validation
  const hostnameRegex =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!hostnameRegex.test(hostname)) {
    result.isValid = false;
    result.errors.push('Invalid hostname format');
    return result;
  }

  // Check for minimum domain structure (at least one dot for TLD)
  if (!hostname.includes('.') && !isLocalOrPrivateAddress(hostname)) {
    result.isValid = false;
    result.errors.push('Domain must have a valid TLD');
    return result;
  }

  // Check for suspicious patterns
  if (
    hostname.includes('..') ||
    hostname.startsWith('.') ||
    hostname.endsWith('.')
  ) {
    result.isValid = false;
    result.errors.push('Domain contains invalid characters or formatting');
    return result;
  }

  return result;
}

/**
 * Checks if domain is in blocked domains list
 */
function isBlockedDomain(hostname: string, blockedDomains: string[]): boolean {
  return blockedDomains.some(
    blocked => hostname === blocked || hostname.endsWith(`.${blocked}`)
  );
}

/**
 * Checks if domain is in allowed domains list
 */
function isAllowedDomain(hostname: string, allowedDomains: string[]): boolean {
  return allowedDomains.some(
    allowed => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

/**
 * Checks if address is localhost or private IP range
 */
function isLocalOrPrivateAddress(hostname: string): boolean {
  // Localhost patterns
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  ) {
    return true;
  }

  // Private IP ranges
  const privateIpRegexes = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./, // Link-local
    /^fc00:/, // IPv6 unique local
    /^fe80:/, // IPv6 link-local
  ];

  return privateIpRegexes.some(regex => regex.test(hostname));
}

/**
 * Performs additional security checks on the URL
 */
function performSecurityChecks(url: URL): {
  errors: string[];
  warnings: string[];
} {
  const result = { errors: [] as string[], warnings: [] as string[] };

  // Check for suspicious URL patterns
  const suspiciousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /file:/i,
    /ftp:/i,
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(url.href))) {
    result.errors.push('URL contains potentially unsafe protocol or scheme');
  }

  // Check for URL shorteners (informational warning)
  const urlShorteners = [
    'bit.ly',
    'tinyurl.com',
    't.co',
    'goo.gl',
    'ow.ly',
    'short.link',
    'tiny.cc',
  ];

  if (urlShorteners.some(shortener => url.hostname.includes(shortener))) {
    result.warnings.push(
      'URL appears to be shortened - consider expanding for security'
    );
  }

  // Check for suspicious query parameters
  const suspiciousParams = ['javascript', 'script', 'eval', 'onclick'];
  const searchParams = new URLSearchParams(url.search);

  for (const [key, value] of searchParams) {
    if (
      suspiciousParams.some(
        param =>
          key.toLowerCase().includes(param) ||
          value.toLowerCase().includes(param)
      )
    ) {
      result.warnings.push(
        'URL contains potentially suspicious query parameters'
      );
      break;
    }
  }

  return result;
}

/**
 * Extracts and cleans URL from shared text that might contain other content
 */
export function extractUrlFromText(text: string): string | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // URL regex pattern - matches http(s) URLs
  const urlRegex =
    /https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?/gi;
  const matches = text.match(urlRegex);

  if (!matches || matches.length === 0) {
    return null;
  }

  // Return the first URL found
  return matches[0];
}

/**
 * Validates multiple URLs in batch
 */
export function validateUrls(
  urls: string[],
  options: UrlValidationOptions = {}
): Array<UrlValidationResult & { originalUrl: string }> {
  return urls.map(url => ({
    originalUrl: url,
    ...validateUrl(url, options),
  }));
}

/**
 * Checks if a URL is likely an article/content URL vs other types
 */
export function isLikelyArticleUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();

    // Common article URL patterns
    const articlePatterns = [
      /\/article/,
      /\/post/,
      /\/blog/,
      /\/news/,
      /\/story/,
      /\/[0-9]{4}\/[0-9]{2}\//, // Date patterns like /2024/01/
    ];

    // Common non-article patterns to avoid
    const nonArticlePatterns = [
      /\.(jpg|jpeg|png|gif|pdf|mp4|mp3|zip|exe)$/i,
      /\/api\//,
      /\/admin/,
      /\/login/,
      /\/register/,
      /\/search/,
      /\/category/,
      /\/tag/,
    ];

    // Check for non-article patterns first
    if (nonArticlePatterns.some(pattern => pattern.test(pathname))) {
      return false;
    }

    // Check for article patterns
    if (articlePatterns.some(pattern => pattern.test(pathname))) {
      return true;
    }

    // If pathname has multiple segments and ends with words (not file extensions), likely an article
    const segments = pathname.split('/').filter(segment => segment.length > 0);
    if (segments.length >= 2 && !pathname.includes('.')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
