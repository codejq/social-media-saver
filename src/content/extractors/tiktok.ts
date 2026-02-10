import { BaseExtractor } from './base-extractor';
import type { PlatformType, AuthorInfo, PostMetadata } from '@/types';

/**
 * TikTok content extractor
 *
 * TikTok uses `data-e2e` attributes for test IDs.  The For You / Following
 * feed shows one video at a time; profile pages show a grid of thumbnails.
 * Both cases are handled below.
 */
export class TikTokExtractor extends BaseExtractor {
  get platformName(): PlatformType {
    return 'tiktok';
  }

  get selectors(): Record<string, string> {
    return {
      // Feed video items (FYP / Following)
      post: '[data-e2e="recommend-list-item-container"], [data-e2e="user-post-item-list"] > div',
      postText: '[data-e2e="video-desc"], [data-e2e="browse-video-desc"]',

      // Author
      author: '[data-e2e="video-author-uniqueid"], [data-e2e="browse-username"]',
      authorName: '[data-e2e="video-author-nickname"]',
      authorAvatar: '[data-e2e="video-avatar"] img, [class*="AvatarContainer"] img',

      // Timestamp — TikTok rarely exposes a precise time element on the feed;
      // profile grid items have none.  Fall back to now().
      timestamp: 'time',

      // Media
      image: 'img[class*="ImgPoster"], img[class*="poster"]',
      video: 'video',

      // Engagement
      likes: '[data-e2e="like-count"], [data-e2e="browse-like-count"]',
      comments: '[data-e2e="comment-count"], [data-e2e="browse-comment-count"]',
      shares: '[data-e2e="share-count"], [data-e2e="browse-share-count"]',
      views: '[data-e2e="video-views"]',

      // Permalink
      permalink: 'a[href*="/video/"]',

      // Action buttons row
      actionButtons: '[class*="ActionBar"], [data-e2e="video-action-bar"]',
    };
  }

  detectPosts(): HTMLElement[] {
    // Strategy 1: Feed items (FYP / Following)
    let posts = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-e2e="recommend-list-item-container"]'
      )
    );

    // Strategy 2: Browse / detail view — the single visible video card
    if (posts.length === 0) {
      posts = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-e2e="browse-video"], [class*="DivBrowserModeContainer"]'
        )
      );
    }

    // Strategy 3: Profile page grid items (each is an <a> wrapper)
    if (posts.length === 0) {
      posts = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-e2e="user-post-item"]'
        )
      );
    }

    return posts.filter((p) => this.isValidPost(p));
  }

  extractAuthor(postElement: HTMLElement): AuthorInfo {
    // Unique ID (handle)
    const handleEl = postElement.querySelector(
      '[data-e2e="video-author-uniqueid"], [data-e2e="browse-username"]'
    );
    const username = handleEl?.textContent?.trim().replace(/^@/, '') || '';

    // Display name
    const nameEl = postElement.querySelector('[data-e2e="video-author-nickname"]');
    const name = nameEl?.textContent?.trim() || username || 'Unknown';

    // Avatar
    const avatarImg = postElement.querySelector<HTMLImageElement>(
      '[data-e2e="video-avatar"] img, [class*="AvatarContainer"] img'
    );

    // Profile URL
    const profileUrl = username ? `https://www.tiktok.com/@${username}` : '';

    return {
      id: username || this.hashString(name),
      name,
      username,
      profileUrl,
      avatarUrl: avatarImg?.src,
      verified: !!postElement.querySelector('[data-e2e="verified-badge"], svg[class*="Verified"]'),
    };
  }

  getPermalink(postElement: HTMLElement): string {
    // Look for a direct /video/ link
    const videoLink = postElement.querySelector<HTMLAnchorElement>('a[href*="/video/"]');
    if (videoLink?.href) return videoLink.href;

    // On the detail/browse page the URL itself is the permalink
    if (window.location.pathname.includes('/video/')) {
      return window.location.href;
    }

    // Profile grid items may have a content-href or similar
    const href = postElement.getAttribute('href') || postElement.querySelector<HTMLAnchorElement>('a')?.href;
    if (href?.includes('/video/')) {
      return href.startsWith('http') ? href : `https://www.tiktok.com${href}`;
    }

    return window.location.href;
  }

  findButtonInjectionPoint(postElement: HTMLElement): HTMLElement | null {
    // The action bar (like/comment/share column on the right side of the feed)
    const actionBar = postElement.querySelector<HTMLElement>(
      '[data-e2e="video-action-bar"], [class*="ActionBar"]'
    );
    if (actionBar) return actionBar;

    // Fallback: the description area below the video
    const desc = postElement.querySelector<HTMLElement>(
      '[data-e2e="video-desc"], [data-e2e="browse-video-desc"]'
    );
    if (desc?.parentElement) return desc.parentElement;

    return postElement;
  }

  extractMetadata(postElement: HTMLElement): PostMetadata {
    const metadata = super.extractMetadata(postElement);

    // Views count (TikTok-specific)
    const viewsEl = postElement.querySelector('[data-e2e="video-views"]');
    if (viewsEl?.textContent) {
      metadata.engagement.views = this.parseCompactNumber(viewsEl.textContent);
    }

    return metadata;
  }

  // ==================== Helpers ====================

  private isValidPost(el: HTMLElement): boolean {
    // Must have either a video or an image (poster)
    const hasMedia = !!el.querySelector('video') || !!el.querySelector('img[class*="Poster"], img[class*="poster"]');
    // Reject extremely small containers (ads/banners)
    if (el.offsetHeight < 100 && el.offsetWidth < 100) return false;
    return hasMedia || !!el.querySelector('[data-e2e="video-desc"]');
  }

  private parseCompactNumber(text: string): number | undefined {
    const cleaned = text.trim();
    if (!cleaned) return undefined;

    const match = cleaned.match(/^([\d.]+)\s*([KMB])?$/i);
    if (!match) return parseInt(cleaned.replace(/,/g, ''), 10) || undefined;

    const num = parseFloat(match[1]);
    switch (match[2]?.toUpperCase()) {
      case 'K': return Math.round(num * 1000);
      case 'M': return Math.round(num * 1000000);
      case 'B': return Math.round(num * 1000000000);
      default: return Math.round(num);
    }
  }

  protected extractNumber(container: HTMLElement, selector?: string): number | undefined {
    if (!selector) return undefined;
    const el = container.querySelector(selector);
    if (!el?.textContent) return undefined;
    return this.parseCompactNumber(el.textContent);
  }
}

export default TikTokExtractor;
