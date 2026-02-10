import { BaseExtractor } from './base-extractor';
import type { PlatformType, AuthorInfo, PostMetadata } from '@/types';

/**
 * Pinterest content extractor
 *
 * Pinterest uses `data-test-id="pinWrapper"` for pin containers in their
 * masonry grid.  Each pin has an image, an optional description, the pinner's
 * name, and save/engagement counts.
 */
export class PinterestExtractor extends BaseExtractor {
  get platformName(): PlatformType {
    return 'pinterest';
  }

  get selectors(): Record<string, string> {
    return {
      // Pin containers
      post: '[data-test-id="pinWrapper"], [data-test-id="pin"]',
      postText: '[data-test-id="pin-description"], [data-test-id="truncated-description"], [data-test-id="pinTitle"]',

      // Author
      author: '[data-test-id="pin-creator-name"], [data-test-id="pinner-name"]',
      authorLink: '[data-test-id="pin-creator-link"], a[href*="/pin/"] + a',
      authorAvatar: '[data-test-id="pin-creator-avatar"] img',

      // Timestamp (Pinterest rarely shows timestamps on the grid)
      timestamp: 'time',

      // Media
      image: '[data-test-id="pin-closeup-image"] img, [data-test-id="non-story-pin-image"] img, img[srcset], img[src*="pinimg.com"]',
      video: 'video',

      // Engagement
      likes: '[data-test-id="pin-reaction-count"]',
      comments: '[data-test-id="pin-comment-count"]',
      saves: '[data-test-id="pin-save-count"]',

      // Permalink
      permalink: 'a[href*="/pin/"]',

      // Action buttons
      actionButtons: '[data-test-id="pin-action-bar"], [data-test-id="pin-actions"]',
    };
  }

  detectPosts(): HTMLElement[] {
    // Primary: pinWrapper containers in the masonry grid
    let posts = Array.from(
      document.querySelectorAll<HTMLElement>('[data-test-id="pinWrapper"]')
    );

    // Fallback: individual pin elements
    if (posts.length === 0) {
      posts = Array.from(
        document.querySelectorAll<HTMLElement>('[data-test-id="pin"]')
      );
    }

    // Fallback: closeup / detail view (single pin page)
    if (posts.length === 0) {
      const closeup = document.querySelector<HTMLElement>('[data-test-id="closeup-body"], [data-test-id="pin-closeup"]');
      if (closeup) posts = [closeup];
    }

    return posts.filter((p) => this.isValidPin(p));
  }

  extractAuthor(postElement: HTMLElement): AuthorInfo {
    const nameEl = postElement.querySelector(
      '[data-test-id="pin-creator-name"], [data-test-id="pinner-name"]'
    );
    const name = nameEl?.textContent?.trim() || 'Unknown';

    const linkEl = postElement.querySelector<HTMLAnchorElement>(
      '[data-test-id="pin-creator-link"], [data-test-id="pinner-name"] a, a[href*="/"]'
    );
    let profileUrl = '';
    let username = '';

    if (linkEl?.href) {
      profileUrl = linkEl.href;
      // Extract username from /username/ pattern
      const match = linkEl.getAttribute('href')?.match(/^\/([^/]+)\/?$/);
      if (match) username = match[1];
    }

    const avatarImg = postElement.querySelector<HTMLImageElement>(
      '[data-test-id="pin-creator-avatar"] img'
    );

    return {
      id: username || this.hashString(name),
      name,
      username,
      profileUrl,
      avatarUrl: avatarImg?.src,
      verified: !!postElement.querySelector('[data-test-id="verified-badge"]'),
    };
  }

  getPermalink(postElement: HTMLElement): string {
    // Direct pin link
    const pinLink = postElement.querySelector<HTMLAnchorElement>('a[href*="/pin/"]');
    if (pinLink?.href) return pinLink.href;

    // On the detail page the URL itself is the permalink
    if (window.location.pathname.includes('/pin/')) {
      return window.location.href;
    }

    return window.location.href;
  }

  findButtonInjectionPoint(postElement: HTMLElement): HTMLElement | null {
    // Action bar at the bottom of the pin
    const actionBar = postElement.querySelector<HTMLElement>(
      '[data-test-id="pin-action-bar"], [data-test-id="pin-actions"]'
    );
    if (actionBar) return actionBar;

    // Fallback: look for any button row
    const buttonRow = postElement.querySelector<HTMLElement>('[role="group"]');
    if (buttonRow) return buttonRow;

    return postElement;
  }

  extractMetadata(postElement: HTMLElement): PostMetadata {
    const metadata = super.extractMetadata(postElement);

    // Pinterest save count is a core metric
    const savesEl = postElement.querySelector('[data-test-id="pin-save-count"]');
    if (savesEl?.textContent) {
      metadata.engagement.shares = this.parseCount(savesEl.textContent);
    }

    // Board name as a hashtag
    const boardEl = postElement.querySelector('[data-test-id="board-name"]');
    if (boardEl?.textContent?.trim()) {
      metadata.hashtags = [...metadata.hashtags, boardEl.textContent.trim()];
    }

    return metadata;
  }

  // ==================== Helpers ====================

  private isValidPin(el: HTMLElement): boolean {
    // Must have an image — pins are fundamentally visual
    const hasImage = !!el.querySelector('img[src*="pinimg.com"], img[srcset], [data-test-id="non-story-pin-image"]');
    const hasVideo = !!el.querySelector('video');
    return hasImage || hasVideo;
  }

  private parseCount(text: string): number | undefined {
    const cleaned = text.trim().toLowerCase();
    if (!cleaned) return undefined;
    const match = cleaned.match(/^([\d.]+)\s*([kmb])?$/);
    if (!match) return parseInt(cleaned.replace(/,/g, ''), 10) || undefined;
    const num = parseFloat(match[1]);
    switch (match[2]) {
      case 'k': return Math.round(num * 1000);
      case 'm': return Math.round(num * 1000000);
      case 'b': return Math.round(num * 1000000000);
      default: return Math.round(num);
    }
  }
}

export default PinterestExtractor;
