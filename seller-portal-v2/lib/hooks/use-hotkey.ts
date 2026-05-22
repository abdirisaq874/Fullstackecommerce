'use client';

import { useEffect } from 'react';

type Handler = (e: KeyboardEvent) => void;

/** Register a global keyboard shortcut. Returns a stable function. */
export function useHotkey(combo: string, handler: Handler) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const parts = combo.toLowerCase().split('+');
      const key = parts[parts.length - 1];
      const wantMeta  = parts.includes('cmd') || parts.includes('meta');
      const wantCtrl  = parts.includes('ctrl');
      const wantShift = parts.includes('shift');
      const wantAlt   = parts.includes('alt');

      if (e.key.toLowerCase() !== key) return;
      if (wantMeta  && !(e.metaKey || e.ctrlKey)) return; // accept either on cross-platform
      if (wantCtrl  && !e.ctrlKey) return;
      if (wantShift && !e.shiftKey) return;
      if (wantAlt   && !e.altKey) return;
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, handler]);
}
