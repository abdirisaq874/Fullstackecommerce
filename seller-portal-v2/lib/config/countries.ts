/**
 * Deterministic ISO-3166-1 alpha-2 country list used by the shipping
 * page (E4) zone editor.
 *
 * Backend `CreateZoneDto.countries` expects 2-letter codes (see
 * `ecommerce-backend/src/shipping/dto/shipping.dto.ts`). This is the
 * top-30 "most common" list plus enough African/MENA coverage to match
 * the seller-portal's primary markets — easy to expand later without
 * touching the schema.
 *
 * Codes are uppercase. Names are English. The list is sorted by name
 * for stable rendering.
 */

export interface CountryOption {
  /** ISO-3166-1 alpha-2 uppercase code. */
  code: string;
  /** Human-readable English name. */
  name: string;
  /** Unicode flag emoji (purely decorative). */
  flag: string;
}

export const COUNTRIES: readonly CountryOption[] = [
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'AU', name: 'Australia',            flag: '🇦🇺' },
  { code: 'BR', name: 'Brazil',               flag: '🇧🇷' },
  { code: 'CA', name: 'Canada',               flag: '🇨🇦' },
  { code: 'CH', name: 'Switzerland',          flag: '🇨🇭' },
  { code: 'CN', name: 'China',                flag: '🇨🇳' },
  { code: 'DE', name: 'Germany',              flag: '🇩🇪' },
  { code: 'EG', name: 'Egypt',                flag: '🇪🇬' },
  { code: 'ES', name: 'Spain',                flag: '🇪🇸' },
  { code: 'ET', name: 'Ethiopia',             flag: '🇪🇹' },
  { code: 'FR', name: 'France',               flag: '🇫🇷' },
  { code: 'GB', name: 'United Kingdom',       flag: '🇬🇧' },
  { code: 'IN', name: 'India',                flag: '🇮🇳' },
  { code: 'IT', name: 'Italy',                flag: '🇮🇹' },
  { code: 'JP', name: 'Japan',                flag: '🇯🇵' },
  { code: 'KE', name: 'Kenya',                flag: '🇰🇪' },
  { code: 'KR', name: 'South Korea',          flag: '🇰🇷' },
  { code: 'MA', name: 'Morocco',              flag: '🇲🇦' },
  { code: 'MX', name: 'Mexico',               flag: '🇲🇽' },
  { code: 'NG', name: 'Nigeria',              flag: '🇳🇬' },
  { code: 'NL', name: 'Netherlands',          flag: '🇳🇱' },
  { code: 'PL', name: 'Poland',               flag: '🇵🇱' },
  { code: 'RU', name: 'Russia',               flag: '🇷🇺' },
  { code: 'SA', name: 'Saudi Arabia',         flag: '🇸🇦' },
  { code: 'SE', name: 'Sweden',               flag: '🇸🇪' },
  { code: 'SG', name: 'Singapore',            flag: '🇸🇬' },
  { code: 'SO', name: 'Somalia',              flag: '🇸🇴' },
  { code: 'TR', name: 'Türkiye',              flag: '🇹🇷' },
  { code: 'US', name: 'United States',        flag: '🇺🇸' },
  { code: 'ZA', name: 'South Africa',         flag: '🇿🇦' },
];

/** Lookup helper — returns the country option for an uppercase code. */
export function findCountry(code: string): CountryOption | undefined {
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}
