import type { QueueItem, QueueStatus, SavedPost, Destination, ExtractedContent, PublishResult } from '@/types';
import { QueuePriority } from '@/types';
import { storage } from '@/lib/storage';
import { RetryStrategy } from './retry-strategy';
import { logger } from '@/lib/utils/logger';

/**
 * Publisher factory type
 */
type PublisherFactory = (destination: Destination) => {
  publish(content: ExtractedContent): Promise<PublishResult>;
};

/**
 * Queue manager for handling background sync operations
 */
export class QueueManager {
  private processing: Set<string> = new Set();
  private maxConcurrent: number = 3;
  private retryStrategy: RetryStrategy;
  private publisherFactory: PublisherFactory | null = null;
  private isPaused: boolean = false;
  private isProcessing: boolean = false;

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
    this.retryStrategy = new RetryStrategy();
  }

  /**
   * Set the publisher factory for creating publishers
   */
  setPublisherFactory(factory: PublisherFactory): void {
    this.publisherFactory = factory;
  }

  /**
   * Add an item to the queue
   */
  async enqueue(
    postId: string,
    destinationId: string,
    priority: QueuePriority = QueuePriority.NORMAL
  ): Promise<string> {
    const itemId = await storage.enqueueItem({
      postId,
      destinationId,
      status: 'pending',
      priority,
      retryCount: 0,
      maxRetries: 3,
    });

    logger.info(`Enqueued item ${itemId} for post ${postId}`);

    // Start processing if not already running
    this.processQueue();

    return itemId;
  }

  /**
   * Start processing the queue
   */
  async processQueue(): Promise<void> {
    if (this.isPaused || this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (!this.isPaused) {
        // Check if we can process more items
        if (this.processing.size >= this.maxConcurrent) {
          break;
        }

        // Get next pending item
        const items = await storage.getPendingItems(1);
        if (items.length === 0) {
          break;
        }

        const item = items[0];
        if (this.processing.has(item.id)) {
          continue;
        }

        // Start processing the item
        this.processing.add(item.id);
        this.processItem(item).finally(() => {
          this.processing.delete(item.id);
          // Continue processing
          if (!this.isPaused) {
            this.processQueue();
          }
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: QueueItem): Promise<void> {
    logger.info(`Processing queue item ${item.id}`);

    try {
      // Update status to processing
      await storage.updateQueueItem(item.id, {
        status: 'processing',
        startedAt: new Date(),
      });

      // Get post and destination
      const post = await storage.getPost(item.postId);
      const destination = await storage.getDestination(item.destinationId);

      if (!post) {
        throw new Error(`Post not found: ${item.postId}`);
      }

      if (!destination) {
        throw new Error(`Destination not found: ${item.destinationId}`);
      }

      // Publish content
      const result = await this.publishContent(post, destination);

      if (result.success) {
        // Update post status
        await storage.updatePost(item.postId, {
          status: 'published',
          publishedUrl: result.publishedUrl,
          remoteId: result.remoteId,
          destination: item.destinationId,
        });

        // Mark queue item as completed
        await storage.updateQueueItem(item.id, {
          status: 'completed',
          completedAt: new Date(),
        });

        // Update destination stats
        await storage.updateDestination(item.destinationId, {
          lastSync: new Date(),
          stats: {
            ...destination.stats,
            totalPublished: destination.stats.totalPublished + 1,
          },
        });

        logger.info(`Successfully published post ${item.postId}`);
        this.notifySuccess(post, result.publishedUrl);
      } else {
        throw new Error(result.error || 'Unknown publish error');
      }
    } catch (error) {
      await this.handleError(item, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Publish content to destination
   */
  private async publishContent(
    post: SavedPost,
    destination: Destination
  ): Promise<PublishResult> {
    if (!this.publisherFactory) {
      // For local storage, just mark as complete
      if (destination.type === 'local-indexeddb') {
        return { success: true };
      }
      throw new Error('Publisher factory not configured');
    }

    const publisher = this.publisherFactory(destination);
    return publisher.publish(post.content);
  }

  /**
   * Handle processing error
   */
  private async handleError(item: QueueItem, error: Error): Promise<void> {
    const newRetryCount = item.retryCount + 1;

    logger.error(`Error processing item ${item.id}:`, error.message);

    if (newRetryCount >= item.maxRetries) {
      // Max retries reached - mark as failed
      await storage.updateQueueItem(item.id, {
        status: 'failed',
        lastError: error.message,
        retryCount: newRetryCount,
      });

      await storage.updatePost(item.postId, {
        status: 'failed',
        error: error.message,
      });

      this.notifyFailure(item, error.message);
    } else {
      // Schedule retry
      const delay = this.retryStrategy.getDelay(newRetryCount);
      const scheduledFor = new Date(Date.now() + delay);

      await storage.updateQueueItem(item.id, {
        status: 'pending',
        retryCount: newRetryCount,
        lastError: error.message,
        scheduledFor,
      });

      logger.info(`Scheduled retry for item ${item.id} at ${scheduledFor.toISOString()}`);
    }
  }

  /**
   * Retry a failed item
   */
  async retryItem(itemId: string): Promise<void> {
    const item = await storage.getQueueItem(itemId);
    if (!item || item.status !== 'failed') {
      throw new Error('Item not found or not in failed state');
    }

    await storage.updateQueueItem(itemId, {
      status: 'pending',
      retryCount: 0,
      lastError: undefined,
      scheduledFor: undefined,
    });

    await storage.updatePost(item.postId, {
      status: 'pending',
      error: undefined,
    });

    this.processQueue();
  }

  /**
   * Retry all failed items
   */
  async retryAllFailed(): Promise<number> {
    const failedItems = await storage.getFailedItems();

    for (const item of failedItems) {
      await storage.updateQueueItem(item.id, {
        status: 'pending',
        retryCount: 0,
        lastError: undefined,
        scheduledFor: undefined,
      });

      await storage.updatePost(item.postId, {
        status: 'pending',
        error: undefined,
      });
    }

    this.processQueue();
    return failedItems.length;
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.isPaused = true;
    logger.info('Queue processing paused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.isPaused = false;
    logger.info('Queue processing resumed');
    this.processQueue();
  }

  /**
   * Get queue status
   */
  async getStatus(): Promise<QueueStatus> {
    const status = await storage.getQueueStatus();
    return {
      ...status,
      isPaused: this.isPaused,
      isProcessing: this.processing.size > 0,
    };
  }

  /**
   * Send success notification
   */
  private notifySuccess(post: SavedPost, publishedUrl?: string): void {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon-128.png',
      title: 'Content Published',
      message: `Post from ${post.author.name} has been published successfully.`,
    });
  }

  /**
   * Send failure notification
   */
  private notifyFailure(item: QueueItem, error: string): void {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon-128.png',
      title: 'Publishing Failed',
      message: `Failed to publish content: ${error}`,
    });
  }
}

export const queueManager = new QueueManager();
export default queueManager;
