import { BaseExtractor } from './base-extractor';
import { FacebookExtractor } from './facebook';
import { TwitterExtractor } from './twitter';
import { LinkedInExtractor } from './linkedin';
import { InstagramExtractor } from './instagram';
import { TikTokExtractor } from './tiktok';
import { RedditExtractor } from './reddit';
import { PinterestExtractor } from './pinterest';
import type { PlatformType } from '@/types';

export { BaseExtractor } from './base-extractor';
export { FacebookExtractor } from './facebook';
export { TwitterExtractor } from './twitter';
export { LinkedInExtractor } from './linkedin';
export { InstagramExtractor } from './instagram';
export { TikTokExtractor } from './tiktok';
export { RedditExtractor } from './reddit';
export { PinterestExtractor } from './pinterest';

/**
 * Detect current platform from URL
 */
export function detectPlatform(): PlatformType | null {
  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('facebook.com')) {
    return 'facebook';
  }
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    return 'twitter';
  }
  if (hostname.includes('linkedin.com')) {
    return 'linkedin';
  }
  if (hostname.includes('instagram.com')) {
    return 'instagram';
  }
  if (hostname.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (hostname.includes('reddit.com')) {
    return 'reddit';
  }
  if (hostname.includes('pinterest.com')) {
    return 'pinterest';
  }

  return null;
}

/**
 * Get extractor for current platform
 */
export function getExtractor(): BaseExtractor | null {
  const platform = detectPlatform();
  if (!platform) return null;

  return getExtractorForPlatform(platform);
}

/**
 * Get extractor for a specific platform
 */
export function getExtractorForPlatform(platform: PlatformType): BaseExtractor | null {
  switch (platform) {
    case 'facebook':
      return new FacebookExtractor();
    case 'twitter':
      return new TwitterExtractor();
    case 'linkedin':
      return new LinkedInExtractor();
    case 'instagram':
      return new InstagramExtractor();
    case 'tiktok':
      return new TikTokExtractor();
    case 'reddit':
      return new RedditExtractor();
    case 'pinterest':
      return new PinterestExtractor();
    case 'custom':
      return null; // Custom content is entered manually, no extractor needed
    default:
      return null;
  }
}

/**
 * Map of all available extractors
 */
export const extractors: Partial<Record<PlatformType, new () => BaseExtractor>> = {
  facebook: FacebookExtractor,
  twitter: TwitterExtractor,
  linkedin: LinkedInExtractor,
  instagram: InstagramExtractor,
  tiktok: TikTokExtractor,
  reddit: RedditExtractor,
  pinterest: PinterestExtractor,
};
