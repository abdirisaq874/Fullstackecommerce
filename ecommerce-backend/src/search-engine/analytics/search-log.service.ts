import { Inject, Injectable, Logger } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { OPENSEARCH_CLIENT } from '../opensearch/opensearch.constants';

export interface SearchLogEvent {
  q: string;
  locale: string;
  resultCount: number;
  returned: number;
  tookMs: number;
  vectorUsed: boolean;
  page: number;
  sort?: string;
  category?: string;
  brand?: string;
  hasFilters: boolean;
  topResultIds: string[];
}

const INDEX = 'search_logs';

/**
 * Fire-and-forget search analytics: one document per text search into the
 * `search_logs` OpenSearch index, powering the Dashboards search-analytics views
 * (top queries, zero-result queries, latency, trends).
 *
 * Contract: NEVER awaited on the request path and NEVER throws into it —
 * analytics must not slow down or break search. All errors are swallowed.
 */
@Injectable()
export class SearchLogService {
  private readonly logger = new Logger(SearchLogService.name);

  constructor(@Inject(OPENSEARCH_CLIENT) private readonly client: Client) {}

  log(ev: SearchLogEvent): void {
    // Only log real text searches; skip empty browse/filter-only requests.
    if (!ev.q || !ev.q.trim()) return;
    const body = { ...ev, q: ev.q.trim().slice(0, 200), createdAt: new Date() };
    // Fire-and-forget: do not await; swallow all errors so search is unaffected.
    void this.client
      .index({ index: INDEX, body, refresh: false })
      .catch((err) =>
        this.logger.debug(`search log write failed: ${(err as Error)?.message}`),
      );
  }
}
