import { BaseExtractor } from './base-extractor';
import type { PlatformType, AuthorInfo, PostMetadata, ContentFormats } from '@/types';
import DOMPurify from 'dompurify';

/**
 * Reddit content extractor
 *
 * Reddit's new (sh)reddit design uses custom `<shreddit-post>` elements with
 * handy attributes: author, permalink, score, comment-count, etc.
 * The old design (old.reddit.com) uses `.thing` wrappers — this extractor
 * handles both.
 */
export class RedditExtractor extends BaseExtractor {
  get platformName(): PlatformType {
    return 'reddit';
  }

  get selectors(): Record<string, string> {
    return {
      // New Reddit custom element  –OR–  old Reddit .thing container
      post: 'shreddit-post, .thing.link',
      postText: '[slot="text-body"], .md, [data-click-id="text"]',

      // Author (old Reddit fallback)
      author: '[data-testid="post_author_link"], .author',

      // Timestamp
      timestamp: 'time, .live-timestamp',

      // Media
      image: '[slot="full-bleed-media"] img, .preview img, [data-click-id="media"] img',
      video: 'shreddit-player video, video',

      // Engagement (old Reddit fallback)
      likes: '.score, [data-click-id="score"]',
      comments: '[slot="commentCount"], .comments',

      // Permalink
      permalink: 'a[slot="full-post-link"], a.comments, a[data-click-id="comments"]',

      // Action buttons row
      actionButtons: 'shreddit-post-action-row, .flat-list',
    };
  }

  detectPosts(): HTMLElement[] {
    // Strategy 1: New Reddit (shreddit custom elements)
    let posts = Array.from(
      document.querySelectorAll<HTMLElement>('shreddit-post')
    );

    // Strategy 2: Old Reddit (.thing.link)
    if (posts.length === 0) {
      posts = Array.from(
        document.querySelectorAll<HTMLElement>('.thing.link')
      );
    }

    return posts.filter((p) => this.isValidPost(p));
  }

  extractAuthor(postElement: HTMLElement): AuthorInfo {
    // New Reddit: author attribute on <shreddit-post>
    const authorAttr = postElement.getAttribute('author') || '';

    if (authorAttr) {
      return {
        id: authorAttr,
        name: authorAttr,
        username: authorAttr,
        profileUrl: `https://www.reddit.com/user/${authorAttr}`,
        avatarUrl: undefined,
        verified: false,
      };
    }

    // Old Reddit: .author element
    const authorEl = postElement.querySelector<HTMLAnchorElement>('.author');
    const name = authorEl?.textContent?.trim() || 'Unknown';
    return {
      id: name,
      name,
      username: name,
      profileUrl: authorEl?.href || '',
      avatarUrl: undefined,
      verified: false,
    };
  }

  getPermalink(postElement: HTMLElement): string {
    // New Reddit: permalink attribute
    const permalink = postElement.getAttribute('permalink') || postElement.getAttribute('content-href');
    if (permalink) {
      return permalink.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`;
    }

    // Old Reddit: the .comments link
    const commentsLink = postElement.querySelector<HTMLAnchorElement>('a.comments, a.bylink');
    if (commentsLink?.href) return commentsLink.href;

    return window.location.href;
  }

  findButtonInjectionPoint(postElement: HTMLElement): HTMLElement | null {
    // New Reddit: the action row (share, save, report, …)
    const actionRow = postElement.querySelector<HTMLElement>('shreddit-post-action-row, [slot="action-row"]');
    if (actionRow) return actionRow;

    // Shadow DOM: action row may be in shadow root
    const shadow = postElement.shadowRoot;
    if (shadow) {
      const shadowRow = shadow.querySelector<HTMLElement>('[class*="action"]');
      if (shadowRow) return shadowRow;
    }

    // Old Reddit: flat-list (save / hide / report row)
    const flatList = postElement.querySelector<HTMLElement>('.flat-list');
    if (flatList) return flatList;

    return postElement;
  }

  /**
   * Override text extraction — Reddit posts have a title AND an optional body.
   * We combine them so nothing is lost.
   */
  extractTextContent(postElement: HTMLElement): ContentFormats {
    // Post title (new Reddit attribute or <a.title> in old Reddit)
    const title = postElement.getAttribute('post-title')
      || postElement.querySelector('[slot="title"]')?.textContent?.trim()
      || postElement.querySelector<HTMLAnchorElement>('a.title')?.textContent?.trim()
      || '';

    // Post body (self-text)
    const bodyEl = postElement.querySelector(
      '[slot="text-body"], .md, [data-click-id="text"]'
    );
    const bodyHtml = bodyEl ? DOMPurify.sanitize(bodyEl.innerHTML, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
      ALLOWED_ATTR: ['href'],
    }) : '';
    const bodyText = bodyEl?.textContent?.trim() || '';

    const fullText = title ? (bodyText ? `${title}\n\n${bodyText}` : title) : bodyText;
    const fullHtml = title
      ? `<h2>${DOMPurify.sanitize(title)}</h2>${bodyHtml}`
      : bodyHtml;
    const markdown = title
      ? `## ${title}\n\n${this.turndown.turndown(bodyHtml)}`
      : this.turndown.turndown(bodyHtml);

    return { text: fullText, html: fullHtml, markdown };
  }

  extractMetadata(postElement: HTMLElement): PostMetadata {
    const metadata = super.extractMetadata(postElement);

    // New Reddit: attributes carry engagement data directly
    const scoreAttr = postElement.getAttribute('score');
    if (scoreAttr) {
      metadata.engagement.likes = parseInt(scoreAttr, 10) || undefined;
    }

    const commentCountAttr = postElement.getAttribute('comment-count');
    if (commentCountAttr) {
      metadata.engagement.comments = parseInt(commentCountAttr, 10) || undefined;
    }

    // Subreddit as a pseudo-hashtag
    const subreddit = postElement.getAttribute('subreddit-prefixed-name')
      || postElement.querySelector('[data-click-id="subreddit"]')?.textContent?.trim();
    if (subreddit) {
      metadata.hashtags = [...metadata.hashtags, subreddit.replace(/^r\//, '')];
    }

    // Flair
    const flair = postElement.querySelector('[slot="post-flair"], .linkflairlabel');
    if (flair?.textContent?.trim()) {
      metadata.hashtags = [...metadata.hashtags, flair.textContent.trim()];
    }

    return metadata;
  }

  // ==================== Helpers ====================

  private isValidPost(el: HTMLElement): boolean {
    // Reject promoted / ad posts
    if (el.getAttribute('is-promoted') === 'true') return false;
    const promoted = el.querySelector('[slot="promoted-badge"], .promoted-tag');
    if (promoted) return false;

    // Must have a title or some text content
    const hasTitle = !!el.getAttribute('post-title')
      || !!el.querySelector('[slot="title"], a.title');
    return hasTitle;
  }
}

export default RedditExtractor;
