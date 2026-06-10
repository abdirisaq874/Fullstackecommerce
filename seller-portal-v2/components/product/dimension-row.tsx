'use client';

import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { ProductDimension } from '@/lib/types';

interface DimensionRowProps {
  dimension: ProductDimension;
  error?: string;
  onNameChange: (name: string) => void;
  onAddValue: (value: string) => void;
  onRemoveValue: (idx: number) => void;
  onRemove: () => void;
}

export function DimensionRow({
  dimension, error, onNameChange, onAddValue, onRemoveValue, onRemove,
}: DimensionRowProps) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    if (draft.trim()) {
      onAddValue(draft.trim());
      setDraft('');
    }
  };

  return (
    <div className="bg-stone-50/40 border border-stone-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <input
          className={clsx(
            'flex-1 px-2.5 py-1.5 bg-white border rounded-md text-sm font-medium outline-none transition-colors',
            error ? 'border-red-400 focus:border-red-500' : 'border-stone-200 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10'
          )}
          value={dimension.name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Dimension name (e.g. Size, Color)"
          aria-label="Dimension name"
        />
        <button
          onClick={onRemove}
          className="text-stone-400 hover:text-red-600 p-1.5"
          title="Remove dimension"
          aria-label={dimension.name ? `Remove dimension ${dimension.name}` : 'Remove dimension'}
          type="button"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {dimension.values.map((val, vi) => (
          <span key={vi} className="inline-flex items-center gap-1 bg-white border border-stone-200 rounded-full pl-2.5 pr-1 py-0.5 text-xs text-stone-700">
            {val}
            <button
              onClick={() => onRemoveValue(vi)}
              className="text-stone-400 hover:text-red-600 p-0.5 rounded-full hover:bg-red-50"
              title="Remove value"
              aria-label={`Remove value ${val}`}
              type="button"
            >
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          className="bg-transparent text-xs px-2 py-1 outline-none placeholder:text-stone-400 min-w-[140px]"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
            else if (e.key === 'Backspace' && !draft && dimension.values.length) {
              onRemoveValue(dimension.values.length - 1);
            }
          }}
          onBlur={commit}
          placeholder={dimension.values.length ? 'Add another…' : 'Type a value and press Enter'}
          aria-label={dimension.name ? `Add value to ${dimension.name}` : 'Add dimension value'}
        />
      </div>
      {error && <div className="text-xs text-red-600 mt-2">{error}</div>}
    </div>
  );
}
