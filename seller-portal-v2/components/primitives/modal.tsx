'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Selector for elements the browser considers tab-stops. Used by the focus
// trap to constrain Tab / Shift+Tab inside the dialog while it's open.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({ open, onClose, children, title, subtitle, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // Element that was focused before the dialog opened — we restore focus to
  // it on close so keyboard users return to where they came from.
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Focus the first focusable element inside the dialog. If none exists,
    // focus the dialog container itself so Tab/Shift+Tab still cycle within
    // the trap.
    const focusFirst = () => {
      const el = dialogRef.current;
      if (!el) return;
      const first = el.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? el).focus();
    };
    // Defer one tick so children (autoFocus inputs etc) win the first focus.
    const t = window.setTimeout(focusFirst, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      // Focus trap — keep Tab cycling within the dialog.
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((n) => !n.hasAttribute('disabled') && n.tabIndex !== -1);
      if (focusables.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      // Restore focus to the element that opened the dialog.
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 dark:bg-black/70 backdrop-blur-sm p-4 sm:p-8 animate-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={clsx(
          'w-full bg-white dark:bg-forest-950 dark:border dark:border-forest-900 rounded-xl shadow-2xl my-auto animate-in outline-none',
          widths[size],
        )}
        onClick={e => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="px-6 py-4 border-b border-stone-200 dark:border-forest-900 flex items-start justify-between gap-4">
            <div>
              {title && (
                <h2
                  id={titleId}
                  className="font-serif text-2xl text-stone-900 dark:text-stone-100 leading-tight"
                >
                  {title}
                </h2>
              )}
              {subtitle && <div className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 p-1 -mt-1 -mr-1"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
