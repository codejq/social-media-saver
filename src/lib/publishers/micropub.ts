import { BasePublisher } from './base-publisher';
import type { ExtractedContent, PublishResult } from '@/types';

export class MicropubPublisher extends BasePublisher {
  async publish(content: ExtractedContent): Promise<PublishResult> {
    const endpoint = this.destination.config.endpoint || '/micropub';
    const url = `${this.baseUrl()}${endpoint}`;

    const params = new URLSearchParams();
    params.append('h', 'entry');
    params.append('content[html]', this.getHtmlContent(content));
    if (content.url) params.append('url', content.url);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...this.getAuthHeaders(),
      },
      body: params.toString(),
    });

    if (!res.ok) {
      return { success: false, error: `Micropub ${res.status}: ${await res.text()}` };
    }

    return {
      success: true,
      publishedUrl: res.headers.get('Location') || undefined,
    };
  }

  async testConnection(): Promise<boolean> {
    const endpoint = this.destination.config.endpoint || '/micropub';
    const url = `${this.baseUrl()}${endpoint}`;
    try {
      // A valid Micropub endpoint returns 200 or 401 on GET; 5xx means unreachable
      const res = await fetch(url, { headers: this.getAuthHeaders() });
      return res.status < 500;
    } catch {
      return false;
    }
  }
}
