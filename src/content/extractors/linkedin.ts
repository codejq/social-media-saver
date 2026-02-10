import { BaseExtractor } from './base-extractor';
import type { PlatformType, AuthorInfo, MediaItem, PostMetadata } from '@/types';

/**
 * LinkedIn content extractor
 *
 * Selectors derived from real LinkedIn feed HTML (2025 layout).
 * Posts live inside `.feed-shared-update-v2[data-urn]` cards.
 */
export class LinkedInExtractor extends BaseExtractor {
  get platformName(): PlatformType {
    return 'linkedin';
  }

  get selectors(): Record<string, string> {
    return {
      // Post container
      post: '.feed-shared-update-v2[data-urn]',
      postText: '.update-components-text.update-components-update-v2__commentary',

      // Author info
      authorName: '.update-components-actor__title span[aria-hidden="true"]',
      authorLink: '.update-components-actor__meta-link',
      authorAvatar: '.update-components-actor__avatar-image',
      authorDescription: '.update-components-actor__description span[aria-hidden="true"]',

      // Timestamp — relative text like "5d •" inside sub-description
      timestamp: '.update-components-actor__sub-description span[aria-hidden="true"]',

      // Media
      image: '.update-components-image img, .update-components-article img',
      video: 'video',

      // Engagement
      reactions: '.social-details-social-counts__social-proof-fallback-number',
      comments: '.social-details-social-counts__comments span[aria-hidden="true"]',
      reposts: '.social-details-social-counts__item--right-aligned span[aria-hidden="true"]',

      // Action bar (button injection point)
      actionBar: '.feed-shared-social-action-bar',
    };
  }

  detectPosts(): HTMLElement[] {
    const posts: HTMLElement[] = [];

    // Primary selector: the card with a data-urn attribute
    const elements = document.querySelectorAll<HTMLElement>(
      '.feed-shared-update-v2[data-urn]'
    );

    elements.forEach((el) => {
      if (this.isValidPost(el)) {
        posts.push(el);
      }
    });

    // Fallback: parent wrappers that carry data-id
    if (posts.length === 0) {
      const wrappers = document.querySelectorAll<HTMLElement>(
        '[data-id^="urn:li:activity"]'
      );
      wrappers.forEach((el) => {
        const inner = el.querySelector<HTMLElement>('.feed-shared-update-v2');
        const target = inner || el;
        if (!posts.includes(target) && this.isValidPost(target)) {
          posts.push(target);
        }
      });
    }

    return posts;
  }

  extractAuthor(postElement: HTMLElement): AuthorInfo {
    // --- Name ---
    // The title is inside deeply nested spans. The aria-hidden one has the
    // visible text (without screen-reader duplicates).
    const titleSpan = postElement.querySelector<HTMLElement>(
      '.update-components-actor__title span[dir="ltr"] span[aria-hidden="true"]'
    );
    let name = titleSpan?.textContent?.trim() || '';

    // Fallback: broader selector
    if (!name) {
      const fallback = postElement.querySelector<HTMLElement>(
        '.update-components-actor__title'
      );
      name = fallback?.textContent?.replace(/Verified|•.*$/g, '').trim() || 'Unknown';
    }

    // --- Profile link & username ---
    const profileLink = postElement.querySelector<HTMLAnchorElement>(
      '.update-components-actor__meta-link'
    );
    let profileUrl = '';
    let username: string | undefined;

    if (profileLink?.href) {
      profileUrl = profileLink.href;
      const match = profileUrl.match(/linkedin\.com\/in\/([^/?]+)/);
      if (match) {
        username = match[1];
      }
    }

    // --- Avatar ---
    const avatarImg = postElement.querySelector<HTMLImageElement>(
      '.update-components-actor__avatar-image'
    );
    const avatarUrl = avatarImg?.src;

    // --- Verified (LinkedIn Premium / blue badge) ---
    const verified = !!postElement.querySelector(
      'svg[data-test-icon="verified-small"], .text-view-model__verified-icon'
    );

    return {
      id: username || this.hashString(name),
      name,
      username,
      profileUrl,
      avatarUrl,
      verified,
    };
  }

