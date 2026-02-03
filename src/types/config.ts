import type { PlatformType } from './content';

/**
 * Destination types for publishing
 */
export type DestinationType =
  | 'wordpress-xmlrpc'
  | 'wordpress-rest'
  | 'drupal-jsonapi'
  | 'micropub'
  | 'activitypub'
  | 'custom-rest'
  | 'webhook'
  | 'local-indexeddb'
  | 'local-filesystem';

/**
 * Authentication types
 */
export type AuthType = 'none' | 'basic' | 'bearer' | 'oauth' | 'api-key';

/**
 * Encrypted credentials storage
 */
export interface EncryptedCredentials {
  encrypted: string;
  iv: string;
  salt: string;
}

/**
 * Destination configuration
 */
export interface DestinationConfig {
  siteUrl: string;
  endpoint?: string;
  authType: AuthType;
  username?: string;
  password?: string;
  token?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  customHeaders?: Record<string, string>;
  payloadTemplate?: string;
  responseMapping?: {
    idPath: string;
    urlPath: string;
  };
  postType?: string;
  category?: string;
  tags?: string[];
}

/**
 * Destination statistics
 */
export interface DestinationStats {
  totalPublished: number;
  failedCount: number;
  lastSuccess?: Date;
  lastError?: string;
}

/**
 * Publishing destination
 */
export interface Destination {
  id: string;
  name: string;
  type: DestinationType;
  enabled: boolean;
  isDefault?: boolean;
  config: DestinationConfig;
  credentials?: EncryptedCredentials;
  lastSync?: Date;
  stats: DestinationStats;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Platform-specific settings
 */
export interface PlatformSettings {
  enabled: boolean;
  defaultDestination?: string;
  autoDetect: boolean;
  showButton: boolean;
  customSelectors?: Record<string, string>;
  extractMedia: boolean;
  extractComments: boolean;
}

/**
 * Content transformation rules
 */
export interface ContentRules {
  stripTracking: boolean;
  convertToMarkdown: boolean;
  downloadMedia: boolean;
  maxMediaSize: number;
  preserveLinks: boolean;
  embedVideos: boolean;
}

/**
 * Privacy settings
 */
export interface PrivacySettings {
  removeLocation: boolean;
  anonymizeAuthor: boolean;
  stripMetadata: boolean;
  removeEngagement: boolean;
}

/**
 * Extension settings
 */
export interface ExtensionSettings {
  version: string;
  defaultDestination?: string;
  autoSave: boolean;
  backgroundSync: boolean;
  notifications: boolean;
  syncInterval: number;
  platforms: Record<PlatformType, PlatformSettings>;
  contentRules: ContentRules;
  privacy: PrivacySettings;
  theme: 'light' | 'dark' | 'system';
  language: string;
}

/**
 * Default platform settings factory
 */
export const createDefaultPlatformSettings = (): PlatformSettings => ({
  enabled: true,
  autoDetect: true,
  showButton: true,
  extractMedia: true,
  extractComments: false,
});

/**
 * Default extension settings
 */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  version: '1.0.0',
  autoSave: false,
  backgroundSync: true,
  notifications: true,
  syncInterval: 5,
  platforms: {
    facebook: createDefaultPlatformSettings(),
    twitter: createDefaultPlatformSettings(),
    linkedin: createDefaultPlatformSettings(),
    instagram: createDefaultPlatformSettings(),
    tiktok: createDefaultPlatformSettings(),
    reddit: createDefaultPlatformSettings(),
    pinterest: createDefaultPlatformSettings(),
  },
  contentRules: {
    stripTracking: true,
    convertToMarkdown: false,
    downloadMedia: true,
    maxMediaSize: 50,
    preserveLinks: true,
    embedVideos: false,
  },
  privacy: {
    removeLocation: false,
    anonymizeAuthor: false,
    stripMetadata: false,
    removeEngagement: false,
  },
  theme: 'system',
  language: 'en',
};
