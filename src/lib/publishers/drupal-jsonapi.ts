import { BasePublisher } from './base-publisher';
import type { ExtractedContent, PublishResult } from '@/types';

export class DrupalJsonApiPublisher extends BasePublisher {
  async publish(content: ExtractedContent): Promise<PublishResult> {
    const postType = this.destination.config.postType || 'article';
    const url = `${this.baseUrl()}/jsonapi/node/${postType}`;

    const body = {
      data: {
        type: `node--${postType}`,
        attributes: {
          title: this.getTitle(content),
          body: {
            value: this.getHtmlContent(content),
            format: 'full_html',
          },
        },
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return { success: false, error: `Drupal JSON:API ${res.status}: ${await res.text()}` };
    }

    const data = await res.json();
    return {
      success: true,
      remoteId: data.data?.id,
      publishedUrl: data.data?.links?.self?.href,
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl()}/jsonapi`, {
        headers: this.getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
