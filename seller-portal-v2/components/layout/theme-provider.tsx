'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

/**
 * Client-side wrapper around `next-themes` so the root layout can stay a
 * server component. We persist the choice (`light` / `dark` / `system`) and
 * toggle the `class` attribute on `<html>` to drive Tailwind's dark variant.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
