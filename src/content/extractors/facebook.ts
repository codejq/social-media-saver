import { BaseExtractor } from './base-extractor';
import type { PlatformType, AuthorInfo, MediaItem, ContentFormats } from '@/types';
import DOMPurify from 'dompurify';

/**
 * Facebook content extractor
 * Note: Facebook frequently changes their DOM structure, so selectors may need updates
 */
export class FacebookExtractor extends BaseExtractor {
  get platformName(): PlatformType {
    return 'facebook';
  }

  get selectors(): Record<string, string> {
    return {
      // Post containers - multiple fallback selectors
      post: '[role="article"], [data-pagelet^="FeedUnit"], [data-pagelet*="FeedUnit"]',
      postText: '[data-ad-preview="message"], [data-ad-comet-preview="message"], [dir="auto"]',

      // Author info
      author: 'h4 a[href], strong > a[href], a[role="link"] strong, span[dir="auto"] a strong',
      authorLink: 'h4 a[href], a[role="link"][tabindex="0"], a[href*="facebook.com/"][role="link"]',
      authorAvatar: 'svg image, img[alt]',

      // Timestamp
      timestamp: 'abbr[data-utime], a[href*="/posts/"] span, time, a[role="link"] span[id]',

      // Media
      image: 'img[src*="fbcdn"], img[data-visualcompletion="media-vc-image"]',
      video: 'video, [data-video-id] video',

      // Engagement
      likes: '[aria-label*="reaction"], [aria-label*="like"], [aria-label*="Like"]',
      comments: '[aria-label*="comment"], [aria-label*="Comment"]',
      shares: '[aria-label*="share"], [aria-label*="Share"]',

      // Permalink
      permalink: 'a[href*="/posts/"], a[href*="/photo"], a[href*="/video"], a[href*="/permalink/"]',

      // Action buttons area (Like, Comment, Share row)
      actionButtons: '[role="button"][tabindex="0"]',
    };
  }

  detectPosts(): HTMLElement[] {
    const posts: HTMLElement[] = [];
    const seen = new Set<HTMLElement>();

    // Strategy 0: Find posts via the "Actions for this post" 3-dot menu.
    // On profile timelines Facebook wraps comments (not posts) in role="article",
    // so the menu button is the most reliable post anchor.
    const postMenus = document.querySelectorAll<HTMLElement>('[aria-label="Actions for this post"]');
    if (postMenus.length > 0) {
      console.log(`[FacebookExtractor] Found ${postMenus.length} "Actions for this post" menus`);
      postMenus.forEach((menu) => {
        // Walk up to the smallest ancestor that contains exactly this one menu
        let cur: HTMLElement | null = menu.parentElement;
        while (cur) {
          const count = cur.querySelectorAll('[aria-label="Actions for this post"]').length;
          if (count === 1) {
            // Basic validation: must have post text and a Like button
            const hasDirAuto = cur.querySelector('[dir="auto"]') !== null;
            const hasLike = cur.querySelector('[aria-label="Like"]') !== null;
            if (hasDirAuto && hasLike && !seen.has(cur)) {
              posts.push(cur);
              seen.add(cur);
            }
            break;
          }
          cur = cur.parentElement;
        }
      });
      if (posts.length > 0) {
        console.log(`[FacebookExtractor] Found ${posts.length} posts via "Actions for this post"`);
        return posts;
      }
    }

    // Strategy 1: Find posts via role="article" (works on some Facebook pages)
    const articles = document.querySelectorAll<HTMLElement>('[role="article"]');
    console.log(`[FacebookExtractor] Found ${articles.length} elements with role="article"`);

    articles.forEach((el) => {
      // Skip loading placeholders
      if (el.querySelector('[data-visualcompletion="loading-state"]')) {
        console.log('[FacebookExtractor] Skipping loading placeholder');
        return;
      }
      if (this.isValidPost(el) && !seen.has(el)) {
        posts.push(el);
        seen.add(el);
      }
    });

    // Strategy 2: Find posts by locating Like buttons and traversing up
    if (posts.length === 0) {
      console.log('[FacebookExtractor] Trying to find posts via Like buttons...');
      const likeButtons = document.querySelectorAll<HTMLElement>('[aria-label="Like"]');
      console.log(`[FacebookExtractor] Found ${likeButtons.length} Like buttons`);

      likeButtons.forEach((likeBtn) => {
        // Traverse up the DOM to find the post container
        // The post container is typically 8-15 levels up from the Like button
        let current = likeBtn.parentElement;
        let levelsUp = 0;
        const maxLevels = 20;

        while (current && levelsUp < maxLevels) {
          // Check if this looks like a post container
          if (this.isValidPost(current as HTMLElement) && !seen.has(current as HTMLElement)) {
            posts.push(current as HTMLElement);
            seen.add(current as HTMLElement);
            console.log(`[FacebookExtractor] Found post container ${levelsUp} levels up from Like button`);
            break;
          }
          current = current.parentElement;
          levelsUp++;
        }
      });
    }

    // Strategy 3: Fallback - FeedUnit pagelets
    if (posts.length === 0) {
      const feedUnits = document.querySelectorAll<HTMLElement>('[data-pagelet*="FeedUnit"]');
      console.log(`[FacebookExtractor] Found ${feedUnits.length} FeedUnit elements`);
      feedUnits.forEach((el) => {
        if (this.isValidPost(el) && !seen.has(el)) {
          posts.push(el);
          seen.add(el);
        }
      });
    }

    // Log final result
    console.log(`[FacebookExtractor] Total valid posts found: ${posts.length}`);

    if (posts.length === 0) {
      console.log('[FacebookExtractor] No posts found. Current page URL:', window.location.href);
      console.log('[FacebookExtractor] Debug info:');
      console.log(`  - Total Like buttons: ${document.querySelectorAll('[aria-label="Like"]').length}`);
      console.log(`  - Total role="article": ${document.querySelectorAll('[role="article"]').length}`);
      console.log(`  - Total FeedUnits: ${document.querySelectorAll('[data-pagelet*="FeedUnit"]').length}`);
    }

    return posts;
  }

