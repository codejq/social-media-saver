import type { RetryConfig } from '@/types';
import { DEFAULT_RETRY_CONFIG } from '@/types';

/**
 * Calculate retry delay using exponential backoff with jitter
 */
export function calculateRetryDelay(attemptNumber: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  // Calculate base delay with exponential backoff
  const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

  // Add jitter (random variance to prevent thundering herd)
  const jitterRange = cappedDelay * config.jitterPercent;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;

  return Math.floor(cappedDelay + jitter);
}

/**
 * Check if retry should be attempted
 */
export function shouldRetry(
  attemptNumber: number,
  error: Error,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  // Check max retries
  if (attemptNumber >= config.maxRetries) {
    return false;
  }

  // Don't retry on certain error types
  const nonRetryableErrors = [
    'AuthenticationError',
    'AuthorizationError',
    'ValidationError',
    'NotFoundError',
  ];

  if (nonRetryableErrors.includes(error.name)) {
    return false;
  }

  // Check for HTTP status codes that shouldn't be retried
  const errorMessage = error.message.toLowerCase();
  if (
    errorMessage.includes('401') ||
    errorMessage.includes('403') ||
    errorMessage.includes('404') ||
    errorMessage.includes('422')
  ) {
    return false;
  }

  return true;
}

/**
 * Retry strategy class for more complex retry logic
 */
export class RetryStrategy {
  constructor(private config: RetryConfig = DEFAULT_RETRY_CONFIG) {}

  getDelay(attemptNumber: number): number {
    return calculateRetryDelay(attemptNumber, this.config);
  }

  shouldRetry(attemptNumber: number, error: Error): boolean {
    return shouldRetry(attemptNumber, error, this.config);
  }

  getNextAttemptTime(attemptNumber: number): Date {
    const delay = this.getDelay(attemptNumber);
    return new Date(Date.now() + delay);
  }

  /**
   * Execute a function with automatic retries
   */
  async execute<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error, delay: number) => void
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.shouldRetry(attempt, lastError)) {
          throw lastError;
        }

        const delay = this.getDelay(attempt);

        if (onRetry) {
          onRetry(attempt + 1, lastError, delay);
        }

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default RetryStrategy;
