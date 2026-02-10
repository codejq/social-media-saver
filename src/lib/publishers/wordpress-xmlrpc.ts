import { BasePublisher } from './base-publisher';
import type { ExtractedContent, PublishResult } from '@/types';

/**
 * WordPress XML-RPC publisher.
 *
 * Uses the wp.newPost method (available since WP 3.4) to create posts.
 * Authenticates with username + password via the XML-RPC payload itself.
 * The XML-RPC endpoint is typically at {siteUrl}/xmlrpc.php.
 */
export class WordPressXmlRpcPublisher extends BasePublisher {
  async publish(content: ExtractedContent): Promise<PublishResult> {
    const endpoint = `${this.baseUrl()}/xmlrpc.php`;
    const { username, password } = this.destination.config;

    if (!username || !password) {
      return { success: false, error: 'WordPress XML-RPC requires username and password' };
    }

    const postContent: Record<string, string> = {
      post_title: this.getTitle(content),
      post_content: this.getHtmlContent(content),
      post_status: 'publish',
      post_type: this.destination.config.postType || 'post',
    };

    const xml = this.buildMethodCall('wp.newPost', [
      xmlValue('int', '0'),                   // blog_id
      xmlValue('string', username),
      xmlValue('string', password),
      xmlStruct(postContent),
    ]);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: xml,
    });

    if (!res.ok) {
      return { success: false, error: `XML-RPC HTTP ${res.status}: ${await res.text()}` };
    }

    const responseXml = await res.text();

    // Check for <fault>
    if (responseXml.includes('<fault>')) {
      const faultMsg = extractXmlText(responseXml, 'string') || 'Unknown XML-RPC fault';
      return { success: false, error: faultMsg };
    }

    const postId = extractXmlText(responseXml, 'string') || extractXmlText(responseXml, 'int');
    return {
      success: true,
      remoteId: postId || undefined,
      publishedUrl: postId ? `${this.baseUrl()}/?p=${postId}` : undefined,
    };
  }

  async testConnection(): Promise<boolean> {
    const endpoint = `${this.baseUrl()}/xmlrpc.php`;
    const { username, password } = this.destination.config;

    if (!username || !password) return false;

    const xml = this.buildMethodCall('wp.getProfile', [
      xmlValue('int', '0'),
      xmlValue('string', username),
      xmlValue('string', password),
    ]);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: xml,
      });
      const text = await res.text();
      return res.ok && !text.includes('<fault>');
    } catch {
      return false;
    }
  }

  // ==================== XML helpers ====================

  private buildMethodCall(method: string, params: string[]): string {
    const paramXml = params.map((p) => `<param>${p}</param>`).join('');
    return `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${paramXml}</params></methodCall>`;
  }
}

// ==================== Tiny XML builders (no dep needed) ====================

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xmlValue(type: string, value: string): string {
  return `<value><${type}>${escapeXml(value)}</${type}></value>`;
}

function xmlStruct(obj: Record<string, string>): string {
  const members = Object.entries(obj)
    .map(
      ([name, val]) =>
        `<member><name>${escapeXml(name)}</name>${xmlValue('string', val)}</member>`
    )
    .join('');
  return `<value><struct>${members}</struct></value>`;
}

/** Pull the first text content from a given XML tag in a raw XML string. */
function extractXmlText(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const m = xml.match(re);
  return m ? m[1] : null;
}
