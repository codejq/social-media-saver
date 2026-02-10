/**
 * Platform types supported by the extension
 */
export type PlatformType =
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'instagram'
  | 'tiktok'
  | 'reddit'
  | 'pinterest'
  | 'custom';

/**
 * Media item types
 */
export type MediaType = 'image' | 'video' | 'gif' | 'audio';

/**
 * Author information extracted from a post
 */
export interface AuthorInfo {
  id: string;
  name: string;
  username?: string;
  profileUrl: string;
  avatarUrl?: string;
  cachedAvatarUrl?: string; // base64 data URL from IndexedDB cache
  verified?: boolean;
}

/**
 * Media item extracted from a post
 */
export interface MediaItem {
  type: MediaType;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  alt?: string;
  localPath?: string;
  cachedUrl?: string; // base64 data URL stored from IndexedDB cache
  blob?: Blob;
}

/**
 * Engagement metrics for a post
 */
export interface EngagementMetrics {
  likes?: number;
  shares?: number;
  comments?: number;
  views?: number;
  retweets?: number;
  reactions?: Record<string, number>;
}

/**
 * Metadata extracted from a post
 */
export interface PostMetadata {
  timestamp: Date;
  edited?: Date;
  engagement: EngagementMetrics;
  hashtags: string[];
  mentions: string[];
  location?: string;
  isSponsored?: boolean;
  privacy?: string;
  language?: string;
}

/**
 * Content structure with multiple formats
 */
export interface ContentFormats {
  text: string;
  html: string;
  markdown: string;
}

/**
 * Extracted content from a social media post
 */
export interface ExtractedContent {
  id: string;
  platform: PlatformType;
  url: string;
  author: AuthorInfo;
  content: ContentFormats;
  media: MediaItem[];
  metadata: PostMetadata;
  extractedAt: Date;
  rawHtml?: string;
}

/**
 * Saved post status
 */
export type SavedPostStatus = 'pending' | 'syncing' | 'published' | 'failed' | 'local';

/**
 * Saved post in storage
 */
export interface SavedPost {
  id: string;
  platform: PlatformType;
  url: string;
  author: AuthorInfo;
  content: ExtractedContent;
  destination?: string;
  status: SavedPostStatus;
  publishedUrl?: string;
  remoteId?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Post filter for querying
 */
export interface PostFilter {
  platform?: PlatformType;
  status?: SavedPostStatus;
  destination?: string;
  author?: string;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}
