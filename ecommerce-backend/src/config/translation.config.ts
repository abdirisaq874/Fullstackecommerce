import { registerAs } from '@nestjs/config';

const bool = (v: string | undefined, def: boolean) =>
  v === undefined || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());

/**
 * Product-locale translation (en → so, …). Provider, model and the enable flag
 * are all env-driven so we can switch between Gemini (OpenAI-compatible endpoint)
 * and OpenRouter with no code change. API keys are ALWAYS read from env — never
 * hardcoded.
 *
 *   TRANSLATION_ENABLED=1
 *   TRANSLATION_PROVIDER=gemini | openrouter
 *   GEMINI_API_KEY=...            (from Secret Manager)
 *   GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
 *   GEMINI_TRANSLATION_MODEL=gemini-2.5-flash
 */
export default registerAs('translation', () => {
  const provider = (process.env.TRANSLATION_PROVIDER || 'gemini').toLowerCase();

  const gemini = {
    apiKey: process.env.GEMINI_API_KEY || '',
    baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: process.env.GEMINI_TRANSLATION_MODEL || 'gemini-3.5-flash',
  };
  const openrouter = {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_TRANSLATION_MODEL || 'google/gemini-2.5-flash',
  };
  const active = provider === 'openrouter' ? openrouter : gemini;

  return {
    enabled: bool(process.env.TRANSLATION_ENABLED, true),
    provider,
    apiKey: active.apiKey,
    baseUrl: active.baseUrl,
    model: active.model,
  };
});
