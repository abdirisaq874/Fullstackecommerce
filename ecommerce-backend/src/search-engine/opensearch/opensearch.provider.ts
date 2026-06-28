import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { OPENSEARCH_CLIENT } from './opensearch.constants';

/**
 * Single shared OpenSearch client. Auth is optional (the test stack runs with
 * security disabled). TLS verification is relaxed for self-signed test certs.
 */
export const opensearchClientProvider: Provider = {
  provide: OPENSEARCH_CLIENT,
  useFactory: (config: ConfigService) => {
    const node = config.get<string>('search.opensearch.node');
    const username = config.get<string>('search.opensearch.username');
    const password = config.get<string>('search.opensearch.password');
    return new Client({
      node,
      ...(username ? { auth: { username, password: password || '' } } : {}),
      ssl: { rejectUnauthorized: false },
    });
  },
  inject: [ConfigService],
};