  extractAuthor(postElement: HTMLElement): AuthorInfo {
    // Try multiple selectors for author name
    const authorSelectors = [
      'h4 a[href]',
      'strong a[href]',
      'a[role="link"] strong',
      'span[dir="auto"] a[role="link"]',
      'a[href*="/user/"]',
      'a[href*="/profile.php"]',
    ];

    let name = 'Unknown';
    let profileUrl = '';

    for (const selector of authorSelectors) {
      const authorEl = postElement.querySelector<HTMLAnchorElement>(selector);
      if (authorEl) {
        name = authorEl.textContent?.trim() || name;
        profileUrl = authorEl.href || '';
        if (name !== 'Unknown' && name.length > 0) break;
      }
    }

    // Clean tracking params from URL
    if (profileUrl) {
      try {
        const url = new URL(profileUrl);
        url.search = '';
        profileUrl = url.toString();
      } catch {}
    }

    // Extract username from URL
    let username: string | undefined;
    if (profileUrl) {
      const match = profileUrl.match(/facebook\.com\/(?:profile\.php\?id=)?([^/?]+)/);
      if (match) {
        username = match[1];
      }
    }

    // Get avatar
    let avatarUrl: string | undefined;
    const avatarImg = postElement.querySelector<HTMLImageElement>(
      'svg image[href], img[alt*="profile" i], img[src*="fbcdn"][alt]'
    );
    if (avatarImg) {
      avatarUrl = avatarImg.getAttribute('href') || avatarImg.src;
    }

    // Check verified status
    const verified = !!postElement.querySelector('[aria-label*="Verified" i]');

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
    // Try various permalink selectors
    const linkSelectors = [
      'a[href*="/posts/"]',
      'a[href*="/permalink/"]',
      'a[href*="/photos/"]',
      'a[href*="/videos/"]',
      'a[href*="story_fbid"]',
    ];

    for (const selector of linkSelectors) {
      const link = postElement.querySelector<HTMLAnchorElement>(selector);
      if (link?.href) {
        try {
          const url = new URL(link.href);
          return `${url.origin}${url.pathname}`;
        } catch {
          return link.href;
        }
      }
    }

    // Fallback: get from time element's parent link
    const timeEl = postElement.querySelector('abbr, time');
    const timeLink = timeEl?.closest('a');
    if (timeLink?.href) {
      return timeLink.href;
    }

    return window.location.href;
  }

  findButtonInjectionPoint(postElement: HTMLElement): HTMLElement | null {
    // Locate the post-level action button, skipping any inside comment articles.
    let likeBtn: HTMLElement | null = null;

    const allLikes = postElement.querySelectorAll<HTMLElement>('[aria-label="Like"]');
    for (const btn of allLikes) {
      const commentArticle = btn.closest('[role="article"]');
      if (!commentArticle || !commentArticle.getAttribute('aria-label')?.startsWith('Comment by')) {
        likeBtn = btn;
        break;
      }
    }

    // Fallback anchor: the Share button is always at the post level
    if (!likeBtn) {
      likeBtn = postElement.querySelector<HTMLElement>(
        '[aria-label="Send this to friends or post it on your profile."]'
      );
    }

    if (!likeBtn) {
      // Last resort: append a container at the bottom of the post
      const container = document.createElement('div');
      container.className = 'social-saver-container';
      container.style.cssText = 'padding: 8px 16px; border-top: 1px solid #ddd;';
      postElement.appendChild(container);
      return container;
    }

    // --- Timeline layout ---
    // Action buttons live inside a <ul> with <li> items (Like / React / …).
    // Inject into the <ul>'s parent <div> so our button sits beside the list.
    let ancestor: HTMLElement | null = likeBtn.parentElement;
    while (ancestor && ancestor !== postElement) {
      if (ancestor.tagName === 'UL') {
        const parentDiv = ancestor.parentElement as HTMLElement | null;
        if (parentDiv && parentDiv !== postElement) {
          console.log('[FacebookExtractor] Timeline: injecting beside UL action row');
          return parentDiv;
        }
      }
      ancestor = ancestor.parentElement;
    }

    // --- Main-feed layout ---
    // Action buttons are children of a flat <div> row.  Walk up from the Like
    // button and return the first <div> that contains 3+ role="button"
    // descendants (Like + Comment + Share).  This skips small wrappers that
    // only contain Like + React (2 buttons) inside a single action cell.
    ancestor = likeBtn.parentElement;
    let levelsUp = 0;
    while (ancestor && levelsUp < 12 && ancestor !== postElement) {
      if (ancestor.tagName === 'DIV') {
        const count = ancestor.querySelectorAll('[role="button"]').length;
        if (count >= 3) {
          console.log('[FacebookExtractor] Feed: injecting into DIV with', count, 'buttons');
          return ancestor;
        }
      }
      ancestor = ancestor.parentElement;
      levelsUp++;
    }

    // --- Fallback: role="group" ---
    const group = postElement.querySelector<HTMLElement>('[role="group"]');
    if (group) return group;

    // --- Last resort: append container at post bottom ---
    const container = document.createElement('div');
    container.className = 'social-saver-container';
    container.style.cssText = 'padding: 8px 16px; border-top: 1px solid #ddd;';
    postElement.appendChild(container);
    return container;
  }

