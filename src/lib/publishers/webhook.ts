import { BasePublisher } from './base-publisher';
import type { ExtractedContent, PublishResult } from '@/types';

export class WebhookPublisher extends BasePublisher {
  async publish(content: ExtractedContent): Promise<PublishResult> {
    const endpoint = this.destination.config.endpoint || '';
    const url = `${this.baseUrl()}${endpoint}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(this.buildPayload(content)),
    });

    if (!res.ok) {
      return { success: false, error: `Webhook ${res.status}: ${await res.text()}` };
    }

    let remoteId: string | undefined;
    let publishedUrl: string | undefined;

    const { responseMapping } = this.destination.config;
    if (responseMapping) {
      try {
        const data = await res.json();
        if (responseMapping.idPath) remoteId = this.resolvePath(data, responseMapping.idPath);
        if (responseMapping.urlPath) publishedUrl = this.resolvePath(data, responseMapping.urlPath);
      } catch {
        // response body is not JSON — no id/url to extract
      }
    }

    return { success: true, remoteId, publishedUrl };
  }

  async testConnection(): Promise<boolean> {
    const endpoint = this.destination.config.endpoint || '';
    const url = `${this.baseUrl()}${endpoint}`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      return res.status < 500;
    } catch {
      return false;
    }
  }

  /** Build the POST body, honouring an optional JSON payload template. */
  private buildPayload(content: ExtractedContent): Record<string, string> | Record<string, unknown> {
    const values: Record<string, string> = {
      title: this.getTitle(content),
      content: this.getHtmlContent(content),
      url: content.url || '',
      platform: content.platform,
      author: content.author?.name || '',
      source_url: content.url || '',
    };

    const template = this.destination.config.payloadTemplate;
    if (template) {
      // Replace {{key}} placeholders; JSON-escape each value so the template stays valid JSON
      const filled = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const val = values[key] ?? '';
        return JSON.stringify(val).slice(1, -1); // strip the surrounding quotes added by stringify
      });
      try {
        return JSON.parse(filled);
      } catch {
        // malformed template — fall through to the flat default payload
      }
    }

    return values;
  }

  /** Traverse a dot-separated path on a plain object and return the leaf as a string. */
  private resolvePath(obj: unknown, path: string): string | undefined {
    let current: unknown = obj;
    for (const part of path.split('.')) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current != null ? String(current) : undefined;
  }
}
