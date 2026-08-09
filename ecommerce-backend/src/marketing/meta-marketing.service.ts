import { Injectable, Logger } from '@nestjs/common';

// Meta Marketing API (read side). Where MetaConversionsService pushes events out,
// this pulls performance back in: spend, delivery and the conversion funnel for
// the platform ad account. Read-only by design — campaign writes stay in Ads
// Manager until we have a reason to automate them.
//
// Requires a system-user token with `ads_read`. The CAPI token will NOT work: it
// is granted only `read_ads_dataset_quality` on the pixel, so every ads endpoint
// returns (#200) Missing Permissions. Keep the two tokens separate.
const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
const ACCESS_TOKEN = process.env.META_MARKETING_TOKEN || '';
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || 'act_1580994366475871';

// Insights are rate-limited per ad account and the dashboard polls on every
// page load, so results are held briefly in memory. Short enough that spend
// still looks live, long enough to survive a dashboard refresh loop.
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Meta's account_status codes. 1 is the only one that serves ads. */
const ACCOUNT_STATUS: Record<number, string> = {
  1: 'ACTIVE',
  2: 'DISABLED',
  3: 'UNSETTLED',
  7: 'PENDING_RISK_REVIEW',
  8: 'PENDING_SETTLEMENT',
  9: 'IN_GRACE_PERIOD',
  100: 'PENDING_CLOSURE',
  101: 'CLOSED',
};

// Meta reports the same conversion under several action_type aliases (a pixel
// purchase appears as `purchase`, `omni_purchase` and
// `offsite_conversion.fb_pixel_purchase`). Read one alias per concept or the
// totals double-count.
const ACTION_ALIASES: Record<string, string[]> = {
  purchases: ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'],
  addToCart: ['omni_add_to_cart', 'add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart'],
  checkouts: ['omni_initiated_checkout', 'initiate_checkout'],
  viewContent: ['omni_view_content', 'view_content'],
  landingPageViews: ['landing_page_view'],
  linkClicks: ['link_click'],
};

export interface AdAccountSummary {
  accountId: string;
  name: string;
  status: string;
  /** True only when Meta will actually serve ads on this account. */
  serving: boolean;
  currency: string;
  /** Major units (₺, $) — Meta returns these fields in minor units. */
  balance: number;
  amountSpent: number;
  spendCap: number | null;
}

export interface AdInsights {
  datePreset: string;
  dateStart: string;
  dateStop: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number;
  cpc: number;
  /** Revenue / spend, as reported by Meta. Null when no purchases are attributed. */
  roas: number | null;
  conversions: Record<string, number>;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  objective: string;
  /** Major units per day, or null when the budget lives on the ad sets. */
  dailyBudget: number | null;
  insights: AdInsights | null;
}

@Injectable()
export class MetaMarketingService {
  private readonly logger = new Logger(MetaMarketingService.name);
  private readonly cache = new Map<string, { at: number; value: unknown }>();

  /** True once a Marketing API token is configured. */
  get enabled(): boolean {
    return Boolean(ACCESS_TOKEN);
  }

  get adAccountId(): string {
    return AD_ACCOUNT_ID;
  }

  /**
   * Account health: status, balance and spend cap. Worth surfacing on its own —
   * an UNSETTLED account keeps its campaigns marked ACTIVE while quietly serving
   * nothing, so "campaign is active" is not evidence that ads are running.
   */
  async getAccountSummary(): Promise<AdAccountSummary | null> {
    const data = await this.get<Record<string, any>>(AD_ACCOUNT_ID, {
      fields: 'name,account_status,currency,balance,amount_spent,spend_cap',
    });
    if (!data) return null;

    const status = ACCOUNT_STATUS[data.account_status] || `UNKNOWN_${data.account_status}`;
    return {
      accountId: AD_ACCOUNT_ID,
      name: data.name,
      status,
      serving: data.account_status === 1,
      currency: data.currency,
      balance: this.minorToMajor(data.balance),
      amountSpent: this.minorToMajor(data.amount_spent),
      spendCap: data.spend_cap ? this.minorToMajor(data.spend_cap) : null,
    };
  }

