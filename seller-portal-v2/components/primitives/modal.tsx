'use client';

import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, children, title, subtitle, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 backdrop-blur-sm p-4 sm:p-8 animate-in"
      onClick={onClose}
    >
      <div
        className={clsx('w-full bg-white rounded-xl shadow-2xl my-auto animate-in', widths[size])}
        onClick={e => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="px-6 py-4 border-b border-stone-200 flex items-start justify-between gap-4">
            <div>
              {title && <h2 className="font-serif text-2xl text-stone-900 leading-tight">{title}</h2>}
              {subtitle && <div className="text-sm text-stone-500 mt-0.5">{subtitle}</div>}
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1 -mt-1 -mr-1" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
