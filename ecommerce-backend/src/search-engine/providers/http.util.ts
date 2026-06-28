/**
 * Minimal JSON POST helper used by the AI providers. Uses the global `fetch`
 * (Node 18+). Keeps provider code dependency-free and transparent so swapping
 * vendors is a one-file change.
 */
export async function postJson<T = any>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 20000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
    }
    return (text ? JSON.parse(text) : {}) as T;
  } finally {
    clearTimeout(timer);
  }
}
