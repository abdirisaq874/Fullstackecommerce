'use client';

import { useEffect } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/lib/api/store';
import { dismissToast } from '@/lib/api/ui-slice';
import clsx from 'clsx';

const styles = {
  success: { bg: 'bg-stone-900',   Icon: CheckCircle2 },
  error:   { bg: 'bg-red-600',     Icon: XCircle },
  info:    { bg: 'bg-sky-700',     Icon: Info },
};

export function ToastViewport() {
  const toasts = useAppSelector(s => s.ui.toasts);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timers = toasts.map(t => setTimeout(() => dispatch(dismissToast(t.id)), 3500));
    return () => { timers.forEach(clearTimeout); };
  }, [toasts, dispatch]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 max-w-sm no-print">
      {toasts.map(t => {
        const { bg, Icon } = styles[t.kind];
        return (
          <div key={t.id} className={clsx(bg, 'text-white px-4 py-2.5 rounded-lg shadow-lg text-sm flex items-center gap-2.5 animate-in')}>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1">{t.text}</span>
            <button
              type="button"
              onClick={() => dispatch(dismissToast(t.id))}
              className="opacity-60 hover:opacity-100 shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