  getPermalink(postElement: HTMLElement): string {
    // data-urn is on the card itself: urn:li:activity:XXXXX
    const urn =
      postElement.getAttribute('data-urn') ||
      postElement.closest('[data-urn]')?.getAttribute('data-urn') ||
      postElement.closest('[data-id]')?.getAttribute('data-id');

    if (urn) {
      return `https://www.linkedin.com/feed/update/${urn}`;
    }

    const shareLink = postElement.querySelector<HTMLAnchorElement>(
      'a[href*="/feed/update/"]'
    );
    if (shareLink?.href) {
      return shareLink.href;
    }

    return window.location.href;
  }

  findButtonInjectionPoint(postElement: HTMLElement): HTMLElement | null {
    // The social action bar (Like, Comment, Repost, Send row)
    const actionBar = postElement.querySelector<HTMLElement>(
      '.feed-shared-social-action-bar'
    );
    if (actionBar) return actionBar;

    // Fallback: the social activity wrapper
    const socialActivity = postElement.querySelector<HTMLElement>(
      '.update-v2-social-activity'
    );
    if (socialActivity) return socialActivity;

    return postElement;
  }

  // ------------------------------------------------------------------
  // Media extraction — handle both inline images and article previews
  // ------------------------------------------------------------------

  extractMedia(postElement: HTMLElement): MediaItem[] {
    const media: MediaItem[] = [];

    // 1. Inline post images
    const images = postElement.querySelectorAll<HTMLImageElement>(
      '.update-components-image img'
    );
    images.forEach((img) => {
      const url = this.getBestImageUrl(img);
      if (url && !media.some((m) => m.url === url)) {
        media.push({
          type: 'image',
          url,
          alt: img.alt || undefined,
          width: img.naturalWidth || img.width || undefined,
          height: img.naturalHeight || img.height || undefined,
        });
      }
    });

    // 2. Article / link preview images
    const articleImages = postElement.querySelectorAll<HTMLImageElement>(
      '.update-components-article img'
    );
    articleImages.forEach((img) => {
      const url = this.getBestImageUrl(img);
      if (url && !media.some((m) => m.url === url)) {
        media.push({ type: 'image', url, alt: img.alt || undefined });
      }
    });

    // 3. Videos
    const videos = postElement.querySelectorAll<HTMLVideoElement>('video');
    videos.forEach((video) => {
      const url = video.src || video.querySelector('source')?.src;
      if (url && !media.some((m) => m.url === url)) {
        media.push({
          type: 'video',
          url,
          thumbnailUrl: video.poster || undefined,
          width: video.videoWidth || undefined,
          height: video.videoHeight || undefined,
          duration: video.duration || undefined,
        });
      }
    });

    return media;
  }

  // ------------------------------------------------------------------
  // Engagement — LinkedIn's DOM is different from most platforms
  // ------------------------------------------------------------------

  extractMetadata(postElement: HTMLElement): PostMetadata {
    const timestamp = this.extractTimestamp(postElement);
    const hashtags = this.extractHashtags(postElement);
    const mentions = this.extractMentions(postElement);

    // --- Reactions (likes + other reaction types combined) ---
    const reactionsEl = postElement.querySelector(
      '.social-details-social-counts__social-proof-fallback-number'
    );
    let reactions = this.parseCount(reactionsEl?.textContent);

    // Also try the aria-label on the reactions button for a number
    if (reactions === undefined) {
      const reactionsBtn = postElement.querySelector(
        '.social-details-social-counts__reactions button[aria-label]'
      );
      reactions = this.parseCount(reactionsBtn?.getAttribute('aria-label'));
    }

    // --- Comments ---
    const commentsEl = postElement.querySelector(
      '.social-details-social-counts__comments span[aria-hidden="true"]'
    );
    const comments = this.parseCount(commentsEl?.textContent);

    // --- Reposts / shares ---
    const repostItems = postElement.querySelectorAll(
      '.social-details-social-counts__item--right-aligned span[aria-hidden="true"]'
    );
    let shares: number | undefined;
    repostItems.forEach((el) => {
      const text = el.textContent || '';
      if (text.includes('repost')) {
        shares = this.parseCount(text);
      }
    });

    return {
      timestamp,
      engagement: {
        likes: reactions,
        comments,
        shares,
      },
      hashtags,
      mentions,
    };
  }

