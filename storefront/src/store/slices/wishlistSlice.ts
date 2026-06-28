import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WishlistEntry } from '@/types';

const KEY = 'suuq.wishlist';

function load(): WishlistEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
function save(items: WishlistEntry[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(items));
}

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: { items: load() as WishlistEntry[] },
  reducers: {
    hydrateWishlist(s) {
      s.items = load();
    },
    toggleWishlist(s, a: PayloadAction<WishlistEntry>) {
      const i = s.items.findIndex((x) => x.productId === a.payload.productId);
      if (i >= 0) s.items.splice(i, 1);
      else s.items.unshift(a.payload);
      save(s.items);
    },
    removeWishlist(s, a: PayloadAction<string>) {
      s.items = s.items.filter((x) => x.productId !== a.payload);
      save(s.items);
    },
    clearWishlist(s) {
      s.items = [];
      save(s.items);
    },
  },
});

export const { hydrateWishlist, toggleWishlist, removeWishlist, clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
