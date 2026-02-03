import type { Destination, ExtractedContent } from '@/types';
import type { PublishResult } from '@/types';

/**
 * Shared helpers for all remote publishers.
 */
export abstract class BasePublisher {
  protected destination: Destination;

  constructor(destination: Destination) {
    this.destination = destination;
  }

  abstract publish(content: ExtractedContent): Promise<PublishResult>;
  abstract testConnection(): Promise<boolean>;

  /** Build Authorization / API-key headers from the destination config. */
  protected getAuthHeaders(): Record<string, string> {
    const { authType, token, username, password, apiKey, apiKeyHeader, customHeaders } =
      this.destination.config;
    const headers: Record<string, string> = {};

    switch (authType) {
      case 'bearer':
        if (token) headers['Authorization'] = `Bearer ${token}`;
        break;
      case 'basic':
        if (username && password)
          headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`;
        break;
      case 'api-key':
        if (apiKey) headers[apiKeyHeader || 'X-API-Key'] = apiKey;
        break;
    }

    if (customHeaders) Object.assign(headers, customHeaders);
    return headers;
  }

  /** Derive a short title from the post text or fall back to author + platform. */
  protected getTitle(content: ExtractedContent): string {
    const firstLine = (content.content?.text || '').split('\n')[0]?.trim();
    if (firstLine && firstLine.length > 0 && firstLine.length <= 200) return firstLine;
    return `${content.author?.name || 'Unknown'} on ${content.platform}`;
  }

  /** Best available HTML representation of the post body. */
  protected getHtmlContent(content: ExtractedContent): string {
    return content.content?.html || content.content?.text || content.content?.markdown || '';
  }

  /** Strip trailing slashes from the site URL. */
  protected baseUrl(): string {
    return (this.destination.config.siteUrl || '').replace(/\/+$/, '');
  }
}
