/**
 * Queue item status
 */
export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Queue item priority levels
 */
export enum QueuePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

/**
 * Queue item for sync operations
 */
export interface QueueItem {
  id: string;
  postId: string;
  destinationId: string;
  status: QueueItemStatus;
  priority: QueuePriority;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  createdAt: Date;
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Queue status summary
 */
export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  progress: number;
  isProcessing: boolean;
  isPaused: boolean;
  lastProcessedAt?: Date;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  totalProcessed: number;
  totalFailed: number;
  averageProcessingTime: number;
  successRate: number;
}

/**
 * Retry strategy configuration
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterPercent: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 300000,
  backoffMultiplier: 2,
  jitterPercent: 0.2,
};
