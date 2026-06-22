/**
 * Static reference data used by the seller-portal UI.
 *
 * These constants drive form selects (categories, brands, currencies) and
 * localization tabs (LOCALES). They are *not* mock data — they're the
 * canonical client-side reference list. Once the backend exposes
 * category/brand admin endpoints, `CATEGORIES` and `BRANDS` can be replaced
 * with an RTK query hook; until then, keeping them as a typed module
 * constant is the simplest correct option.
 *
 * Previously colocated with mock fixtures in `lib/api/mock-db.ts`; moved
 * here as part of C8 so the mock-db file can be deleted without breaking
 * the product form / utility helpers.
 */

export interface CategoryOption {
  id: string;
  name: string;
}

export interface BrandOption {
  id: string;
  name: string;
}

export interface LocaleOption {
  code: string;
  label: string;
  flag: string;
}

export const CATEGORIES: CategoryOption[] = [
  { id: 'cat-apparel',     name: 'Apparel & clothing'   },
  { id: 'cat-textiles',    name: 'Textiles & home'      },
  { id: 'cat-accessories', name: 'Accessories'          },
  { id: 'cat-footwear',    name: 'Footwear'             },
  { id: 'cat-bags',        name: 'Bags & leather goods' },
];

export const BRANDS: BrandOption[] = [
  { id: 'brand-aysel',    name: 'Aysel Tekstil'  },
  { id: 'brand-bursa',    name: 'Bursa Atelier'  },
  { id: 'brand-anatolia', name: 'Anatolia Co.'   },
  { id: 'brand-house',    name: 'House label'    },
];

export const CURRENCIES: readonly string[] = ['USD', 'TRY', 'KES', 'ETB', 'EUR'];

export const LOCALES: readonly LocaleOption[] = [
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'tr', label: 'Türkçe',   flag: '🇹🇷' },
  { code: 'so', label: 'Soomaali', flag: '🇸🇴' },
  { code: 'sw', label: 'Kiswahili',flag: '🇰🇪' },
  { code: 'am', label: 'አማርኛ',     flag: '🇪🇹' },
] as const;
