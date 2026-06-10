'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import clsx from 'clsx';

type ThemeOption = 'light' | 'system' | 'dark';

const OPTIONS: Array<{ value: ThemeOption; label: string; Icon: typeof Sun }> = [
  { value: 'light',  label: 'Light',  Icon: Sun },
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'dark',   label: 'Dark',   Icon: Moon },
];

/**
 * Segmented Light / System / Dark control. The theme value is read from and
 * written to `next-themes`. We delay rendering the active state until the
 * client has mounted to avoid a hydration mismatch — until then we render
 * the control with neutral styling.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = (mounted ? theme : undefined) as ThemeOption | undefined;

  return (
    <div
      role="group"
      aria-label="Theme"
      className={clsx(
        'inline-flex items-center rounded-md border border-stone-200 bg-white p-0.5',
        'dark:border-forest-900 dark:bg-forest-950',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const isActive = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={isActive}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            className={clsx(
              'flex items-center justify-center w-7 h-6 rounded transition-colors',
              isActive
                ? 'bg-stone-100 text-stone-900 dark:bg-forest-900 dark:text-stone-100'
                : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50 dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-forest-900/60',
            )}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
