import { storage } from '@/lib/storage';
import { queueManager } from '@/lib/queue';
import { createPublisher } from '@/lib/publishers';
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

    // Set up context menus
    setupContextMenus();

    // Set up message handlers
    setupMessageHandlers();

    // Wire up the publisher factory so the queue can publish to remote destinations
    queueManager.setPublisherFactory(createPublisher);

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
 * Set up right-click context menus for saving content from any page
 */
function setupContextMenus(): void {
  chrome.contextMenus.create({
    id: 'save-selection',
    title: 'Save selected text',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'save-image',
    title: 'Save image',
    contexts: ['image'],
  });

  chrome.contextMenus.create({
    id: 'save-page',
    title: 'Save page to Social Media Saver',
    contexts: ['page'],
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    let title = tab?.title || '';
    let text = '';
    let imageUrls: string[] = [];
    const sourceUrl = info.pageUrl || tab?.url || '';

    switch (info.menuItemId) {
      case 'save-selection':
        text = info.selectionText || '';
        break;
      case 'save-image':
        if (info.srcUrl) {
          imageUrls = [info.srcUrl];
        }
        break;
      case 'save-page':
        text = title;
        break;
    }

    const response = await handleSaveCustomContent({
      payload: { title, text, imageUrls, sourceUrl },
    });

    if (response.success) {
      logger.info('Content saved via context menu:', response.data?.postId);
    } else {
      logger.error('Context menu save failed:', response.error);
    }
  });
}

/**
 * Set up message handlers
 */
function setupMessageHandlers(): void {
  createMessageListener({
    // Content saving
    SAVE_CONTENT: handleSaveContent,
    DOWNLOAD_MEDIA: handleDownloadMedia,
    GET_CACHED_MEDIA: handleGetCachedMedia,

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

    // Custom content
    SAVE_CUSTOM_CONTENT: handleSaveCustomContent,

    // Data management
    CLEAR_ALL_DATA: handleClearAllData,
    EXPORT_DATA: handleExportData,
    IMPORT_DATA: handleImportData,
  });
}

// ==================== Message Handlers ====================

async function handleSaveContent(
  message: { payload: ExtractedContent }
): Promise<MessageResponse<{ postId: string }>> {
  try {
    const settings = await storage.getSettings();
    const content = applyContentFilters(message.payload, settings);
    logger.info('Saving content from:', content.platform, content.url);

    // Save to storage
    const postId = await storage.savePost(content);

    // Download media in the background (non-blocking)
    downloadPostMedia(postId, content.media, settings).catch((err) =>
      logger.warn('Media download failed:', err)
    );

    // Get default destination
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

    const publisher = createPublisher(destination);
    const connected = await publisher.testConnection();
    return {
      success: true,
      data: {
        success: connected,
        message: connected ? 'Connection successful' : 'Connection failed',
      },
    };
  } catch (error) {
    return {
      success: true,
      data: {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      },
    };
  }
}

// ==================== Content Filters ====================

/** Common tracking query parameters to strip from URLs. */
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', '_ga', 'ref', 'ref_src',
  'ref_url', 'igshid', 'si', 'feature', 'app',
];

function stripTrackingParams(url: string): string {
  try {
    const u = new URL(url);
    TRACKING_PARAMS.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return url;
  }
}

