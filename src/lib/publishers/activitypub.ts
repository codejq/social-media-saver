import { BasePublisher } from './base-publisher';
import type { ExtractedContent, PublishResult } from '@/types';

/**
 * ActivityPub publisher.
 *
 * Posts a Create → Note (or Article) activity to the actor's outbox.
 * The outbox URL is configured as `siteUrl` + `endpoint` (e.g. /outbox).
 *
 * Spec reference: https://www.w3.org/TR/activitypub/#client-to-server-interactions
 *
 * The server may accept a bare object (Note) and wrap it in a Create
 * activity automatically, but we send the full Create wrapper to be safe.
 * Authentication is typically Bearer token (OAuth2 / IndieAuth).
 */
export class ActivityPubPublisher extends BasePublisher {
  private static readonly CONTEXT = 'https://www.w3.org/ns/activitystreams';
  private static readonly CONTENT_TYPE = 'application/activity+json';

  async publish(content: ExtractedContent): Promise<PublishResult> {
    const outboxUrl = this.outboxUrl();
    const actorId = this.destination.config.siteUrl; // actor URL (profile)

    const note = {
      '@context': ActivityPubPublisher.CONTEXT,
      type: 'Create',
      actor: actorId,
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [],
      object: {
        type: 'Note',
        attributedTo: actorId,
        content: this.getHtmlContent(content),
        to: ['https://www.w3.org/ns/activitystreams#Public'],
        cc: [],
        published: new Date().toISOString(),
        ...(content.url ? { url: content.url } : {}),
        ...(content.metadata?.hashtags?.length
          ? {
              tag: content.metadata.hashtags.map((t) => ({
                type: 'Hashtag',
                name: `#${t}`,
              })),
            }
          : {}),
      },
    };

    const res = await fetch(outboxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': ActivityPubPublisher.CONTENT_TYPE,
        Accept: ActivityPubPublisher.CONTENT_TYPE,
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(note),
    });

    if (!res.ok) {
      return { success: false, error: `ActivityPub ${res.status}: ${await res.text()}` };
    }

    // The server SHOULD return 201 with a Location header pointing to the
    // created activity. Some implementations return the activity in the body.
    const location = res.headers.get('Location');
    let remoteId: string | undefined;

    try {
      const body = await res.json();
      remoteId = body.id || body.object?.id;
    } catch {
      // body not JSON — that's fine
    }

    return {
      success: true,
      publishedUrl: location || undefined,
      remoteId: remoteId || location || undefined,
    };
  }

  async testConnection(): Promise<boolean> {
    // GET the outbox should return an OrderedCollection
    const outboxUrl = this.outboxUrl();
    try {
      const res = await fetch(outboxUrl, {
        headers: {
          Accept: ActivityPubPublisher.CONTENT_TYPE,
          ...this.getAuthHeaders(),
        },
      });
      if (!res.ok) return false;

      const data = await res.json();
      // Valid outbox is an OrderedCollection or OrderedCollectionPage
      return (
        data.type === 'OrderedCollection' ||
        data.type === 'OrderedCollectionPage' ||
        data.type === 'Collection'
      );
    } catch {
      return false;
    }
  }

  private outboxUrl(): string {
    const endpoint = this.destination.config.endpoint || '/outbox';
    return `${this.baseUrl()}${endpoint}`;
  }
}
