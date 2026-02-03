import { BaseExtractor } from './base-extractor';
import type { PlatformType, AuthorInfo, PostMetadata } from '@/types';

/**
 * Twitter/X content extractor
 */
export class TwitterExtractor extends BaseExtractor {
  get platformName(): PlatformType {
    return 'twitter';
  }

  get selectors(): Record<string, string> {
    return {
      // Post container
      post: 'article[data-testid="tweet"]',
      postText: '[data-testid="tweetText"]',

      // Author info
      author: '[data-testid="User-Name"] > div:first-child span',
      authorHandle: '[data-testid="User-Name"] a[href^="/"]',
      authorAvatar: '[data-testid="Tweet-User-Avatar"] img',

      // Timestamp
      timestamp: 'time',

      // Media
      image: '[data-testid="tweetPhoto"] img',
      video: '[data-testid="videoPlayer"] video, video',

      // Engagement
      likes: '[data-testid="like"] span, [data-testid="unlike"] span',
      retweets: '[data-testid="retweet"] span, [data-testid="unretweet"] span',
      comments: '[data-testid="reply"] span',

      // Permalink
      permalink: 'a[href*="/status/"]',

      // Action buttons
      actionButtons: '[role="group"]',
    };
  }

  detectPosts(): HTMLElement[] {
    const posts = document.querySelectorAll<HTMLElement>(this.selectors.post);
    return Array.from(posts).filter((post) => this.isValidTweet(post));
  }

  extractAuthor(postElement: HTMLElement): AuthorInfo {
    // Get display name
    const nameElement = postElement.querySelector('[data-testid="User-Name"] > div:first-child span');
    const name = nameElement?.textContent?.trim() || 'Unknown';

    // Get username/handle
    const handleElement = postElement.querySelector<HTMLAnchorElement>('[data-testid="User-Name"] a[href^="/"]');
    let username = '';
    let profileUrl = '';

    if (handleElement) {
      const href = handleElement.getAttribute('href') || '';
      username = href.replace('/', '');
      profileUrl = `https://twitter.com${href}`;
    }

    // Get avatar
    const avatarImg = postElement.querySelector<HTMLImageElement>('[data-testid="Tweet-User-Avatar"] img');
    const avatarUrl = avatarImg?.src;

    // Check verified (blue check)
    const verified = !!postElement.querySelector('[data-testid="icon-verified"]');

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
    // Find the status link
    const statusLink = postElement.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
    if (statusLink?.href) {
      // Ensure it's the tweet link, not a quote tweet
      const href = statusLink.getAttribute('href') || '';
      if (href.includes('/status/')) {
        return `https://twitter.com${href}`;
      }
    }

    // Fallback: get from time element's parent link
    const timeElement = postElement.querySelector('time');
    const timeLink = timeElement?.closest('a');
    if (timeLink?.href) {
      return timeLink.href;
    }

    return window.location.href;
  }

  findButtonInjectionPoint(postElement: HTMLElement): HTMLElement | null {
    // Find the action buttons row (reply, retweet, like, etc.)
    const actionsRow = postElement.querySelector<HTMLElement>('[role="group"]');
    if (actionsRow) {
      return actionsRow;
    }

    return postElement;
  }

  /**
   * Override metadata extraction for Twitter-specific metrics
   */
  extractMetadata(postElement: HTMLElement): PostMetadata {
    const metadata = super.extractMetadata(postElement);

    // Add retweets count
    const retweetsElement = postElement.querySelector('[data-testid="retweet"] span, [data-testid="unretweet"] span');
    if (retweetsElement?.textContent) {
      const count = this.parseCompactNumber(retweetsElement.textContent);
      if (count !== undefined) {
        metadata.engagement.retweets = count;
        metadata.engagement.shares = count;
      }
    }

    // Check if it's a retweet
    const retweetIndicator = postElement.querySelector('[data-testid="socialContext"]');
    if (retweetIndicator?.textContent?.includes('reposted') ||
        retweetIndicator?.textContent?.includes('Retweeted')) {
      metadata.isSponsored = false; // Mark as retweet (not using sponsored field properly)
    }

    // Check for promoted/sponsored
    const promotedLabel = postElement.querySelector('[data-testid="promotedIndicator"]');
    if (promotedLabel) {
      metadata.isSponsored = true;
    }

    return metadata;
  }

  /**
   * Check if element is a valid tweet (not a promotion card, etc.)
   */
  private isValidTweet(element: HTMLElement): boolean {
    // Must have tweet text or media
    const hasText = !!element.querySelector('[data-testid="tweetText"]');
    const hasMedia = !!element.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"]');

    // Check it's not just a "Show more" or similar
    const isShowMore = element.textContent?.includes('Show this thread');

    return (hasText || hasMedia) && !isShowMore;
  }

  /**
   * Parse compact numbers (1.2K, 5.3M, etc.)
   */
  private parseCompactNumber(text: string): number | undefined {
    const cleaned = text.trim();
    if (!cleaned) return undefined;

    const match = cleaned.match(/^([\d.]+)([KMB])?$/i);
    if (!match) return parseInt(cleaned.replace(/,/g, ''), 10) || undefined;

    const num = parseFloat(match[1]);
    const suffix = match[2]?.toUpperCase();

    switch (suffix) {
      case 'K':
        return Math.round(num * 1000);
      case 'M':
        return Math.round(num * 1000000);
      case 'B':
        return Math.round(num * 1000000000);
      default:
        return Math.round(num);
    }
  }

  /**
   * Override engagement extraction for Twitter's compact format
   */
  protected extractNumber(container: HTMLElement, selector?: string): number | undefined {
    if (!selector) return undefined;

    const element = container.querySelector(selector);
    if (!element?.textContent) return undefined;

    return this.parseCompactNumber(element.textContent);
  }
}

export default TwitterExtractor;
