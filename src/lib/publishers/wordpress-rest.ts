import { BasePublisher } from './base-publisher';
import type { ExtractedContent, PublishResult } from '@/types';

export class WordPressRestPublisher extends BasePublisher {
  async publish(content: ExtractedContent): Promise<PublishResult> {
    const url = `${this.baseUrl()}/wp-json/wp/v2/posts`;
    const { config } = this.destination;

    const body: Record<string, unknown> = {
      title: this.getTitle(content),
      content: this.getHtmlContent(content),
      status: 'publish',
    };

    if (config.category) body.categories = [config.category];
    if (config.tags?.length) body.tags = config.tags;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { success: false, error: `WordPress API ${res.status}: ${await res.text()}` };
    }

    const data = await res.json();
    return {
      success: true,
      remoteId: String(data.id),
      publishedUrl: data.link,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl()}/wp-json/`, {
        headers: this.getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