function applyContentFilters(
  content: ExtractedContent,
  settings: ExtensionSettings
): ExtractedContent {
  let filtered = { ...content };

  // --- Content rules ---
  if (settings.contentRules.stripTracking) {
    if (filtered.url) {
      filtered.url = stripTrackingParams(filtered.url);
    }
    filtered.media = filtered.media.map((m) => ({
      ...m,
      url: stripTrackingParams(m.url),
      thumbnailUrl: m.thumbnailUrl ? stripTrackingParams(m.thumbnailUrl) : m.thumbnailUrl,
    }));
    if (filtered.author?.profileUrl) {
      filtered.author = {
        ...filtered.author,
        profileUrl: stripTrackingParams(filtered.author.profileUrl),
      };
    }
  }

  // --- Privacy rules ---
  if (settings.privacy.removeLocation && filtered.metadata) {
    filtered.metadata = { ...filtered.metadata, location: undefined };
  }

  if (settings.privacy.anonymizeAuthor) {
    filtered.author = {
      id: 'anonymous',
      name: 'Anonymous',
      username: undefined,
      profileUrl: '',
      avatarUrl: undefined,
      verified: false,
    };
  }

  if (settings.privacy.stripMetadata && filtered.metadata) {
    filtered.metadata = {
      ...filtered.metadata,
      hashtags: [],
      mentions: [],
      location: undefined,
      isSponsored: undefined,
      privacy: undefined,
    };
  }

  if (settings.privacy.removeEngagement && filtered.metadata) {
    filtered.metadata = {
      ...filtered.metadata,
      engagement: {},
    };
  }

  return filtered;
}

// ==================== Media Download ====================

/**
 * Download media files for a saved post.
 * Fetches each media URL, caches the blob in IndexedDB, and stores
 * a base64 data URL in the post's media items so images are available
 * offline without relying on the original remote URL.
 */
async function downloadPostMedia(
  postId: string,
  media: ExtractedContent['media'],
  settings: ExtensionSettings
): Promise<void> {
  if (!settings.contentRules.downloadMedia) return;

  const maxBytes = (settings.contentRules.maxMediaSize || 50) * 1024 * 1024;
  const updatedMedia = [...media];
  let changed = false;

  // Cache post media images
  for (let i = 0; i < media.length; i++) {
    const item = media[i];
    try {
      const response = await fetch(item.url);
      if (!response.ok) {
        logger.warn(`Failed to fetch media ${item.url}: ${response.status}`);
        continue;
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > maxBytes) {
        logger.info(`Skipping media (too large: ${contentLength} bytes): ${item.url}`);
        continue;
      }

      const blob = await response.blob();

      if (blob.size > maxBytes) {
        logger.info(`Skipping media (too large: ${blob.size} bytes): ${item.url}`);
        continue;
      }

      await storage.cacheMedia(item.url, postId, blob);

      const dataUrl = await blobToDataUrl(blob);
      updatedMedia[i] = { ...item, cachedUrl: dataUrl };
      changed = true;

      logger.info(`Cached media for post ${postId}: ${item.url} (${blob.size} bytes)`);
    } catch (error) {
      logger.warn(`Failed to download media ${item.url}:`, error);
    }
  }

  // Cache the author's avatar (always attempt, even if no post media)
  const post = await storage.getPost(postId);
  let updatedAuthor = post?.author;
  if (post?.author?.avatarUrl && !post.author.cachedAvatarUrl) {
    try {
      const avatarResp = await fetch(post.author.avatarUrl);
      if (avatarResp.ok) {
        const avatarBlob = await avatarResp.blob();
        if (avatarBlob.size <= maxBytes) {
          await storage.cacheMedia(post.author.avatarUrl, postId, avatarBlob);
          const avatarDataUrl = await blobToDataUrl(avatarBlob);
          updatedAuthor = { ...post.author, cachedAvatarUrl: avatarDataUrl };
          changed = true;
          logger.info(`Cached avatar for post ${postId}`);
        }
      }
    } catch (err) {
      logger.warn(`Failed to cache avatar for post ${postId}:`, err);
    }
  }

  // Update the post with cached data URLs
  if (changed && post) {
    const updates: any = {};
    if (updatedMedia.some(m => m.cachedUrl)) {
      updates.content = { ...post.content, media: updatedMedia };
    }
    if (updatedAuthor !== post.author) {
      updates.author = updatedAuthor;
    }
    await storage.updatePost(postId, updates);
    logger.info(`Updated post ${postId} with cached media/avatar`);
  }
}