  /**
   * Check if an element is a valid post
   */
  private isValidPost(element: HTMLElement): boolean {
    // Reject comment articles — Facebook wraps individual comments in
    // role="article" with aria-label="Comment by ..."
    const ariaLabel = element.getAttribute('aria-label') || '';
    if (ariaLabel.startsWith('Comment by')) return false;

    // Must have some text content (at least 20 characters)
    const textContent = element.textContent || '';
    if (textContent.length < 20) {
      return false;
    }

    // Should not be inside a story/reel section
    if (element.closest('[aria-label*="Stories" i]') ||
        element.closest('[aria-label*="Reels" i]')) {
      return false;
    }

    // A valid post must have action buttons (Like, Comment, Share)
    const hasLikeButton = element.querySelector('[aria-label="Like"]') !== null;
    if (!hasLikeButton) {
      return false;
    }

    // Should contain either text content or media
    const hasText = element.querySelector('[dir="auto"]') !== null;
    const hasMedia = element.querySelector('img[src*="fbcdn"], video') !== null;
    const hasLinks = element.querySelectorAll('a[href]').length > 0;

    // A valid post should have links and either text or media
    if (!hasLinks) {
      return false;
    }

    if (!hasText && !hasMedia) {
      return false;
    }

    // Check it's not a tiny element (like a tooltip or sidebar item)
    const rect = element.getBoundingClientRect();
    if (rect.width < 300 || rect.height < 100) {
      return false;
    }

    // Check that it's not TOO big (likely the whole feed container)
    // Posts are typically less than 3000px tall
    if (rect.height > 3000) {
      return false;
    }

    return true;
  }

  /**
   * Override to exclude comment text — on timelines, comment articles are
   * nested inside the post container so the base-class "longest dir=auto"
   * picker would otherwise land on a comment body instead of the post text.
   */
  extractTextContent(postElement: HTMLElement): ContentFormats {
    const selector = this.selectors.postText;
    let textElement: Element | null = null;
    let bestLen = 0;

    if (selector) {
      const candidates = postElement.querySelectorAll(selector);
      candidates.forEach((el) => {
        // Skip elements that live inside a nested comment article
        const commentArticle = el.closest('[role="article"]');
        if (commentArticle?.getAttribute('aria-label')?.startsWith('Comment by')) return;
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
   * Override to handle Facebook's special engagement format
   */
  protected extractNumber(container: HTMLElement, selector?: string): number | undefined {
    if (!selector) return undefined;

    const elements = container.querySelectorAll(selector);
    for (const element of elements) {
      // Facebook shows engagement in aria-label like "123 reactions"
      const ariaLabel = element.getAttribute('aria-label') || '';
      const match = ariaLabel.match(/^([\d,]+)/);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''), 10);
      }

      // Fallback to text content
      const text = element.textContent || '';
      const textMatch = text.match(/[\d,]+/);
      if (textMatch) {
        return parseInt(textMatch[0].replace(/,/g, ''), 10);
      }
    }

    return undefined;
  }

  /**
   * Filter out Facebook UI icons / sprites so only real post media survives.
   * On timeline pages the actual post photos are loaded dynamically and are
   * not present as <img> tags inside the article, so the result will often be
   * an empty array — that is correct; the saved-content view will simply show
   * no thumbnail rather than a broken 12-px icon.
   */
  extractMedia(postElement: HTMLElement): MediaItem[] {
    const all = super.extractMedia(postElement);
    return all.filter((item) => {
      const url = item.url;
      // Drop inline data URIs (SVG placeholders)
      if (url.startsWith('data:')) return false;
      // Drop Facebook UI resource sprites
      if (url.includes('static.xx.fbcdn.net/rsrc.php')) return false;
      if (url.includes('static.xx.fbcdn.net/images/emoji')) return false;
      // Drop anything smaller than 50 px in either dimension
      if (item.width && item.height && item.width < 50 && item.height < 50) return false;
      return true;
    });
  }
}

export default FacebookExtractor;
