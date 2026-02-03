import type { Destination, ExtractedContent, PublishResult } from '@/types';
import { WordPressRestPublisher } from './wordpress-rest';
import { DrupalJsonApiPublisher } from './drupal-jsonapi';
import { WebhookPublisher } from './webhook';
import { MicropubPublisher } from './micropub';

interface PublisherLike {
  publish(content: ExtractedContent): Promise<PublishResult>;
  testConnection(): Promise<boolean>;
}

/**
 * Return the correct publisher for the given destination.
 * Also covers the two local destination types that do not need a remote HTTP call.
 */
export function createPublisher(destination: Destination): PublisherLike {
  switch (destination.type) {
    case 'wordpress-rest':
      return new WordPressRestPublisher(destination);

    case 'drupal-jsonapi':
      return new DrupalJsonApiPublisher(destination);

    case 'webhook':
    case 'custom-rest':
      return new WebhookPublisher(destination);

    case 'micropub':
      return new MicropubPublisher(destination);

    case 'local-indexeddb':
      return { publish: async () => ({ success: true }), testConnection: async () => true };

    case 'local-filesystem':
      return new LocalFileSystemPublisher(destination);

    default:
      throw new Error(`Unsupported destination type: ${(destination as Destination).type}`);
  }
}

/**
 * Saves extracted content as an HTML file via the chrome.downloads API.
 * Works inside an MV3 service worker (no Blob / createObjectURL needed).
 */
class LocalFileSystemPublisher implements PublisherLike {
  private destination: Destination;

  constructor(destination: Destination) {
    this.destination = destination;
  }

  async publish(content: ExtractedContent): Promise<PublishResult> {
    const title = (content.content?.text || '').split('\n')[0]?.trim().slice(0, 60) ||
      `${content.author?.name || 'unknown'}-${content.platform}`;
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '-');
    const filename = `${safeTitle}.html`;

    const html = [
      '<!DOCTYPE html>',
      '<html><head><meta charset="utf-8">',
      `<title>${escapeHtml(title)}</title>`,
      '</head><body>',
      `<h1>${escapeHtml(title)}</h1>`,
      content.url ? `<p>Source: <a href="${escapeHtml(content.url)}">${escapeHtml(content.url)}</a></p>` : '',
      `<p>Platform: ${escapeHtml(content.platform)}${content.author?.name ? ' | Author: ' + escapeHtml(content.author.name) : ''}</p>`,
      '<hr>',
      content.content?.html || content.content?.text || content.content?.markdown || '',
      '</body></html>',
    ].join('\n');

    // data: URLs work with chrome.downloads inside service workers
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: false,
    });

    return { success: true, metadata: { downloadId } };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
