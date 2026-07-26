/**
 * Derive canonical colors from product text (name / description) across
 * en + tr + so. Product titles in this catalog are mostly Turkish and usually
 * name the colour ("Siyah Erkek Ayakkabı"), so this gives good coverage without
 * any AI call. Matches are word-boundary anchored to avoid substring false hits.
 *
 * Powers the `color` facet + filter. Short/ambiguous Somali tokens (e.g. "cas",
 * "cad") are intentionally omitted to avoid false positives inside en/tr text.
 */

// canonical -> tokens (any language). Turkish diacritics are folded to ASCII by
// `normalize`, so "kırmızı" and "kirmizi" both work.
const COLOR_TOKENS: Array<[string, string[]]> = [
  ['black', ['black', 'siyah', 'madow']],
  ['white', ['white', 'beyaz', 'caddaan']],
  ['red', ['red', 'kirmizi', 'casaan']],
  ['blue', ['blue', 'mavi', 'buluug']],
  ['navy', ['navy', 'lacivert']],
  ['green', ['green', 'yesil', 'cagaar']],
  ['yellow', ['yellow', 'sari', 'jaalle', 'huruud']],
  ['pink', ['pink', 'pembe']],
  ['purple', ['purple', 'mor']],
  ['orange', ['orange', 'turuncu']],
  ['brown', ['brown', 'kahverengi', 'bunni']],
  ['gray', ['gray', 'grey', 'gri']],
  ['beige', ['beige', 'bej']],
  ['gold', ['gold', 'altin', 'dahab']],
  ['silver', ['silver', 'gumus']],
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns the set of canonical colors mentioned in the given texts. */
export function extractColors(texts: Array<string | undefined | null>): string[] {
  const hay = ' ' + texts.filter(Boolean).map((t) => normalize(String(t))).join(' ') + ' ';
  const found: string[] = [];
  for (const [canon, tokens] of COLOR_TOKENS) {
    for (const tok of tokens) {
      const t = normalize(tok);
      const re = new RegExp('(^|[^a-z])' + esc(t) + '([^a-z]|$)');
      if (re.test(hay)) {
        found.push(canon);
        break;
      }
    }
  }
  return found;
}
