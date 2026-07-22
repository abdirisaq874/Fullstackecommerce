import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

// Meta Conversions API (server-side events). Mirrors the browser-pixel Purchase
// server-to-server so Meta still receives the conversion when the browser event
// is lost (ad-blockers, iOS/Safari cookie limits). Deduplicated with the pixel
// via a shared event_id (the order id). No-ops when no access token is set, so
// the checkout flow is never blocked by ad-tracking configuration.
const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
const PIXEL_ID = process.env.META_PIXEL_ID || '1638279067369914';
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN || '';
// Set temporarily to route events to Events Manager → Test Events for QA.
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE || '';

interface CapiUser {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  externalId?: string;
}

interface CapiContext {
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  sourceUrl?: string;
}

export interface CapiPurchase {
  eventId: string;
  value: number;
  currency: string;
  contentIds: string[];
  contents?: { id: string; quantity: number }[];
  numItems?: number;
  user?: CapiUser;
  context?: CapiContext;
}

@Injectable()
export class MetaConversionsService {
  private readonly logger = new Logger(MetaConversionsService.name);

  /** True once a CAPI access token is configured. */
  get enabled(): boolean {
    return Boolean(ACCESS_TOKEN);
  }

  /**
   * Send a Purchase to the Conversions API. Fire-and-forget: every error is
   * caught and logged so a Meta outage never affects checkout. Uses the same
   * event_id as the browser-pixel Purchase so Meta de-duplicates the two.
   */
  async sendPurchase(p: CapiPurchase): Promise<void> {
    if (!this.enabled) return; // not configured yet — the browser pixel covers it
    try {
      const payload: Record<string, any> = {
        data: [
          {
            event_name: 'Purchase',
            event_time: Math.floor(Date.now() / 1000),
            event_id: p.eventId,
            action_source: 'website',
            event_source_url: p.context?.sourceUrl,
            user_data: this.buildUserData(p.user, p.context),
            custom_data: {
              currency: p.currency,
              value: p.value,
              content_type: 'product',
              content_ids: p.contentIds,
              contents: p.contents,
              num_items: p.numItems ?? p.contentIds.length,
            },
          },
        ],
      };
      if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

      const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`CAPI Purchase rejected (${res.status}): ${body.slice(0, 500)}`);
        return;
      }
      this.logger.log(`CAPI Purchase sent (event_id=${p.eventId})`);
    } catch (err: any) {
      this.logger.error(`CAPI Purchase error: ${err?.message || err}`);
    }
  }

  // Match keys Meta uses to resolve the event to a person. Email/phone/name are
  // SHA-256 hashed (Meta's requirement); ip/ua/fbp/fbc are sent raw.
  private buildUserData(user: CapiUser = {}, ctx: CapiContext = {}): Record<string, any> {
    const data: Record<string, any> = {};
    const em = this.hash(user.email);
    const ph = this.hashPhone(user.phone);
    const fn = this.hash(user.firstName);
    const ln = this.hash(user.lastName);
    const ext = this.hash(user.externalId);
    if (em) data.em = [em];
    if (ph) data.ph = [ph];
    if (fn) data.fn = [fn];
    if (ln) data.ln = [ln];
    if (ext) data.external_id = [ext];
    if (ctx.ip) data.client_ip_address = ctx.ip;
    if (ctx.userAgent) data.client_user_agent = ctx.userAgent;
    if (ctx.fbp) data.fbp = ctx.fbp;
    if (ctx.fbc) data.fbc = ctx.fbc;
    return data;
  }

  /** SHA-256 of the trimmed, lowercased value (Meta normalization rules). */
  private hash(value?: string): string | undefined {
    const norm = value?.trim().toLowerCase();
    return norm ? createHash('sha256').update(norm).digest('hex') : undefined;
  }

  /** Phone: keep digits only (incl. country code) before hashing. */
  private hashPhone(value?: string): string | undefined {
    const digits = value?.replace(/\D/g, '');
    return digits ? createHash('sha256').update(digits).digest('hex') : undefined;
  }
}
