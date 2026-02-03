import { detectPlatform, getExtractor, type BaseExtractor } from './extractors';
import './ui/styles.css';

/**
 * Content script entry point
 */
class SocialMediaSaverContent {
  private extractor: BaseExtractor | null = null;
  private observer: MutationObserver | null = null;
  private platform: string | null = null;
  private isEnabled: boolean = true;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the content script
   */
  private async initialize(): Promise<void> {
    // Detect platform
    this.platform = detectPlatform();
    if (!this.platform) {
      console.debug('[SocialMediaSaver] Not a supported platform');
      return;
    }

    console.info(`[SocialMediaSaver] Detected platform: ${this.platform}`);

    // Check if platform is enabled
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_PLATFORM_ENABLED',
        payload: { platform: this.platform },
      });
      this.isEnabled = response.data?.enabled ?? true;
    } catch {
      this.isEnabled = true;
    }

    if (!this.isEnabled) {
      console.info('[SocialMediaSaver] Platform is disabled in settings');
      return;
    }

    // Get extractor for this platform
    this.extractor = getExtractor();
    if (!this.extractor) {
      console.warn('[SocialMediaSaver] No extractor available for this platform');
      return;
    }

    // Process existing posts
    this.processExistingPosts();

    // Set up observer for dynamic content
    this.setupObserver();

    // Listen for settings changes
    this.listenForMessages();

    console.info('[SocialMediaSaver] Content script initialized');
  }

  /**
   * Process posts already on the page
   */
  private processExistingPosts(): void {
    if (!this.extractor) return;

    const posts = this.extractor.detectPosts();
    console.log(`[SocialMediaSaver] Found ${posts.length} existing posts`);

    posts.forEach((post, index) => {
      console.log(`[SocialMediaSaver] Calling injectSaveButton for post ${index + 1}`);
      this.extractor!.injectSaveButton(post);
    });
  }

  /**
   * Set up mutation observer for new posts
   */
  private setupObserver(): void {
    if (!this.extractor) return;

    this.observer = new MutationObserver((mutations) => {
      // Debounce to avoid excessive processing
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = setTimeout(() => {
        this.handleMutations(mutations);
      }, 100);
    });

    // Observe the document body for changes
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Handle DOM mutations
   */
  private handleMutations(mutations: MutationRecord[]): void {
    if (!this.extractor || !this.isEnabled) return;

    // Check if any mutations added new nodes
    let hasNewNodes = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }

    if (!hasNewNodes) return;

    // Find and process new posts
    const posts = this.extractor.detectPosts();
    console.log(`[SocialMediaSaver] Processing ${posts.length} posts from mutations`);
    posts.forEach((post, index) => {
      console.log(`[SocialMediaSaver] Calling injectSaveButton for post ${index + 1} (from mutation)`);
      this.extractor!.injectSaveButton(post);
    });
  }

  /**
   * Listen for messages from background
   */
  private listenForMessages(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'SETTINGS_UPDATED':
          this.handleSettingsUpdate(message.payload);
          sendResponse({ success: true });
          break;

        case 'PLATFORM_STATUS':
          this.isEnabled = message.payload.enabled;
          if (!this.isEnabled) {
            this.cleanup();
          } else if (this.extractor) {
            this.processExistingPosts();
            this.setupObserver();
          }
          sendResponse({ success: true });
          break;

        default:
          return false;
      }
      return true;
    });
  }

  /**
   * Handle settings update
   */
  private handleSettingsUpdate(settings: any): void {
    if (this.platform && settings.platforms) {
      const platformSettings = settings.platforms[this.platform];
      if (platformSettings) {
        const wasEnabled = this.isEnabled;
        this.isEnabled = platformSettings.enabled;

        if (wasEnabled && !this.isEnabled) {
          this.cleanup();
        } else if (!wasEnabled && this.isEnabled) {
          this.processExistingPosts();
          this.setupObserver();
        }
      }
    }
  }

  /**
   * Clean up observers and injected elements
   */
  private cleanup(): void {
    // Stop observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Remove injected buttons
    const buttons = document.querySelectorAll('.social-saver-btn');
    buttons.forEach((btn) => btn.remove());

    console.info('[SocialMediaSaver] Content script cleaned up');
  }

  /**
   * Destroy the content script
   */
  destroy(): void {
    this.cleanup();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SocialMediaSaverContent();
  });
} else {
  new SocialMediaSaverContent();
}
