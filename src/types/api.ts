import type { ExtractedContent, SavedPost, PostFilter } from './content';
import type { Destination, ExtensionSettings } from './config';
import type { QueueItem, QueueStatus } from './queue';

/**
 * Message types for content script to background communication
 */
export type ContentToBackgroundMessage =
  | { type: 'SAVE_CONTENT'; payload: ExtractedContent }
  | { type: 'GET_SETTINGS'; payload: null }
  | { type: 'CHECK_PLATFORM_ENABLED'; payload: { platform: string } }
  | { type: 'GET_DESTINATIONS'; payload: null }
  | { type: 'DOWNLOAD_MEDIA'; payload: { url: string; filename: string } };

/**
 * Message types for background to content script communication
 */
export type BackgroundToContentMessage =
  | { type: 'SETTINGS_UPDATED'; payload: ExtensionSettings }
  | { type: 'SAVE_SUCCESS'; payload: { postId: string; url?: string } }
  | { type: 'SAVE_ERROR'; payload: { error: string } }
  | { type: 'PLATFORM_STATUS'; payload: { enabled: boolean } };

/**
 * Message types for popup to background communication
 */
export type PopupToBackgroundMessage =
  | { type: 'GET_QUEUE_STATUS'; payload: null }
  | { type: 'GET_RECENT_POSTS'; payload: { limit: number } }
  | { type: 'GET_POST'; payload: { id: string } }
  | { type: 'DELETE_POST'; payload: { id: string } }
  | { type: 'RETRY_FAILED'; payload: { itemId: string } }
  | { type: 'RETRY_ALL_FAILED'; payload: null }
  | { type: 'PAUSE_SYNC'; payload: null }
  | { type: 'RESUME_SYNC'; payload: null }
  | { type: 'GET_SETTINGS'; payload: null }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<ExtensionSettings> }
  | { type: 'GET_DESTINATIONS'; payload: null }
  | { type: 'ADD_DESTINATION'; payload: Omit<Destination, 'id' | 'createdAt' | 'updatedAt' | 'stats'> }
  | { type: 'UPDATE_DESTINATION'; payload: { id: string; updates: Partial<Destination> } }
  | { type: 'DELETE_DESTINATION'; payload: { id: string } }
  | { type: 'TEST_DESTINATION'; payload: { id: string } };

/**
 * All message types union
 */
export type ExtensionMessage =
  | ContentToBackgroundMessage
  | BackgroundToContentMessage
  | PopupToBackgroundMessage;

/**
 * Message response wrapper
 */
export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Publish result from publishers
 */
export interface PublishResult {
  success: boolean;
  publishedUrl?: string;
  remoteId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Storage service interface
 */
export interface IStorageService {
  // Posts
  savePost(content: ExtractedContent): Promise<string>;
  getPost(id: string): Promise<SavedPost | null>;
  updatePost(id: string, updates: Partial<SavedPost>): Promise<void>;
  deletePost(id: string): Promise<void>;
  queryPosts(filter: PostFilter): Promise<SavedPost[]>;
  getPostCount(filter?: Partial<PostFilter>): Promise<number>;

  // Destinations
  saveDestination(destination: Omit<Destination, 'id' | 'createdAt' | 'updatedAt' | 'stats'>): Promise<string>;
  getDestination(id: string): Promise<Destination | null>;
  getDestinations(): Promise<Destination[]>;
  updateDestination(id: string, updates: Partial<Destination>): Promise<void>;
  deleteDestination(id: string): Promise<void>;

  // Queue
  enqueueItem(item: Omit<QueueItem, 'id' | 'createdAt'>): Promise<string>;
  getQueueItem(id: string): Promise<QueueItem | null>;
  updateQueueItem(id: string, updates: Partial<QueueItem>): Promise<void>;
  deleteQueueItem(id: string): Promise<void>;
  getQueueStatus(): Promise<QueueStatus>;
  getPendingItems(limit?: number): Promise<QueueItem[]>;
  getFailedItems(): Promise<QueueItem[]>;

  // Settings
  getSettings(): Promise<ExtensionSettings>;
  updateSettings(settings: Partial<ExtensionSettings>): Promise<void>;
}

/**
 * Publisher interface
 */
export interface IPublisher {
  readonly type: string;
  authenticate(): Promise<boolean>;
  publish(content: ExtractedContent): Promise<PublishResult>;
  update(remoteId: string, content: ExtractedContent): Promise<PublishResult>;
  delete(remoteId: string): Promise<boolean>;
  testConnection(): Promise<boolean>;
}

/**
 * Content extractor interface
 */
export interface IContentExtractor {
  readonly platformName: string;
  detectPosts(): HTMLElement[];
  extractContent(postElement: HTMLElement): Promise<ExtractedContent>;
  extractMedia(postElement: HTMLElement): MediaItem[];
  extractMetadata(postElement: HTMLElement): PostMetadata;
  injectSaveButton(postElement: HTMLElement): void;
  getPostId(postElement: HTMLElement): string;
}

// Re-export for convenience
import type { MediaItem, PostMetadata } from './content';
