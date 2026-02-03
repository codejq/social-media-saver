import type { PlatformType, DestinationType, Destination, ExtractedContent } from '@/types';

/**
 * URL validation
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if URL is HTTPS
 */
export function isHttps(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate platform type
 */
export function isValidPlatform(platform: string): platform is PlatformType {
  const validPlatforms: PlatformType[] = [
    'facebook', 'twitter', 'linkedin', 'instagram', 'tiktok', 'reddit', 'pinterest'
  ];
  return validPlatforms.includes(platform as PlatformType);
}

/**
 * Validate destination type
 */
export function isValidDestinationType(type: string): type is DestinationType {
  const validTypes: DestinationType[] = [
    'wordpress-xmlrpc', 'wordpress-rest', 'drupal-jsonapi', 'micropub',
    'activitypub', 'custom-rest', 'webhook', 'local-indexeddb', 'local-filesystem'
  ];
  return validTypes.includes(type as DestinationType);
}

/**
 * Validate destination configuration
 */
export function validateDestination(destination: Partial<Destination>): string[] {
  const errors: string[] = [];

  if (!destination.name?.trim()) {
    errors.push('Destination name is required');
  }

  if (!destination.type || !isValidDestinationType(destination.type)) {
    errors.push('Invalid destination type');
  }

  if (destination.config) {
    if (destination.type !== 'local-indexeddb' && destination.type !== 'local-filesystem') {
      if (!destination.config.siteUrl || !isValidUrl(destination.config.siteUrl)) {
        errors.push('Valid site URL is required');
      } else if (!isHttps(destination.config.siteUrl)) {
        errors.push('HTTPS is required for remote destinations');
      }
    }

    if (destination.config.authType === 'basic') {
      if (!destination.config.username) {
        errors.push('Username is required for basic auth');
      }
      if (!destination.config.password) {
        errors.push('Password is required for basic auth');
      }
    }

    if (destination.config.authType === 'bearer' && !destination.config.token) {
      errors.push('Token is required for bearer auth');
    }

    if (destination.config.authType === 'api-key') {
      if (!destination.config.apiKey) {
        errors.push('API key is required');
      }
      if (!destination.config.apiKeyHeader) {
        errors.push('API key header name is required');
      }
    }
  }

  return errors;
}

/**
 * Validate extracted content
 */
export function validateExtractedContent(content: Partial<ExtractedContent>): string[] {
  const errors: string[] = [];

  if (!content.id) {
    errors.push('Content ID is required');
  }

  if (!content.platform || !isValidPlatform(content.platform)) {
    errors.push('Valid platform is required');
  }

  if (!content.url || !isValidUrl(content.url)) {
    errors.push('Valid URL is required');
  }

  if (!content.author?.name) {
    errors.push('Author name is required');
  }

  if (!content.content?.text && !content.content?.html) {
    errors.push('Content text or HTML is required');
  }

  return errors;
}

/**
 * Sanitize filename for filesystem
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 200);
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
