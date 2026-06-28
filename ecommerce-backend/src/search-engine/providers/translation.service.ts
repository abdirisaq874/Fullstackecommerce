import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { postJson } from './http.util';

/**
 * Translation for backfilling missing locales at index time. v1 uses an LLM via
 * OpenRouter (Gemini) — already on hand. Swap to Google/Azure Translation later
 * by replacing this one service. Returns null on failure so indexing never
 * blocks on translation.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return (
      !!this.config.get<boolean>('search.flags.translation') &&
      !!this.config.get<string>('search.openrouter.apiKey')
    );
  }

  async translate(text: string, from: string, to: string): Promise<string | null> {
    if (!this.enabled || !text?.trim() || from === to) return null;
    const apiKey = this.config.get<string>('search.openrouter.apiKey');
    const baseUrl = this.config.get<string>('search.openrouter.baseUrl');
    const model = this.config.get<string>('search.openrouter.translationModel');

    const prompt =
      `Translate the following e-commerce product text from "${from}" to "${to}". ` +
      `Preserve brand names, product names, numbers and units. ` +
      `Return ONLY the translated text — no quotes, no notes.\n\n${text}`;

    try {
      const res = await postJson<any>(
        `${baseUrl}/chat/completions`,
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
        },
        { Authorization: `Bearer ${apiKey}` },
      );
      const out = res?.choices?.[0]?.message?.content;
      return typeof out === 'string' ? out.trim() : null;
    } catch (err) {
      this.logger.warn(`Translation ${from}->${to} failed: ${(err as Error).message}`);
      return null;
    }
  }
}
