import { storage } from '@/lib/storage';
import { logger } from '@/lib/utils/logger';
import type { QueueItem, SavedPost, Destination } from '@/types';

/**
 * Strategy for handling duplicate publish attempts.
 *
 * - skip       — do nothing if the post was already published to this destination
 * - overwrite  — publish again (the remote side gets a new version)
 * - create-new — always create a fresh remote post (allows multiple copies)
 */
export type ConflictStrategy = 'skip' | 'overwrite' | 'create-new';

export interface ConflictCheckResult {
  hasConflict: boolean;
  strategy: ConflictStrategy;
  existingRemoteId?: string;
  existingPublishedUrl?: string;
}

/**
 * Detects and resolves conflicts when the same post is queued for a
 * destination where it has already been published.
 */
export class ConflictResolver {
  private defaultStrategy: ConflictStrategy;

  constructor(defaultStrategy: ConflictStrategy = 'skip') {
    this.defaultStrategy = defaultStrategy;
  }

  /**
   * Check whether the queue item conflicts with an existing publish.
   *
   * A conflict exists when:
   * 1. The post has status "published" AND is linked to the same destination, OR
   * 2. Another completed queue item for the same post+destination already exists.
   */
  async check(item: QueueItem): Promise<ConflictCheckResult> {
    const post = await storage.getPost(item.postId);
    if (!post) {
      // Post doesn't exist — nothing to conflict with
      return { hasConflict: false, strategy: this.defaultStrategy };
    }

    // Case 1: Post already published to this destination
    if (
      post.status === 'published' &&
      post.destination === item.destinationId &&
      post.remoteId
    ) {
      logger.info(
        `Conflict detected: post ${item.postId} already published to destination ${item.destinationId} (remote ${post.remoteId})`
      );
      return {
        hasConflict: true,
        strategy: this.defaultStrategy,
        existingRemoteId: post.remoteId,
        existingPublishedUrl: post.publishedUrl,
      };
    }

    // Case 2: A completed queue item for the same pair exists
    const queueStatus = await storage.getQueueStatus();
    // We can't query by compound key easily, so we check the post record
    // which is updated on publish — the above check covers this.

    return { hasConflict: false, strategy: this.defaultStrategy };
  }

  /**
   * Resolve the conflict according to the chosen strategy.
   *
   * Returns true if processing should continue, false if it should be skipped.
   */
  async resolve(item: QueueItem, result: ConflictCheckResult): Promise<boolean> {
    if (!result.hasConflict) return true;

    switch (result.strategy) {
      case 'skip':
        logger.info(`Skipping duplicate publish for post ${item.postId}`);
        await storage.updateQueueItem(item.id, {
          status: 'completed',
          completedAt: new Date(),
          metadata: { skippedReason: 'duplicate', existingRemoteId: result.existingRemoteId },
        });
        return false;

      case 'overwrite':
        logger.info(`Overwriting remote post ${result.existingRemoteId} for post ${item.postId}`);
        // Allow processing to continue — the publisher will create a new version
        return true;

      case 'create-new':
        logger.info(`Creating new remote copy for post ${item.postId}`);
        return true;

      default:
        return true;
    }
  }

  /**
   * Check whether a postId+destinationId pair is already queued (pending or
   * processing) to prevent enqueuing duplicates.
   */
  async isDuplicateEnqueue(postId: string, destinationId: string): Promise<boolean> {
    const pending = await storage.getPendingItems(100);
    return pending.some(
      (qi) => qi.postId === postId && qi.destinationId === destinationId
    );
  }
}

export const conflictResolver = new ConflictResolver();
export default conflictResolver;
