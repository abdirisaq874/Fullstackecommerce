'use client';

import Link from 'next/link';
import { Plus, Info } from 'lucide-react';
import { Badge } from '@/components/primitives/badge';
import { Alert } from '@/components/primitives/alert';
import { Field, Input } from '@/components/primitives/field';
import { DimensionRow } from '@/components/product/dimension-row';
import { regenerateVariants } from '@/lib/utils';
import type { ProductDimension, ProductVariant } from '@/lib/types';
import clsx from 'clsx';

interface VariantsEditorProps {
  productName: string;
  hasVariants: boolean;
  dimensions: ProductDimension[];
  variants: ProductVariant[];
  stockOnHand: number | string;
  basePrice: number | string;
  errors: Record<string, string>;
  lockStock?: boolean;
  productSku?: string;
  /** SKUs that already have an inventory record — these route to Inventory; others get an editable stock box. */
  trackedSkus?: Set<string>;
  onToggleHasVariants: (on: boolean) => void;
  onDimensionsChange: (dimensions: ProductDimension[], variants: ProductVariant[]) => void;
  onVariantsChange: (variants: ProductVariant[]) => void;
  onStockChange: (stock: string) => void;
}

export function VariantsEditor({
  productName, hasVariants, dimensions, variants,
  stockOnHand, basePrice, errors, lockStock, productSku, trackedSkus,
  onToggleHasVariants, onDimensionsChange, onVariantsChange, onStockChange,
}: VariantsEditorProps) {
  // A SKU is "tracked" once it has an inventory record. Tracked stock is managed
  // in Inventory (movement history); untracked stock is editable here so a
  // starting quantity can be set before the record exists.
  const isTracked = (sku?: string) => !!sku && !!trackedSkus?.has(sku);
  // Regenerating variants any time dimensions change preserves user-entered data
  // for matching combinations by stable variantKey.
  const regenerate = (next: ProductDimension[]) => {
    const newVariants = regenerateVariants(productName, next, variants);
    onDimensionsChange(next, newVariants);
  };

  const addDimension = () => {
    const used = dimensions.map(d => d.name.toLowerCase());
    const suggestions = ['Size', 'Color', 'Material', 'Style'];
    const suggested = suggestions.find(s => !used.includes(s.toLowerCase())) || '';
    regenerate([...dimensions, { name: suggested, values: [] }]);
  };
  const updateDimensionName = (i: number, name: string) =>
    regenerate(dimensions.map((d, idx) => idx === i ? { ...d, name } : d));
  const removeDimension = (i: number) =>
    regenerate(dimensions.filter((_, idx) => idx !== i));
  const addValue = (i: number, value: string) => {
    if (dimensions[i].values.includes(value)) return;
    regenerate(dimensions.map((d, idx) =>
      idx === i ? { ...d, values: [...d.values, value] } : d
    ));
  };
  const removeValue = (i: number, vi: number) =>
    regenerate(dimensions.map((d, idx) =>
      idx === i ? { ...d, values: d.values.filter((_, j) => j !== vi) } : d
    ));

  const updateVariant = (i: number, patch: Partial<ProductVariant>) =>
    onVariantsChange(variants.map((v, idx) => idx === i ? { ...v, ...patch } : v));

  const totalStock = variants.reduce((sum, v) => sum + (Number(v.stockOnHand) || 0), 0);
  const visibleDims = dimensions.filter(d => d.name?.trim());

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 text-sm text-stone-800 cursor-pointer">
        <input
          type="checkbox"
          checked={hasVariants}
          onChange={e => onToggleHasVariants(e.target.checked)}
          className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-500"
        />
        This product has multiple variants (sizes, colors, etc.)
      </label>

      {lockStock && (
        <div className="flex items-start gap-2 text-xs text-stone-500 bg-stone-50 border border-stone-200 rounded-md px-3 py-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Existing stock is managed in <strong>Inventory</strong> so movement history stays accurate. New variants can be given a starting quantity here.</span>
        </div>
      )}

      {!hasVariants && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Stock on hand" hint="Tracked separately in the inventory collection">
            {lockStock && isTracked(productSku) ? (
              <div className="flex items-center gap-2 text-sm text-stone-600 h-9">
                <span>Managed in inventory</span>
                <Link href={`/inventory/${productSku}`} className="text-brand-700 hover:text-brand-800 font-medium">Open inventory →</Link>
              </div>
            ) : (
              <Input
                type="number" min="0"
                value={stockOnHand}
                onChange={e => onStockChange(e.target.value)}
                placeholder="0"
              />
            )}
          </Field>
        </div>
      )}

      {hasVariants && (
        <>
          {/* ─── Dimensions panel ─── */}
          <div className="border border-stone-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-stone-50/60 border-b border-stone-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-stone-900">Dimensions</div>
                <div className="text-xs text-stone-500 mt-0.5">How does this product vary? Each dimension becomes a buyer-facing selector.</div>
              </div>
              <button
                onClick={addDimension}
                disabled={dimensions.length >= 3}
                className="text-xs text-brand-700 hover:text-brand-800 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                <Plus className="w-3 h-3" /> Add dimension
              </button>
            </div>
            {errors.dimensions && (
              <div className="px-4 pt-3"><Alert variant="warning">{errors.dimensions}</Alert></div>
            )}
            <div className="p-4 space-y-3">
              {dimensions.length === 0 && (
                <div className="text-center py-6 text-sm text-stone-500">
                  No dimensions yet — click <strong>Add dimension</strong> to define Size, Color, etc.
                </div>
              )}
              {dimensions.map((dim, i) => (
                <DimensionRow
                  key={i}
                  dimension={dim}
                  error={errors[`dim_${i}_name`] || errors[`dim_${i}_values`]}
                  onNameChange={name => updateDimensionName(i, name)}
                  onAddValue={v => addValue(i, v)}
                  onRemoveValue={vi => removeValue(i, vi)}
                  onRemove={() => removeDimension(i)}
                />
              ))}
            </div>
          </div>

          {/* ─── Generated variants grid ─── */}
          {variants.length > 0 && (
            <div className="border border-stone-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-stone-50/60 border-b border-stone-200 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm font-medium text-stone-900">
                    Variants <span className="text-stone-500 font-normal">({variants.length} generated)</span>
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    Total stock: <span className="tabular-nums font-medium text-stone-700">{totalStock}</span>
                  </div>
                </div>
              </div>
              {errors.variants && (
                <div className="px-4 pt-3"><Alert variant="warning">{errors.variants}</Alert></div>
              )}
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white border-b border-stone-200">
                      {visibleDims.map(d => (
                        <th key={d.name} className="text-left px-4 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">{d.name}</th>
                      ))}
                      <th className="text-left px-4 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">SKU</th>
                      <th className="text-left px-4 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Price</th>
                      <th className="text-left px-4 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Cost</th>
                      <th className="text-left px-4 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {variants.map((v, i) => (
                      <tr key={i} className="hover:bg-stone-50/40">
                        {v.options.map(opt => (
                          <td key={opt.name} className="px-4 py-2">
                            <Badge>{opt.value}</Badge>
                          </td>
                        ))}
                        <td className="px-4 py-2">
                          <input
                            className={clsx(
                              'w-full px-2 py-1.5 bg-white border rounded text-xs font-mono outline-none transition-colors',
                              errors[`variant_${i}_sku`]
                                ? 'border-red-400 focus:border-red-500'
                                : 'border-stone-200 focus:border-brand-600 focus:ring-1 focus:ring-brand-600/10'
                            )}
                            value={v.sku}
                            onChange={e => updateVariant(i, { sku: e.target.value.toUpperCase() })}
                            placeholder="SKU"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number" step="0.01" min="0"
                            className="w-24 px-2 py-1.5 bg-white border border-stone-200 rounded text-xs tabular-nums outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/10"
                            value={v.priceOverride}
                            onChange={e => updateVariant(i, { priceOverride: e.target.value })}
                            placeholder={String(basePrice || '—')}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number" step="0.01" min="0"
                            className="w-20 px-2 py-1.5 bg-white border border-stone-200 rounded text-xs tabular-nums outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/10"
                            value={v.costPrice}
                            onChange={e => updateVariant(i, { costPrice: e.target.value })}
                            placeholder="—"
                          />
                        </td>
                        <td className="px-4 py-2">
                          {lockStock && isTracked(v.sku) ? (
                            <Link href={`/inventory/${v.sku}`} className="text-xs text-brand-700 hover:text-brand-800 font-medium whitespace-nowrap">
                              Manage →
                            </Link>
                          ) : (
                            <input
                              type="number" min="0"
                              className="w-20 px-2 py-1.5 bg-white border border-stone-200 rounded text-xs tabular-nums outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/10"
                              value={v.stockOnHand}
                              onChange={e => updateVariant(i, { stockOnHand: e.target.value })}
                              placeholder="0"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-stone-50/60 border-t border-stone-200 flex items-center gap-2 text-xs text-stone-500">
                <Info className="w-3.5 h-3.5" />
                SKUs auto-suggested from product name + values. Click to edit any cell. Blank price uses the base price.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
