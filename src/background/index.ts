import { storage } from '@/lib/storage';
import { queueManager } from '@/lib/queue';
import { createMessageListener } from '@/lib/utils/message-passing';
import { logger, LogLevel } from '@/lib/utils/logger';
import type {
  ExtensionMessage,
  MessageResponse,
  ExtractedContent,
  Destination,
  ExtensionSettings,
  SavedPost,
  QueueStatus,
} from '@/types';
import { QueuePriority } from '@/types';

// Configure logger for background
logger.configure({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  prefix: '[Background]',
});

/**
 * Initialize the extension
 */
async function initialize(): Promise<void> {
  logger.info('Initializing Social Media Saver extension...');

  try {
    // Initialize storage
    await storage.initialize();

    // Set up alarms for periodic tasks
    setupAlarms();

    // Listen for online/offline events
    setupNetworkListeners();

    // Set up message handlers
    setupMessageHandlers();

    // Resume queue processing
    queueManager.resume();

    logger.info('Extension initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize extension:', error);
  }
}

/**
 * Set up periodic alarms
 */
function setupAlarms(): void {
  // Periodic sync alarm
  chrome.alarms.create('periodic-sync', { periodInMinutes: 5 });

  // Cleanup alarm (daily)
  chrome.alarms.create('cleanup', { periodInMinutes: 1440 });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    logger.debug('Alarm triggered:', alarm.name);

    switch (alarm.name) {
      case 'periodic-sync':
        await handlePeriodicSync();
        break;
      case 'cleanup':
        await handleCleanup();
        break;
    }
  });
}

/**
 * Handle periodic sync
 */
async function handlePeriodicSync(): Promise<void> {
  const settings = await storage.getSettings();

  if (settings.backgroundSync) {
    queueManager.resume();
  }
}

/**
 * Handle cleanup tasks
 */
async function handleCleanup(): Promise<void> {
  try {
    // Clear old completed queue items
    const cleared = await storage.clearCompletedItems();
    if (cleared > 0) {
      logger.info(`Cleaned up ${cleared} completed queue items`);
    }
  } catch (error) {
    logger.error('Cleanup failed:', error);
  }
}

/**
 * Set up network state listeners
 */
function setupNetworkListeners(): void {
  // Note: In service workers, we use the online/offline events differently
  // We'll check network status when processing queue items
}

/**
 * Set up message handlers
 */
function setupMessageHandlers(): void {
  createMessageListener({
    // Content saving
    SAVE_CONTENT: handleSaveContent,

    // Settings
    GET_SETTINGS: handleGetSettings,
    UPDATE_SETTINGS: handleUpdateSettings,

    // Platform checks
    CHECK_PLATFORM_ENABLED: handleCheckPlatformEnabled,

    // Queue operations
    GET_QUEUE_STATUS: handleGetQueueStatus,
    RETRY_FAILED: handleRetryFailed,
    RETRY_ALL_FAILED: handleRetryAllFailed,
    PAUSE_SYNC: handlePauseSync,
    RESUME_SYNC: handleResumeSync,

    // Posts
    GET_RECENT_POSTS: handleGetRecentPosts,
    GET_POST: handleGetPost,
    DELETE_POST: handleDeletePost,

    // Destinations
    GET_DESTINATIONS: handleGetDestinations,
    ADD_DESTINATION: handleAddDestination,
    UPDATE_DESTINATION: handleUpdateDestination,
    DELETE_DESTINATION: handleDeleteDestination,
    TEST_DESTINATION: handleTestDestination,
  });
}

// ==================== Message Handlers ====================

