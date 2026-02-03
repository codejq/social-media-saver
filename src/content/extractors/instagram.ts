import { BaseExtractor } from './base-extractor';
import type { PlatformType, AuthorInfo, MediaItem } from '@/types';

/**
 * Instagram content extractor
 */
export class InstagramExtractor extends BaseExtractor {
  get platformName(): PlatformType {
    return 'instagram';
  }

  get selectors(): Record<string, string> {
    return {
      // Post container
      post: 'article, [role="presentation"] > div',
      postText: 'h1 + span, div[role="button"] > span',

      // Author info
      author: 'header a, article header a',
      authorLink: 'header a[href^="/"]',
      authorAvatar: 'header img[alt$="profile picture"]',

      // Timestamp
      timestamp: 'time',

      // Media
      image: 'article img[srcset], article img[src*="fbcdn"]',
      video: 'article video',

      // Engagement
      likes: 'a[href$="/liked_by/"] span, section span[class]',
      comments: 'a[href$="/comments/"]',

      // Permalink
      permalink: 'a[href*="/p/"], a[href*="/reel/"]',

      // Action buttons
      actionButtons: 'section[class] > span',
    };
  }

  detectPosts(): HTMLElement[] {
    const posts: HTMLElement[] = [];

    // Instagram feed posts
    const articles = document.querySelectorAll<HTMLElement>('article');
    articles.forEach((article) => {
      if (this.isValidPost(article)) {
        posts.push(article);
      }
    });

    // Single post view
    const singlePost = document.querySelector<HTMLElement>('[role="presentation"] > div > article');
    if (singlePost && !posts.includes(singlePost)) {
      posts.push(singlePost);
    }

    return posts;
  }

  extractAuthor(postElement: HTMLElement): AuthorInfo {
    // Find header which contains author info
    const header = postElement.querySelector('header');

    // Get username from link
    const usernameLink = header?.querySelector<HTMLAnchorElement>('a[href^="/"]');
    const username = usernameLink?.getAttribute('href')?.replace(/\//g, '') || '';

    // Get display name (often same as username on Instagram)
    const nameElement = header?.querySelector('span');
    const name = nameElement?.textContent?.trim() || username || 'Unknown';

    // Profile URL
    const profileUrl = username ? `https://www.instagram.com/${username}/` : '';

    // Avatar
    const avatarImg = header?.querySelector<HTMLImageElement>('img');
    const avatarUrl = avatarImg?.src;

    // Verified badge
    const verified = !!header?.querySelector('[aria-label="Verified"]');

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
    // Try to find post link
    const postLink = postElement.querySelector<HTMLAnchorElement>('a[href*="/p/"], a[href*="/reel/"]');
    if (postLink?.href) {
      return postLink.href;
    }

    // Try time element which often links to post
    const timeLink = postElement.querySelector<HTMLAnchorElement>('time')?.closest('a');
    if (timeLink?.href) {
      return timeLink.href;
    }

    // Check URL if on single post page
    if (window.location.pathname.includes('/p/') || window.location.pathname.includes('/reel/')) {
      return window.location.href;
    }

    return window.location.href;
  }

  findButtonInjectionPoint(postElement: HTMLElement): HTMLElement | null {
    // Find the action section (like, comment, share, save buttons)
    const actionSection = postElement.querySelector<HTMLElement>('section');
    if (actionSection) {
      return actionSection;
    }

    return postElement;
  }

  /**
   * Override media extraction for Instagram's carousel posts
   */
  extractMedia(postElement: HTMLElement): MediaItem[] {
    const media: MediaItem[] = [];

    // Handle carousel posts
    const carouselItems = postElement.querySelectorAll<HTMLElement>('ul li[class]');

    if (carouselItems.length > 0) {
      carouselItems.forEach((item) => {
        // Images in carousel
        const img = item.querySelector<HTMLImageElement>('img[srcset], img[src*="fbcdn"]');
        if (img) {
          const url = this.getBestImageUrl(img);
          if (url && !media.some((m) => m.url === url)) {
            media.push({
              type: 'image',
              url,
              alt: img.alt,
            });
          }
        }

        // Videos in carousel
        const video = item.querySelector<HTMLVideoElement>('video');
        if (video?.src) {
          if (!media.some((m) => m.url === video.src)) {
            media.push({
              type: 'video',
              url: video.src,
              thumbnailUrl: video.poster,
            });
          }
        }
      });
    } else {
      // Single image/video post
      const img = postElement.querySelector<HTMLImageElement>('article img[srcset], img[src*="fbcdn"]');
      if (img) {
        const url = this.getBestImageUrl(img);
        if (url) {
          media.push({
            type: 'image',
            url,
            alt: img.alt,
          });
        }
      }

      const video = postElement.querySelector<HTMLVideoElement>('video');
      if (video?.src) {
        media.push({
          type: 'video',
          url: video.src,
          thumbnailUrl: video.poster,
        });
      }
    }

    return media;
  }

  /**
   * Check if element is a valid Instagram post
   */
  private isValidPost(element: HTMLElement): boolean {
    // Must have header with author
    const hasHeader = !!element.querySelector('header');

    // Must have media or caption
    const hasMedia = !!element.querySelector('img[srcset], video');
    const hasCaption = !!element.querySelector('h1 + span, span[class]');

    // Should not be a story indicator
    const isStory = element.closest('[role="menu"]') !== null;

    return hasHeader && (hasMedia || hasCaption) && !isStory;
  }

  /**
   * Override engagement extraction for Instagram's format
   */
  protected extractNumber(container: HTMLElement, selector?: string): number | undefined {
    if (!selector) return undefined;

    const element = container.querySelector(selector);
    if (!element) return undefined;

    // Instagram often shows "1,234 likes" or just the number
    const text = element.textContent || '';

    // Handle "Liked by X and Y others" format
    if (text.includes('others')) {
      const match = text.match(/([\d,]+)\s*others/);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''), 10) + 1;
      }
    }

    // Standard number extraction
    const match = text.match(/([\d,]+)/);
    if (match) {
      return parseInt(match[1].replace(/,/g, ''), 10);
    }

    return undefined;
  }

  /**
   * Override to get best image from Instagram's srcset
   */
  protected getBestImageUrl(img: HTMLImageElement): string {
    const srcset = img.srcset;
    if (srcset) {
      // Instagram srcset format: "url1 150w, url2 240w, url3 320w..."
      const sources = srcset.split(',').map((s) => {
        const parts = s.trim().split(' ');
        const url = parts[0];
        const width = parseInt(parts[1]?.replace('w', '') || '0', 10);
        return { url, width };
      });

      // Get highest resolution
      sources.sort((a, b) => b.width - a.width);
      if (sources[0]?.url) {
        return sources[0].url;
      }
    }

    return img.src;
  }
}

export default InstagramExtractor;
