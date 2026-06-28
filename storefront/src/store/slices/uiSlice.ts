import { createSlice } from '@reduxjs/toolkit';

interface UiState {
  cartDrawerOpen: boolean;
  mobileNavOpen: boolean;
  searchOpen: boolean;
}

const initialState: UiState = {
  cartDrawerOpen: false,
  mobileNavOpen: false,
  searchOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openCart(s) { s.cartDrawerOpen = true; },
    closeCart(s) { s.cartDrawerOpen = false; },
    toggleCart(s) { s.cartDrawerOpen = !s.cartDrawerOpen; },
    openMobileNav(s) { s.mobileNavOpen = true; },
    closeMobileNav(s) { s.mobileNavOpen = false; },
    openSearch(s) { s.searchOpen = true; },
    closeSearch(s) { s.searchOpen = false; },
  },
});

export const {
  openCart, closeCart, toggleCart,
  openMobileNav, closeMobileNav,
  openSearch, closeSearch,
} = uiSlice.actions;
export default uiSlice.reducer;