/**
 * Convert a Blob to a data URL (works in service workers unlike URL.createObjectURL)
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
  });
}

/**
 * Handle DOWNLOAD_MEDIA message — fetches a URL and returns a cached data URL
 */
async function handleDownloadMedia(
  message: { payload: { url: string; postId?: string } }
): Promise<MessageResponse<{ dataUrl: string }>> {
  try {
    // Try IndexedDB cache first
    const cached = await storage.getCachedMedia(message.payload.url);
    if (cached) {
      const dataUrl = await blobToDataUrl(cached);
      return { success: true, data: { dataUrl } };
    }

    // Fetch and cache
    const response = await fetch(message.payload.url);
    if (!response.ok) {
      return { success: false, error: `Fetch failed: ${response.status}` };
    }

    const blob = await response.blob();
    const postId = message.payload.postId || 'unknown';
    await storage.cacheMedia(message.payload.url, postId, blob);

    const dataUrl = await blobToDataUrl(blob);
    return { success: true, data: { dataUrl } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    };
  }
}

/**
 * Handle GET_CACHED_MEDIA — retrieves a cached media item as a data URL
 */
async function handleGetCachedMedia(
  message: { payload: { url: string } }
): Promise<MessageResponse<{ dataUrl: string | null }>> {
  try {
    const cached = await storage.getCachedMedia(message.payload.url);
    if (cached) {
      const dataUrl = await blobToDataUrl(cached);
      return { success: true, data: { dataUrl } };
    }
    return { success: true, data: { dataUrl: null } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cached media',
    };
  }
}

// ==================== Custom Content Handler ====================

async function handleSaveCustomContent(
  message: { payload: { title: string; text: string; imageUrls: string[]; sourceUrl?: string } }
): Promise<MessageResponse<{ postId: string }>> {
  try {
    const { title, text, imageUrls, sourceUrl } = message.payload;

    const content: ExtractedContent = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform: 'custom',
      url: sourceUrl || '',
      author: {
        id: 'user',
        name: 'User',
        profileUrl: '',
      },
      content: {
        text: text,
        html: `${title ? `<h1>${title}</h1>` : ''}${text.split('\n').map((p) => `<p>${p}</p>`).join('')}`,
        markdown: `${title ? `# ${title}\n\n` : ''}${text}`,
      },
      media: imageUrls.map((url, i) => ({
        type: 'image' as const,
        url,
        alt: title || `Image ${i + 1}`,
      })),
      metadata: {
        timestamp: new Date(),
        engagement: {},
        hashtags: [],
        mentions: [],
      },
      extractedAt: new Date(),
    };

    const settings = await storage.getSettings();
    const filtered = applyContentFilters(content, settings);
    const postId = await storage.savePost(filtered);

    // Download media in the background (non-blocking)
    downloadPostMedia(postId, filtered.media, settings).catch((err) =>
      logger.warn('Media download failed:', err)
    );

    const destinationId = settings.defaultDestination;
    if (destinationId) {
      await queueManager.enqueue(postId, destinationId, QueuePriority.NORMAL);
    } else {
      await storage.updatePost(postId, { status: 'local' });
    }

    logger.info('Custom content saved:', postId);
    return { success: true, data: { postId } };
  } catch (error) {
    logger.error('Failed to save custom content:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==================== Data Management Handlers ====================

async function handleClearAllData(): Promise<MessageResponse<void>> {
  try {
    queueManager.pause();
    await storage.clearAllData();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleExportData(): Promise<
  MessageResponse<{ posts: SavedPost[]; destinations: Destination[]; settings: ExtensionSettings }>
> {
  try {
    const data = await storage.exportData();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function handleImportData(
  message: { payload: { posts?: SavedPost[]; destinations?: Destination[]; settings?: ExtensionSettings } }
): Promise<MessageResponse<void>> {
  try {
    await storage.importData(message.payload);
    return { success: true };
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
