import Dexie, { Table } from 'dexie';
import type {
  SavedPost,
  Destination,
  QueueItem,
  QueueStatus,
  PostFilter,
  ExtractedContent,
  ExtensionSettings,
  IStorageService,
} from '@/types';
import { DEFAULT_SETTINGS, QueuePriority } from '@/types';
import { generateId } from '@/lib/utils/validators';
import { logger } from '@/lib/utils/logger';

/**
 * Media cache entry for downloaded media
 */
interface MediaCache {
  id: string;
  url: string;
  postId: string;
  blob: Blob;
  downloaded: Date;
}

/**
 * Dexie database for Social Media Saver
 */
class SocialMediaDatabase extends Dexie {
  posts!: Table<SavedPost, string>;
  destinations!: Table<Destination, string>;
  queue!: Table<QueueItem, string>;
  media!: Table<MediaCache, string>;

  constructor() {
    super('SocialMediaSaver');

    this.version(1).stores({
      posts: 'id, platform, [author.id], timestamp, destination, status, createdAt',
      destinations: 'id, name, type, enabled, isDefault',
      queue: 'id, postId, destinationId, status, priority, createdAt, scheduledFor',
      media: 'id, url, postId, downloaded',
    });
  }
}

/**
 * Storage service implementation using IndexedDB
 */
export class IndexedDBStorage implements IStorageService {
  private db: SocialMediaDatabase;

  constructor() {
    this.db = new SocialMediaDatabase();
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    await this.db.open();
    logger.info('IndexedDB initialized');
  }

  // ==================== Posts ====================

