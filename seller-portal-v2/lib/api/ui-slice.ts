import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info';
  text: string;
}

interface UiState {
  toasts: Toast[];
  commandPaletteOpen: boolean;
  notificationsPanelOpen: boolean;
  /** Mobile sidebar drawer open state. Only meaningful below the `lg` breakpoint
   *  — the sidebar is always visible on lg+ screens regardless of this flag. */
  sidebarOpen: boolean;
}

const initialState: UiState = {
  toasts: [],
  commandPaletteOpen: false,
  notificationsPanelOpen: false,
  sidebarOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    pushToast: (state, action: PayloadAction<Omit<Toast, 'id'>>) => {
      state.toasts.push({ ...action.payload, id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
    },
    dismissToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter(t => t.id !== action.payload);
    },
    setCommandPaletteOpen: (state, action: PayloadAction<boolean>) => {
      state.commandPaletteOpen = action.payload;
    },
    setNotificationsPanelOpen: (state, action: PayloadAction<boolean>) => {
      state.notificationsPanelOpen = action.payload;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
  },
});

export const {
  pushToast,
  dismissToast,
  setCommandPaletteOpen,
  setNotificationsPanelOpen,
  setSidebarOpen,
} = uiSlice.actions;

export default uiSlice.reducer;