  // ------------------------------------------------------------------
  // Timestamp
  // ------------------------------------------------------------------

  extractTimestamp(postElement: HTMLElement): Date {
    // The sub-description contains text like "5d •" or "3h •"
    const subDesc = postElement.querySelector<HTMLElement>(
      '.update-components-actor__sub-description span[aria-hidden="true"]'
    );

    if (subDesc) {
      const text = subDesc.textContent?.trim() || '';
      const parsed = this.parseRelativeTime(text);
      if (parsed) return parsed;
    }

    // Fallback: screen-reader text with full date
    const srDesc = postElement.querySelector<HTMLElement>(
      '.update-components-actor__sub-description .visually-hidden'
    );
    if (srDesc) {
      const text = srDesc.textContent?.trim() || '';
      const parsed = this.parseRelativeTime(text);
      if (parsed) return parsed;
    }

    return new Date();
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /**
   * Parse a number from text like "118", "7 comments", "1,234 reactions"
   */
  private parseCount(text: string | null | undefined): number | undefined {
    if (!text) return undefined;
    const match = text.match(/([\d,]+)/);
    if (!match) return undefined;
    return parseInt(match[1].replace(/,/g, ''), 10);
  }

  /**
   * Check if element is a valid LinkedIn post (not an ad or empty card)
   */
  private isValidPost(element: HTMLElement): boolean {
    const hasAuthor = !!element.querySelector(
      '.update-components-actor__title, .update-components-actor__meta-link'
    );

    const hasText = !!element.querySelector(
      '.update-components-text, .feed-shared-update-v2__description'
    );
    const hasMedia = !!element.querySelector(
      '.update-components-image, .update-components-article, video'
    );

    const isAd = element.classList.contains('feed-shared-ad-promo') ||
      !!element.querySelector('.feed-shared-actor__sub-description--is-promoted');

    return hasAuthor && (hasText || hasMedia) && !isAd;
  }

  /**
   * Parse LinkedIn's relative timestamps ("3h", "5d", "2w", "1mo", "5 days ago")
   */
  private parseRelativeTime(text: string): Date | null {
    const now = new Date();

    // Match compact patterns like "3h", "5d", "2w", "1mo", "1yr"
    let match = text.match(/(\d+)\s*(h|d|w|mo|yr|m|s)/i);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      switch (unit) {
        case 's':
          return new Date(now.getTime() - value * 1000);
        case 'm':
          return new Date(now.getTime() - value * 60 * 1000);
        case 'h':
          return new Date(now.getTime() - value * 60 * 60 * 1000);
        case 'd':
          return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
        case 'w':
          return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
        case 'mo':
          return new Date(now.setMonth(now.getMonth() - value));
        case 'yr':
          return new Date(now.setFullYear(now.getFullYear() - value));
      }
    }

    // Match long-form "5 days ago", "3 hours ago", etc.
    match = text.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/i);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      switch (unit) {
        case 'second':
          return new Date(now.getTime() - value * 1000);
        case 'minute':
          return new Date(now.getTime() - value * 60 * 1000);
        case 'hour':
          return new Date(now.getTime() - value * 60 * 60 * 1000);
        case 'day':
          return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
        case 'week':
          return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
        case 'month':
          return new Date(now.setMonth(now.getMonth() - value));
        case 'year':
          return new Date(now.setFullYear(now.getFullYear() - value));
      }
    }

    return null;
  }
}

export default LinkedInExtractor;