  async savePost(content: ExtractedContent): Promise<string> {
    const id = generateId();
    const now = new Date();

    const post: SavedPost = {
      id,
      platform: content.platform,
      url: content.url,
      author: content.author,
      content,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await this.db.posts.add(post);
    logger.debug('Post saved:', id);
    return id;
  }

  async getPost(id: string): Promise<SavedPost | null> {
    const post = await this.db.posts.get(id);
    return post || null;
  }

  async updatePost(id: string, updates: Partial<SavedPost>): Promise<void> {
    await this.db.posts.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
    logger.debug('Post updated:', id);
  }

  async deletePost(id: string): Promise<void> {
    await this.db.posts.delete(id);
    // Also delete associated queue items and media
    await this.db.queue.where('postId').equals(id).delete();
    await this.db.media.where('postId').equals(id).delete();
    logger.debug('Post deleted:', id);
  }

  async queryPosts(filter: PostFilter): Promise<SavedPost[]> {
    let collection = this.db.posts.toCollection();

    if (filter.platform) {
      collection = this.db.posts.where('platform').equals(filter.platform);
    }

    if (filter.status) {
      collection = collection.filter(post => post.status === filter.status);
    }

    if (filter.destination) {
      collection = collection.filter(post => post.destination === filter.destination);
    }

    if (filter.fromDate) {
      collection = collection.filter(post => post.createdAt >= filter.fromDate!);
    }

    if (filter.toDate) {
      collection = collection.filter(post => post.createdAt <= filter.toDate!);
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      collection = collection.filter(
        post =>
          post.content.content.text.toLowerCase().includes(searchLower) ||
          post.author.name.toLowerCase().includes(searchLower)
      );
    }

    let result = await collection.reverse().sortBy('createdAt');

    if (filter.offset) {
      result = result.slice(filter.offset);
    }

    if (filter.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  async getPostCount(filter?: Partial<PostFilter>): Promise<number> {
    if (!filter) {
      return this.db.posts.count();
    }

    const posts = await this.queryPosts({ ...filter, limit: undefined, offset: undefined });
    return posts.length;
  }

  // ==================== Destinations ====================

  async saveDestination(
    destination: Omit<Destination, 'id' | 'createdAt' | 'updatedAt' | 'stats'>
  ): Promise<string> {
    const id = generateId();
    const now = new Date();

    const dest: Destination = {
      ...destination,
      id,
      stats: { totalPublished: 0, failedCount: 0 },
      createdAt: now,
      updatedAt: now,
    };

    await this.db.destinations.add(dest);
    logger.debug('Destination saved:', id);
    return id;
  }

  async getDestination(id: string): Promise<Destination | null> {
    const dest = await this.db.destinations.get(id);
    return dest || null;
  }

  async getDestinations(): Promise<Destination[]> {
    return this.db.destinations.toArray();
  }

  async updateDestination(id: string, updates: Partial<Destination>): Promise<void> {
    await this.db.destinations.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
    logger.debug('Destination updated:', id);
  }

  async deleteDestination(id: string): Promise<void> {
    await this.db.destinations.delete(id);
    // Remove destination reference from posts
    await this.db.posts
      .where('destination')
      .equals(id)
      .modify({ destination: undefined });
    logger.debug('Destination deleted:', id);
  }

  async getDefaultDestination(): Promise<Destination | null> {
    const dest = await this.db.destinations.where('isDefault').equals(1).first();
    return dest || null;
  }

  // ==================== Queue ====================

  async enqueueItem(item: Omit<QueueItem, 'id' | 'createdAt'>): Promise<string> {
    const id = generateId();
    const now = new Date();

    const queueItem: QueueItem = {
      ...item,
      id,
      createdAt: now,
    };

    await this.db.queue.add(queueItem);
    logger.debug('Queue item added:', id);
    return id;
  }

  async getQueueItem(id: string): Promise<QueueItem | null> {
    const item = await this.db.queue.get(id);
    return item || null;
  }

  async updateQueueItem(id: string, updates: Partial<QueueItem>): Promise<void> {
    await this.db.queue.update(id, updates);
    logger.debug('Queue item updated:', id);
  }

  async deleteQueueItem(id: string): Promise<void> {
    await this.db.queue.delete(id);
    logger.debug('Queue item deleted:', id);
  }

  async getQueueStatus(): Promise<QueueStatus> {
    const pending = await this.db.queue.where('status').equals('pending').count();
    const processing = await this.db.queue.where('status').equals('processing').count();
    const completed = await this.db.queue.where('status').equals('completed').count();
    const failed = await this.db.queue.where('status').equals('failed').count();
    const total = pending + processing + completed + failed;

    const lastCompleted = await this.db.queue
      .where('status')
      .equals('completed')
      .reverse()
      .sortBy('completedAt');

    return {
      pending,
      processing,
      completed,
      failed,
      total,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      isProcessing: processing > 0,
      isPaused: false,
      lastProcessedAt: lastCompleted[0]?.completedAt,
    };
  }

  async getPendingItems(limit?: number): Promise<QueueItem[]> {
    let query = this.db.queue
      .where('status')
      .equals('pending')
      .filter(item => !item.scheduledFor || item.scheduledFor <= new Date());

    const items = await query.sortBy('priority');
    // Sort by priority descending (higher priority first)
    items.sort((a, b) => b.priority - a.priority);

    return limit ? items.slice(0, limit) : items;
  }

  async getFailedItems(): Promise<QueueItem[]> {
    return this.db.queue.where('status').equals('failed').toArray();
  }

  async clearCompletedItems(olderThan?: Date): Promise<number> {
    const cutoff = olderThan || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const toDelete = await this.db.queue
      .where('status')
      .equals('completed')
      .filter(item => !!(item.completedAt && item.completedAt < cutoff))
      .toArray();

    await this.db.queue.bulkDelete(toDelete.map(item => item.id));
    return toDelete.length;
  }

  // ==================== Media Cache ====================

  async cacheMedia(url: string, postId: string, blob: Blob): Promise<string> {
    const id = generateId();

    await this.db.media.add({
      id,
      url,
      postId,
      blob,
      downloaded: new Date(),
    });

    return id;
  }

  async getCachedMedia(url: string): Promise<Blob | null> {
    const cached = await this.db.media.where('url').equals(url).first();
    return cached?.blob || null;
  }

  async clearMediaCache(postId?: string): Promise<void> {
    if (postId) {
      await this.db.media.where('postId').equals(postId).delete();
    } else {
      await this.db.media.clear();
    }
  }

  // ==================== Settings ====================

  async getSettings(): Promise<ExtensionSettings> {
    const result = await chrome.storage.local.get('settings');
    return { ...DEFAULT_SETTINGS, ...result.settings };
  }

  async updateSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const current = await this.getSettings();
    await chrome.storage.local.set({
      settings: { ...current, ...settings },
    });
    logger.debug('Settings updated');
  }

  // ==================== Utilities ====================

  async getStorageUsage(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  }

  async exportData(): Promise<{
    posts: SavedPost[];
    destinations: Destination[];
    settings: ExtensionSettings;
  }> {
    const [posts, destinations, settings] = await Promise.all([
      this.db.posts.toArray(),
      this.db.destinations.toArray(),
      this.getSettings(),
    ]);

    return { posts, destinations, settings };
  }

  async importData(data: {
    posts?: SavedPost[];
    destinations?: Destination[];
    settings?: ExtensionSettings;
  }): Promise<void> {
    if (data.posts) {
      await this.db.posts.bulkPut(data.posts);
    }
    if (data.destinations) {
      await this.db.destinations.bulkPut(data.destinations);
    }
    if (data.settings) {
      await this.updateSettings(data.settings);
    }
    logger.info('Data imported');
  }

  async clearAllData(): Promise<void> {
    await Promise.all([
      this.db.posts.clear(),
      this.db.destinations.clear(),
      this.db.queue.clear(),
      this.db.media.clear(),
    ]);
    await chrome.storage.local.remove('settings');
    logger.info('All data cleared');
  }
}

// Singleton instance
export const storage = new IndexedDBStorage();
export default storage;
