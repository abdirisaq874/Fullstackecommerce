'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import { DataTable, type Column } from './data-table';

/**
 * Mobile card layout for a single row.
 *
 * Columns are stacked vertically with their header as a small label so the
 * tabular data remains legible without horizontal scrolling. Columns marked
 * `mobileHidden` (e.g. selection checkboxes that don't belong inside a tap
 * target) are skipped, and a column flagged `mobilePrimary` is rendered at
 * the top of the card without its label — that's the row's headline cell.
 */
export interface ResponsiveColumn<T> extends Column<T> {
  /** Drop this column from the mobile card view (e.g. ID / icon-only actions). */
  mobileHidden?: boolean;
  /** Render this column without a label at the top of the card. Usually the row's title. */
  mobilePrimary?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
  empty?: ReactNode;
}

export function ResponsiveTable<T>(props: ResponsiveTableProps<T>) {
  const { columns, data, rowKey, onRowClick, selectable, selectedIds, onSelect, empty } = props;

  if (data.length === 0) {
    return <div className="px-5 py-16 text-center text-sm text-stone-600 dark:text-stone-300">{empty ?? 'No records to display.'}</div>;
  }

  return (
    <>
      {/* md+ — table layout (unchanged DataTable). */}
      <div className="hidden md:block">
        <DataTable {...props} />
      </div>

      {/* < md — card stack. */}
      <ul className="md:hidden divide-y divide-stone-100 dark:divide-forest-900">
        {data.map(row => {
          const id = rowKey(row);
          const isSelected = selectedIds?.has(id);
          const primary = columns.find(c => c.mobilePrimary);
          const rest = columns.filter(c => !c.mobileHidden && !c.mobilePrimary);
          return (
            <li
              key={id}
              className={clsx(
                'px-4 py-4 transition-colors',
                isSelected ? 'bg-brand-50/40 dark:bg-brand-900/20' : 'active:bg-stone-50 dark:active:bg-forest-900',
                onRowClick && 'cursor-pointer',
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <div className="flex items-start gap-3">
                {selectable && (
                  <div className="pt-1" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={e => onSelect?.(id, e.target.checked)}
                      className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-500"
                      aria-label="Select row"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  {primary && <div className="text-sm">{primary.render(row)}</div>}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {rest.map(col => (
                      <div key={col.key} className="min-w-0">
                        <dt className="text-2xs font-medium text-stone-600 dark:text-stone-300 uppercase tracking-wide">
                          {col.header}
                        </dt>
                        <dd className="text-sm text-stone-700 dark:text-stone-200 truncate">
                          {col.render(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
