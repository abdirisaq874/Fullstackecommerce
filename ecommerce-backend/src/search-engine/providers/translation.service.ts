import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { postJson } from './http.util';

// Serialize + space out translation calls to stay under the provider's
// requests-per-minute limit (free Gemini tiers are ~10-15 RPM). Tunable via env.
const MIN_INTERVAL_MS = Number(process.env.TRANSLATION_MIN_INTERVAL_MS || 5000);
const MAX_RETRIES = Number(process.env.TRANSLATION_MAX_RETRIES || 3);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let translationGate: Promise<void> = Promise.resolve();
/** Run fn after the previous call, then hold the gate MIN_INTERVAL_MS to pace RPM. */
async function paced<T>(fn: () => Promise<T>): Promise<T> {
  const prev = translationGate;
  let release!: () => void;
  translationGate = new Promise<void>((r) => (release = r));
  await prev;
  try {
    return await fn();
  } finally {
    setTimeout(release, MIN_INTERVAL_MS);
  }
}

/**
 * Translation for backfilling missing product locales at index time. Provider /
 * model / enable-flag come from the `translation` config namespace, so switching
 * from OpenRouter to Gemini (OpenAI-compatible endpoint) is env-only. The API
 * key is read from env — never hardcoded. Returns null on failure so indexing
 * never blocks on translation.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  // Default persona/rules for the Somali ecommerce translator. Overridable via env.
  private readonly systemPrompt =
    process.env.TRANSLATION_SYSTEM_PROMPT ||
    [
      'You are a professional Somali ecommerce translator.',
      '',
      'Translate ecommerce product content from English to Somali.',
      '',
      'Rules:',
      '- Use natural Somali language used by online shops.',
      '- Preserve brand names exactly.',
      '- Do not translate product models, SKUs, serial numbers, measurements, or technical codes.',
      '- Keep the meaning accurate.',
      '- Do not add marketing claims that are not present.',
      '- Make translations suitable for product listings.',
      '- Return ONLY valid JSON.',
    ].join('\n');

  constructor(private readonly config: ConfigService) {}

  private cfg() {
    return {
      enabled: this.config.get<boolean>('translation.enabled'),
      provider: this.config.get<string>('translation.provider'),
      apiKey: this.config.get<string>('translation.apiKey') || '',
      baseUrl: this.config.get<string>('translation.baseUrl'),
      model: this.config.get<string>('translation.model'),
    };
  }

  get enabled(): boolean {
    const c = this.cfg();
    return !!c.enabled && !!c.apiKey;
  }

  /** Model id currently in use (recorded in localizationMeta). */
  get model(): string {
    return this.cfg().model || '';
  }

  private parseJson(content: string): Record<string, unknown> | null {
    const tryParse = (s: string) => {
      try {
        return JSON.parse(s);
      } catch {
        return null;
      }
    };
    // Strip ```json fences if present, then parse; fall back to the first {...} block.
    const cleaned = content.replace(/```json\s*|\s*```/g, '').trim();
    return tryParse(cleaned) ?? (content.match(/\{[\s\S]*\}/) ? tryParse(content.match(/\{[\s\S]*\}/)![0]) : null);
  }

  /**
   * Translate a map of fields in ONE call. Returns a map with the same keys and
   * translated values, or null on failure.
   */
  async translateFields(
    fields: Record<string, string>,
    from: string,
    to: string,
  ): Promise<Record<string, string> | null> {
    if (!this.enabled || from === to) return null;
    const input = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => typeof v === 'string' && v.trim()),
    );
    if (!Object.keys(input).length) return null;

    const c = this.cfg();
    const user =
      `Translate the VALUES of this JSON object from "${from}" to "${to}". ` +
      `Return ONLY a JSON object with the SAME keys and the translated values.\n\n` +
      JSON.stringify(input);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const content = await paced(async () => {
          const res = await postJson<any>(
            `${c.baseUrl}/chat/completions`,
            {
              model: c.model,
              temperature: 0.2,
              messages: [
                { role: 'system', content: this.systemPrompt },
                { role: 'user', content: user },
              ],
            },
            { Authorization: `Bearer ${c.apiKey}` },
          );
          return (res?.choices?.[0]?.message?.content ?? '') as string;
        });
        const parsed = this.parseJson(content);
        if (!parsed) return null;
        const out: Record<string, string> = {};
        for (const key of Object.keys(input)) {
          const v = parsed[key];
          if (typeof v === 'string' && v.trim()) out[key] = v.trim();
        }
        return Object.keys(out).length ? out : null;
      } catch (err) {
        const msg = (err as Error).message || '';
        const rateLimited = msg.includes('429');
        // Rate-limited → wait ~a full window and retry; transient 5xx → short backoff.
        if (attempt < MAX_RETRIES && (rateLimited || /\b5\d\d\b/.test(msg))) {
          await sleep(rateLimited ? 30000 : 2000 * (attempt + 1));
          continue;
        }
        this.logger.warn(`Translation ${from}->${to} failed: ${msg}`);
        return null;
      }
    }
    return null;
  }

  /** Translate a single string (convenience wrapper over translateFields). */
  async translate(text: string, from: string, to: string): Promise<string | null> {
    if (!text?.trim()) return null;
    const r = await this.translateFields({ text }, from, to);
    return r?.text ?? null;
  }
}
