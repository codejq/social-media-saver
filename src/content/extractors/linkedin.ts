import { BaseExtractor } from './base-extractor';
import type { PlatformType, AuthorInfo } from '@/types';

/**
 * LinkedIn content extractor
 */
export class LinkedInExtractor extends BaseExtractor {
  get platformName(): PlatformType {
    return 'linkedin';
  }

  get selectors(): Record<string, string> {
    return {
      // Post container
      post: '.feed-shared-update-v2, .occludable-update',
      postText: '.feed-shared-text, .feed-shared-update-v2__description',

      // Author info
      author: '.feed-shared-actor__name, .update-components-actor__name',
      authorLink: '.feed-shared-actor__container-link, .update-components-actor__meta-link',
      authorAvatar: '.feed-shared-actor__avatar img, .update-components-actor__avatar img',
      authorHeadline: '.feed-shared-actor__description, .update-components-actor__description',

      // Timestamp
      timestamp: '.feed-shared-actor__sub-description time, .update-components-actor__sub-description time',

      // Media
      image: '.feed-shared-image img, .update-components-image img',
      video: 'video, .feed-shared-linkedin-video video',

      // Engagement
      likes: '.social-details-social-counts__reactions-count, .social-details-social-counts__item--with-social-proof',
      comments: '.social-details-social-counts__comments',
      shares: '.social-details-social-counts__item--right-aligned',

      // Permalink (menu button)
      permalinkMenu: '.feed-shared-control-menu__trigger, .update-components-control-menu',

      // Action buttons
      actionButtons: '.feed-shared-social-actions, .social-actions-button',
    };
  }

  detectPosts(): HTMLElement[] {
    const posts: HTMLElement[] = [];

    // LinkedIn uses multiple post container classes
    const selectors = [
      '.feed-shared-update-v2',
      '.occludable-update',
      '[data-urn^="urn:li:activity"]',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      elements.forEach((el) => {
        if (!posts.includes(el) && this.isValidPost(el)) {
          posts.push(el);
        }
      });
    }

    return posts;
  }

  extractAuthor(postElement: HTMLElement): AuthorInfo {
    // Get name
    const nameElement = postElement.querySelector('.feed-shared-actor__name, .update-components-actor__name');
    let name = nameElement?.textContent?.trim() || 'Unknown';
    // Remove "View X's profile" text if present
    name = name.replace(/View.*profile/i, '').trim();

    // Get profile URL
    const profileLink = postElement.querySelector<HTMLAnchorElement>(
      '.feed-shared-actor__container-link, .update-components-actor__meta-link'
    );
    let profileUrl = '';
    let username: string | undefined;

    if (profileLink?.href) {
      profileUrl = profileLink.href;
      // Extract username from URL
      const match = profileUrl.match(/linkedin\.com\/in\/([^/?]+)/);
      if (match) {
        username = match[1];
      }
    }

    // Get avatar
    const avatarImg = postElement.querySelector<HTMLImageElement>(
      '.feed-shared-actor__avatar img, .update-components-actor__avatar img'
    );
    const avatarUrl = avatarImg?.src;

    // Get headline/title
    const headlineElement = postElement.querySelector('.feed-shared-actor__description');
    // const headline = headlineElement?.textContent?.trim();

    // Check for verified (LinkedIn Premium badge)
    const verified = !!postElement.querySelector('[aria-label*="Premium"]');

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
    // LinkedIn posts have URN-based IDs
    const urn = postElement.getAttribute('data-urn') ||
                postElement.closest('[data-urn]')?.getAttribute('data-urn');

    if (urn) {
      // Convert URN to URL
      // urn:li:activity:12345 -> linkedin.com/feed/update/urn:li:activity:12345
      return `https://www.linkedin.com/feed/update/${urn}`;
    }

    // Try to find permalink from share button or menu
    const shareLink = postElement.querySelector<HTMLAnchorElement>('a[href*="/feed/update/"]');
    if (shareLink?.href) {
      return shareLink.href;
    }

    return window.location.href;
  }

  findButtonInjectionPoint(postElement: HTMLElement): HTMLElement | null {
    // Find the action buttons row (Like, Comment, Repost, Send)
    const actionsRow = postElement.querySelector<HTMLElement>(
      '.feed-shared-social-actions, .social-actions-button'
    );

    if (actionsRow) {
      return actionsRow;
    }

    // Fallback to the post footer area
    const footer = postElement.querySelector<HTMLElement>('.feed-shared-footer');
    if (footer) {
      return footer;
    }

    return postElement;
  }

  /**
   * Check if element is a valid LinkedIn post
   */
  private isValidPost(element: HTMLElement): boolean {
    // Must have author info
    const hasAuthor = !!element.querySelector('.feed-shared-actor__name, .update-components-actor__name');

    // Must have content or media
    const hasText = !!element.querySelector('.feed-shared-text, .feed-shared-update-v2__description');
    const hasMedia = !!element.querySelector('.feed-shared-image, video');

    // Should not be a promoted/sponsored mini-card
    const isAd = element.classList.contains('feed-shared-ad-promo');

    return hasAuthor && (hasText || hasMedia) && !isAd;
  }

  /**
   * Override to handle LinkedIn's engagement display
   */
  protected extractNumber(container: HTMLElement, selector?: string): number | undefined {
    if (!selector) return undefined;

    const element = container.querySelector(selector);
    if (!element) return undefined;

    // LinkedIn shows numbers like "1,234 reactions" or just "1,234"
    const text = element.textContent || element.getAttribute('aria-label') || '';
    const match = text.match(/([\d,]+)/);

    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }

    return undefined;
  }

  /**
   * Override timestamp extraction for LinkedIn's format
   */
  extractTimestamp(postElement: HTMLElement): Date {
    const timeElement = postElement.querySelector(this.selectors.timestamp);

    if (timeElement) {
      // LinkedIn uses datetime attribute
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        const date = new Date(datetime);
        if (!isNaN(date.getTime())) return date;
      }

      // Parse relative time like "3h", "2d", "1w"
      const text = timeElement.textContent?.trim() || '';
      const relativeDate = this.parseRelativeTime(text);
      if (relativeDate) return relativeDate;
    }

    return new Date();
  }

  /**
   * Parse LinkedIn's relative timestamps
   */
  private parseRelativeTime(text: string): Date | null {
    const now = new Date();

    // Match patterns like "3h", "2d", "1w", "3mo", "1yr"
    const match = text.match(/(\d+)\s*(h|d|w|mo|yr|m|s)/i);
    if (!match) return null;

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
      default:
        return null;
    }
  }
}

export default LinkedInExtractor;