  /** Account-wide performance for a Meta date_preset (default last 30 days). */
  async getInsights(datePreset = 'last_30d'): Promise<AdInsights | null> {
    const rows = await this.get<{ data: Record<string, any>[] }>(`${AD_ACCOUNT_ID}/insights`, {
      fields: 'spend,impressions,reach,clicks,ctr,cpc,purchase_roas,actions',
      date_preset: datePreset,
    });
    const row = rows?.data?.[0];
    if (!row) return null;
    return this.toInsights(row, datePreset);
  }

  /**
   * Campaigns with their insights attached. Meta will not return insights on the
   * campaign edge in one call, so each campaign is fetched separately; the list
   * is small (single-digit) and cached, so the extra round-trips are acceptable.
   */
  async getCampaigns(datePreset = 'last_30d'): Promise<CampaignSummary[]> {
    const list = await this.get<{ data: Record<string, any>[] }>(`${AD_ACCOUNT_ID}/campaigns`, {
      fields: 'id,name,status,objective,daily_budget',
      limit: '50',
    });
    if (!list?.data?.length) return [];

    return Promise.all(
      list.data.map(async (c) => {
        const rows = await this.get<{ data: Record<string, any>[] }>(`${c.id}/insights`, {
          fields: 'spend,impressions,reach,clicks,ctr,cpc,purchase_roas,actions',
          date_preset: datePreset,
        });
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          dailyBudget: c.daily_budget ? this.minorToMajor(c.daily_budget) : null,
          insights: rows?.data?.[0] ? this.toInsights(rows.data[0], datePreset) : null,
        };
      }),
    );
  }

  /** Normalize one Meta insights row into our shape. */
  private toInsights(row: Record<string, any>, datePreset: string): AdInsights {
    return {
      datePreset,
      dateStart: row.date_start,
      dateStop: row.date_stop,
      spend: this.num(row.spend),
      impressions: this.num(row.impressions),
      reach: this.num(row.reach),
      clicks: this.num(row.clicks),
      ctr: this.num(row.ctr),
      cpc: this.num(row.cpc),
      roas: row.purchase_roas?.[0]?.value ? this.num(row.purchase_roas[0].value) : null,
      conversions: this.parseActions(row.actions),
    };
  }

  /**
   * Collapse Meta's action_type aliases into named counters. For each concept the
   * first alias present wins, so a purchase reported under three names is counted
   * once.
   */
  private parseActions(actions?: { action_type: string; value: string }[]): Record<string, number> {
    const byType = new Map((actions || []).map((a) => [a.action_type, this.num(a.value)]));
    const out: Record<string, number> = {};
    for (const [key, aliases] of Object.entries(ACTION_ALIASES)) {
      const hit = aliases.find((a) => byType.has(a));
      out[key] = hit ? byType.get(hit)! : 0;
    }
    return out;
  }

  /**
   * Meta returns money in two different units depending on the field: `spend` is
   * already in major units, while `balance`, `amount_spent`, `spend_cap` and
   * `daily_budget` are minor units (kuruş, cents) as strings. Only the latter
   * group goes through here.
   */
  private minorToMajor(value: string | number | undefined): number {
    return Math.round(this.num(value)) / 100;
  }

  private num(value: string | number | undefined): number {
    const n = typeof value === 'number' ? value : parseFloat(value ?? '');
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * GET a Graph API edge. Returns null on any failure — an ads outage or an
   * expired token degrades the dashboard to "no data" rather than failing the
   * whole page.
   */
  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
    if (!this.enabled) return null;

    const key = `${path}?${new URLSearchParams(params)}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as T;

    try {
      const qs = new URLSearchParams({ ...params, access_token: ACCESS_TOKEN });
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}?${qs}`);
      // `res.json()` is typed as unknown under newer undici types; Meta's shape
      // is validated by the error check below rather than the type system.
      const body: any = await res.json();

      if (!res.ok || body?.error) {
        // Never let the token reach the logs.
        this.logger.error(`Marketing API ${path} failed: ${body?.error?.message || res.status}`);
        return null;
      }
      this.cache.set(key, { at: Date.now(), value: body });
      return body as T;
    } catch (err: any) {
      this.logger.error(`Marketing API ${path} error: ${err?.message || err}`);
      return null;
    }
  }
}