async function handleSaveContent(
  message: { payload: ExtractedContent }
): Promise<MessageResponse<{ postId: string }>> {
  try {
    const content = message.payload;
    logger.info('Saving content from:', content.platform, content.url);

    // Save to storage
    const postId = await storage.savePost(content);

    // Get default destination
    const settings = await storage.getSettings();
    const destinationId = settings.defaultDestination;

    if (destinationId) {
      // Add to queue for publishing
      await queueManager.enqueue(postId, destinationId, QueuePriority.NORMAL);
    } else {
      // Just save locally
      await storage.updatePost(postId, { status: 'local' });
    }

    return { success: true, data: { postId } };
  } catch (error) {
    logger.error('Failed to save content:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleGetSettings(): Promise<MessageResponse<ExtensionSettings>> {
  try {
    const settings = await storage.getSettings();
    return { success: true, data: settings };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleUpdateSettings(
  message: { payload: Partial<ExtensionSettings> }
): Promise<MessageResponse<void>> {
  try {
    await storage.updateSettings(message.payload);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleCheckPlatformEnabled(
  message: { payload: { platform: string } }
): Promise<MessageResponse<{ enabled: boolean }>> {
  try {
    const settings = await storage.getSettings();
    const platformSettings = settings.platforms[message.payload.platform as keyof typeof settings.platforms];
    const enabled = platformSettings?.enabled ?? true;
    return { success: true, data: { enabled } };
  } catch (error) {
    return { success: true, data: { enabled: true } };
  }
}

async function handleGetQueueStatus(): Promise<MessageResponse<QueueStatus>> {
  try {
    const status = await queueManager.getStatus();
    return { success: true, data: status };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleRetryFailed(
  message: { payload: { itemId: string } }
): Promise<MessageResponse<void>> {
  try {
    await queueManager.retryItem(message.payload.itemId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleRetryAllFailed(): Promise<MessageResponse<{ count: number }>> {
  try {
    const count = await queueManager.retryAllFailed();
    return { success: true, data: { count } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handlePauseSync(): Promise<MessageResponse<void>> {
  queueManager.pause();
  return { success: true };
}

async function handleResumeSync(): Promise<MessageResponse<void>> {
  queueManager.resume();
  return { success: true };
}

async function handleGetRecentPosts(
  message: { payload: { limit: number } }
): Promise<MessageResponse<SavedPost[]>> {
  try {
    const posts = await storage.queryPosts({ limit: message.payload.limit });
    return { success: true, data: posts };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleGetPost(
  message: { payload: { id: string } }
): Promise<MessageResponse<SavedPost | null>> {
  try {
    const post = await storage.getPost(message.payload.id);
    return { success: true, data: post };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleDeletePost(
  message: { payload: { id: string } }
): Promise<MessageResponse<void>> {
  try {
    await storage.deletePost(message.payload.id);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleGetDestinations(): Promise<MessageResponse<Destination[]>> {
  try {
    const destinations = await storage.getDestinations();
    return { success: true, data: destinations };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleAddDestination(
  message: { payload: Omit<Destination, 'id' | 'createdAt' | 'updatedAt' | 'stats'> }
): Promise<MessageResponse<{ id: string }>> {
  try {
    const id = await storage.saveDestination(message.payload);
    return { success: true, data: { id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleUpdateDestination(
  message: { payload: { id: string; updates: Partial<Destination> } }
): Promise<MessageResponse<void>> {
  try {
    await storage.updateDestination(message.payload.id, message.payload.updates);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleDeleteDestination(
  message: { payload: { id: string } }
): Promise<MessageResponse<void>> {
  try {
    await storage.deleteDestination(message.payload.id);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleTestDestination(
  message: { payload: { id: string } }
): Promise<MessageResponse<{ success: boolean; message: string }>> {
  try {
    const destination = await storage.getDestination(message.payload.id);
    if (!destination) {
      return { success: false, error: 'Destination not found' };
    }

    // For local destinations, always succeed
    if (destination.type === 'local-indexeddb' || destination.type === 'local-filesystem') {
      return { success: true, data: { success: true, message: 'Local storage is ready' } };
    }

    // TODO: Implement actual connection testing for remote destinations
    return { success: true, data: { success: true, message: 'Connection test not implemented' } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==================== Extension Lifecycle ====================

// Initialize when service worker starts
initialize();

// Handle extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info('Extension installed/updated:', details.reason);

  if (details.reason === 'install') {
    // First install - open options page
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    // Update - migrate data if needed
    logger.info('Updated from version:', details.previousVersion);
  }
});

// Handle clicks on extension icon when no popup
chrome.action.onClicked.addListener((tab) => {
  // This won't fire if popup is defined, but kept for reference
  logger.debug('Extension icon clicked on tab:', tab.id);
});

// Export for testing
export { initialize, setupMessageHandlers };
