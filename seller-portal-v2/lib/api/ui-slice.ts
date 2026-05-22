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
}

const initialState: UiState = {
  toasts: [],
  commandPaletteOpen: false,
  notificationsPanelOpen: false,
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
  },
});

export const {
  pushToast,
  dismissToast,
  setCommandPaletteOpen,
  setNotificationsPanelOpen,
} = uiSlice.actions;

export default uiSlice.reducer;
