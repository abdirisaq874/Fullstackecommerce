'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  className?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  // Row selection (optional)
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  empty?: ReactNode;
}

export function DataTable<T>({
  columns, data, rowKey, onRowClick,
  selectable, selectedIds, onSelect, onSelectAll,
  empty,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return <div className="px-5 py-16 text-center text-sm text-stone-600 dark:text-stone-300">{empty ?? 'No records to display.'}</div>;
  }

  const allSelected = selectable && selectedIds && data.every(r => selectedIds.has(rowKey(r)));
  const someSelected = selectable && selectedIds && data.some(r => selectedIds.has(rowKey(r))) && !allSelected;

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-50/60 border-b border-stone-200">
            {selectable && (
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = !!someSelected; }}
                  onChange={e => onSelectAll?.(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-500"
                  aria-label="Select all"
                />
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                scope="col"
                className={clsx(
                  'text-left px-5 py-2.5 text-2xs font-medium text-stone-600 dark:text-stone-300 uppercase tracking-wide',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {data.map(row => {
            const id = rowKey(row);
            const isSelected = selectedIds?.has(id);
            return (
              <tr
                key={id}
                className={clsx(
                  'transition-colors',
                  isSelected ? 'bg-brand-50/40' : 'hover:bg-stone-50/50',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {selectable && (
                  <td className="w-10 px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={e => onSelect?.(id, e.target.checked)}
                      className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-500"
                      aria-label="Select row"
                    />
                  </td>
                )}
                {columns.map(col => (
                  <td key={col.key} className={clsx('px-5 py-3.5 text-stone-700', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
