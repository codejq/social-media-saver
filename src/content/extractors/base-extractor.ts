import type {
  PlatformType,
  ExtractedContent,
  MediaItem,
  PostMetadata,
  AuthorInfo,
  ContentFormats,
} from '@/types';
import { generateId } from '@/lib/utils/validators';
import TurndownService from 'turndown';
import DOMPurify from 'dompurify';

/**
 * Base class for content extractors
 */
export abstract class BaseExtractor {
  protected turndown: TurndownService;
  protected processedPosts: Set<string> = new Set();

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
    });
  }

  /**
   * Platform name
   */
  abstract get platformName(): PlatformType;

  /**
   * Platform-specific selectors
   */
  abstract get selectors(): Record<string, string>;

  /**
   * Detect all posts on the page
   */
  abstract detectPosts(): HTMLElement[];

  /**
   * Extract author information from a post
   */
  abstract extractAuthor(postElement: HTMLElement): AuthorInfo;

  /**
   * Get the permalink for a post
   */
  abstract getPermalink(postElement: HTMLElement): string;

  /**
   * Find the best location to inject the save button
   */
  abstract findButtonInjectionPoint(postElement: HTMLElement): HTMLElement | null;

  /**
   * Generate a unique ID for a post element
   */
  getPostId(postElement: HTMLElement): string {
    // Try to find an existing ID
    const dataId = postElement.dataset.postId || postElement.id;
    if (dataId) return `${this.platformName}-${dataId}`;

    // Generate from permalink — use it as long as its pathname differs from
    // the current page.  On timelines the post path is a sub-path of the
    // profile URL (e.g. /user/posts/xxx vs /user) but is still unique.
    const permalink = this.getPermalink(postElement);
    if (permalink && permalink !== window.location.href) {
      try {
        const postUrl = new URL(permalink);
        if (postUrl.pathname !== window.location.pathname) {
          const pathId = postUrl.pathname.replace(/\//g, '-');
          if (pathId && pathId !== '-') {
            return `${this.platformName}${pathId}`;
          }
        }
      } catch {
        // Invalid URL, fall through to content hash
      }
    }

    // Fallback to hash of content
    const content = postElement.textContent?.slice(0, 200) || '';
    const hash = this.hashString(content);
    return `${this.platformName}-${hash}`;
  }

  /**
   * Extract all content from a post
   */
  async extractContent(postElement: HTMLElement): Promise<ExtractedContent> {
    const id = this.getPostId(postElement);
    const author = this.extractAuthor(postElement);
    const content = this.extractTextContent(postElement);
    const media = this.extractMedia(postElement);
    const metadata = this.extractMetadata(postElement);
    const url = this.getPermalink(postElement);

    return {
      id,
      platform: this.platformName,
      url,
      author,
      content,
      media,
      metadata,
      extractedAt: new Date(),
      rawHtml: postElement.outerHTML,
    };
  }

  /**
   * Extract text content in multiple formats
   */
  extractTextContent(postElement: HTMLElement): ContentFormats {
    const textSelector = this.selectors.postText;
    let textElement: Element | null = null;

    if (textSelector) {
      // Pick the candidate with the longest text content — avoids grabbing
      // short UI labels (e.g. the page name "Facebook") that appear first in
      // the DOM but are not the actual post body.
      const candidates = postElement.querySelectorAll(textSelector);
      let bestLen = 0;
      candidates.forEach((el) => {
        const len = (el.textContent || '').trim().length;
        if (len > bestLen) {
          bestLen = len;
          textElement = el;
        }
      });
    }

    const source = textElement || postElement;
    const html = source.innerHTML || '';
    const sanitizedHtml = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote'],
      ALLOWED_ATTR: ['href'],
    });

    const text = source.textContent?.trim() || '';
    const markdown = this.turndown.turndown(sanitizedHtml);

    return { text, html: sanitizedHtml, markdown };
  }

  /**
   * Extract media items from a post
   */
  extractMedia(postElement: HTMLElement): MediaItem[] {
    const media: MediaItem[] = [];

    // Extract images
    const imageSelector = this.selectors.image;
    if (imageSelector) {
      const images = postElement.querySelectorAll<HTMLImageElement>(imageSelector);
      images.forEach((img) => {
        const url = this.getBestImageUrl(img);
        if (url && !media.some((m) => m.url === url)) {
          media.push({
            type: 'image',
            url,
            alt: img.alt,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
          });
        }
      });
    }

    // Extract videos
    const videoSelector = this.selectors.video;
    if (videoSelector) {
      const videos = postElement.querySelectorAll<HTMLVideoElement>(videoSelector);
      videos.forEach((video) => {
        const url = video.src || video.querySelector('source')?.src;
        if (url && !media.some((m) => m.url === url)) {
          media.push({
            type: 'video',
            url,
            thumbnailUrl: video.poster,
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
          });
        }
      });
    }

    return media;
  }

  /**
   * Extract metadata from a post
   */
  extractMetadata(postElement: HTMLElement): PostMetadata {
    const timestamp = this.extractTimestamp(postElement);
    const engagement = this.extractEngagement(postElement);
    const hashtags = this.extractHashtags(postElement);
    const mentions = this.extractMentions(postElement);

    return {
      timestamp,
      engagement,
      hashtags,
      mentions,
    };
  }

  /**
   * Extract timestamp from a post
   */
  extractTimestamp(postElement: HTMLElement): Date {
    const timestampSelector = this.selectors.timestamp;
    if (!timestampSelector) return new Date();

    const timeElement = postElement.querySelector(timestampSelector);
    if (!timeElement) return new Date();

    // Try datetime attribute
    const datetime = timeElement.getAttribute('datetime');
    if (datetime) {
      const date = new Date(datetime);
      if (!isNaN(date.getTime())) return date;
    }

    // Try data-utime (Facebook)
    const utime = timeElement.getAttribute('data-utime');
    if (utime) {
      const timestamp = parseInt(utime, 10) * 1000;
      return new Date(timestamp);
    }

    // Try to parse text content
    const text = timeElement.textContent?.trim();
    if (text) {
      const date = new Date(text);
      if (!isNaN(date.getTime())) return date;
    }

    return new Date();
  }

  /**
   * Extract engagement metrics
   */
  extractEngagement(postElement: HTMLElement): PostMetadata['engagement'] {
    return {
      likes: this.extractNumber(postElement, this.selectors.likes),
      shares: this.extractNumber(postElement, this.selectors.shares),
      comments: this.extractNumber(postElement, this.selectors.comments),
    };
  }

  /**
   * Extract hashtags from post content
   */
  extractHashtags(postElement: HTMLElement): string[] {
    const text = postElement.textContent || '';
    const hashtagRegex = /#[\w\u0080-\uFFFF]+/g;
    const matches = text.match(hashtagRegex) || [];
    return [...new Set(matches.map((tag) => tag.slice(1)))];
  }

  /**
   * Extract mentions from post content
   */
  extractMentions(postElement: HTMLElement): string[] {
    const text = postElement.textContent || '';
    const mentionRegex = /@[\w\u0080-\uFFFF]+/g;
    const matches = text.match(mentionRegex) || [];
    return [...new Set(matches.map((mention) => mention.slice(1)))];
  }

  /**
   * Inject save button into a post
   */
  injectSaveButton(postElement: HTMLElement): void {
    const postId = this.getPostId(postElement);

    // Check if already processed AND button still exists
    if (this.processedPosts.has(postId)) {
      // Verify the button is still in the DOM
      const existingButton = postElement.querySelector('.social-saver-btn');
      if (existingButton && document.body.contains(existingButton)) {
        console.log(`[${this.platformName}] Button already exists for post:`, postId);
        return;
      } else {
        // Button was removed (likely by DOM updates), re-inject it
        console.log(`[${this.platformName}] Re-injecting button for post (DOM updated):`, postId);
        this.processedPosts.delete(postId); // Remove from processed set
      }
    }

    // Find injection point
    const injectionPoint = this.findButtonInjectionPoint(postElement);
    if (!injectionPoint) {
      console.warn(`[${this.platformName}] No injection point found for post:`, postId);
      return;
    }

    // Create button
    const button = this.createSaveButton(postElement);
    console.log(`[${this.platformName}] Injecting button into:`, injectionPoint.tagName, injectionPoint.className);

    // Inject
    injectionPoint.appendChild(button);
    this.processedPosts.add(postId);

    // Verify injection
    setTimeout(() => {
      if (document.body.contains(button)) {
        console.log(`[${this.platformName}] ✓ Button successfully injected and visible`);
      } else {
        console.warn(`[${this.platformName}] ✗ Button was removed from DOM after injection`);
      }
    }, 100);
  }

  /**
   * Create the save button element
   */
  protected createSaveButton(postElement: HTMLElement): HTMLElement {
    const button = document.createElement('button');
    button.className = 'social-saver-btn';
    button.setAttribute('data-post-id', this.getPostId(postElement));
    button.innerHTML = `
      <svg class="social-saver-icon" viewBox="0 0 24 24" width="18" height="18">
        <path fill="currentColor" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
      </svg>
      <span class="social-saver-text">Save</span>
    `;

    button.addEventListener('click', (e) => this.handleSaveClick(e, postElement));

    return button;
  }

  /**
   * Handle save button click
   */
  protected async handleSaveClick(event: Event, postElement: HTMLElement): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget as HTMLElement;
    const originalContent = button.innerHTML;

    try {
      // Show loading state
      button.classList.add('loading');
      button.innerHTML = `
        <svg class="social-saver-icon spin" viewBox="0 0 24 24" width="18" height="18">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4" stroke-linecap="round"/>
        </svg>
        <span class="social-saver-text">Saving...</span>
      `;

      // Extract content
      const content = await this.extractContent(postElement);

      // Send to background with retry — MV3 service workers can go to sleep,
      // causing "Extension context invalidated".  A short delay lets Chrome
      // wake the worker back up before we retry.
      let response: any;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await chrome.runtime.sendMessage({
            type: 'SAVE_CONTENT',
            payload: content,
          });
          break;
        } catch (sendErr: any) {
          if (attempt === 2) throw sendErr;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (response.success) {
        // Show success state
        button.classList.remove('loading');
        button.classList.add('success');
        button.innerHTML = `
          <svg class="social-saver-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          <span class="social-saver-text">Saved!</span>
        `;

        // Reset after delay
        setTimeout(() => {
          button.classList.remove('success');
          button.innerHTML = originalContent;
        }, 2000);
      } else {
        throw new Error(response.error || 'Save failed');
      }
    } catch (error) {
      // Show error state
      button.classList.remove('loading');
      button.classList.add('error');
      button.innerHTML = `
        <svg class="social-saver-icon" viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span class="social-saver-text">Error</span>
      `;

      // Reset after delay
      setTimeout(() => {
        button.classList.remove('error');
        button.innerHTML = originalContent;
      }, 3000);

      console.error('[SocialMediaSaver] Save error:', error);
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Get the best quality image URL
   */
  protected getBestImageUrl(img: HTMLImageElement): string {
    // Try srcset first
    const srcset = img.srcset;
    if (srcset) {
      const sources = srcset.split(',').map((s) => {
        const [url, size] = s.trim().split(' ');
        const width = parseInt(size?.replace('w', '') || '0', 10);
        return { url, width };
      });
      sources.sort((a, b) => b.width - a.width);
      if (sources[0]?.url) return sources[0].url;
    }

    // Try data-src (lazy loading)
    const dataSrc = img.dataset.src || img.dataset.lazySrc;
    if (dataSrc) return dataSrc;

    return img.src;
  }

  /**
   * Extract a number from an element
   */
  protected extractNumber(container: HTMLElement, selector?: string): number | undefined {
    if (!selector) return undefined;

    const element = container.querySelector(selector);
    if (!element) return undefined;

    const text = element.textContent || element.getAttribute('aria-label') || '';
    const match = text.match(/[\d,]+/);
    if (!match) return undefined;

    return parseInt(match[0].replace(/,/g, ''), 10);
  }

  /**
   * Simple string hash
   */
  protected hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

export default BaseExtractor;
