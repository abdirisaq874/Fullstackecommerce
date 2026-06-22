'use client';

import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertCircle, Save, Eye, ArrowLeft, FileText, ImageIcon, ImageOff, Tag as TagIcon, Hash, Layers, Globe } from 'lucide-react';
import clsx from 'clsx';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Card } from '@/components/primitives/card';
import { Alert } from '@/components/primitives/alert';
import { Field, Input, Textarea, Select } from '@/components/primitives/field';
import { ConfirmDialog } from '@/components/primitives/confirm-dialog';
import { VariantsEditor } from '@/components/product/variants-editor';
import { ImageUrlModal } from '@/components/product/image-url-modal';
import { CATEGORIES, BRANDS, CURRENCIES, LOCALES } from '@/lib/api/mock-db';
import { useListInventoryQuery } from '@/lib/api';
import { inferDimensions, buildProductDto, buildStockSeed } from '@/lib/utils';
import type { Product, ProductAttribute, LocalizedFields, StockSeed, FormState } from '@/lib/types';

const blankForm: FormState = {
  name: '', categoryId: '', brandId: '',
  shortDescription: '', description: '',
  basePrice: '', compareAtPrice: '', currency: 'USD',
  hasVariants: false, stockOnHand: '',
  dimensions: [], variants: [], images: [], attributes: [],
  metaTitle: '', metaDescription: '',
  status: 'draft', isFeatured: false,
  localizations: { en: {} },
};

const SECTIONS = [
  { id: 'basics',     label: 'Basics',         icon: FileText },
  { id: 'pricing',    label: 'Pricing',        icon: TagIcon },
  { id: 'variants',   label: 'Variants & stock', icon: Layers },
  { id: 'images',     label: 'Images',         icon: ImageIcon },
  { id: 'meta',       label: 'SEO & attributes', icon: Hash },
  { id: 'review',     label: 'Review & publish', icon: Check },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

// Which sections actually gate publishing. Images and SEO are optional — the
// progress meter reflects publish-readiness, not "every section filled in".
const REQUIRED_SECTIONS: SectionId[] = ['basics', 'pricing', 'variants'];
const OPTIONAL_SECTIONS: SectionId[] = ['images', 'meta'];

interface ProductFormProps {
  mode: 'new' | 'edit';
  existing?: Product;
  onSave: (dto: ReturnType<typeof buildProductDto>, status: 'draft' | 'active', stock: StockSeed) => Promise<void> | void;
  saving?: boolean;
}

export function ProductForm({ mode, existing, onSave, saving }: ProductFormProps) {
  const router = useRouter();
  // Which SKUs already have an inventory record. Variants/products with a record
  // route to Inventory (to preserve movement history); those without get an
  // editable stock box so a starting quantity can be set right in the form.
  const { data: inventory = [] } = useListInventoryQuery();
  const trackedSkus = useMemo(() => new Set(inventory.map(r => r.sku)), [inventory]);
  const [section, setSection] = useState<SectionId>('basics');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeLocale, setActiveLocale] = useState<'en' | 'tr' | 'so' | 'sw' | 'am'>('en');
  // Tracks whether the user has edited anything, to guard against losing work.
  const [dirty, setDirty] = useState(false);
  // Generic confirmation dialog — reused for "discard changes" and "publish
  // without images". Holds the action to run when the user confirms.
  const [confirm, setConfirm] = useState<null | {
    title: string;
    message?: ReactNode;
    confirmLabel?: string;
    variant?: 'primary' | 'danger';
    onConfirm: () => void | Promise<void>;
  }>(null);

  const [form, setForm] = useState<FormState>(() => {
    if (mode === 'edit' && existing) {
      const dimensions = inferDimensions(existing.variants);
      return {
        ...blankForm,
        name: existing.name,
        categoryId: existing.categoryId ?? '',
        brandId: existing.brandId ?? '',
        shortDescription: existing.shortDescription ?? '',
        description: existing.description ?? '',
        basePrice: String(existing.basePrice),
        compareAtPrice: existing.compareAtPrice != null ? String(existing.compareAtPrice) : '',
        currency: existing.currency || 'USD',
        hasVariants: !!existing.variants?.length,
        stockOnHand: existing.stock != null ? String(existing.stock) : '',
        dimensions,
        variants: existing.variants || [],
        images: existing.images || [],
        attributes: existing.attributes || [],
        metaTitle: existing.metaTitle ?? '',
        metaDescription: existing.metaDescription ?? '',
        status: existing.status,
        isFeatured: !!existing.isFeatured,
        localizations: existing.localizations || { en: {} },
      };
    }
    return blankForm;
  });

  const update = (patch: Partial<FormState>) => { setDirty(true); setForm(f => ({ ...f, ...patch })); };

  // Warn on hard browser navigation (refresh / tab close) while there are
  // unsaved edits. SPA navigations go through `leave()` below instead.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Leaving the form (Cancel / Back). Confirms first if there are unsaved edits.
  const leave = () => {
    if (!dirty) { router.push('/products'); return; }
    setConfirm({
      title: 'Discard unsaved changes?',
      message: 'You’ve made changes that haven’t been saved. If you leave now, they’ll be lost.',
      confirmLabel: 'Discard changes',
      variant: 'danger',
      onConfirm: () => router.push('/products'),
    });
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.shortDescription && form.shortDescription.length > 500) e.shortDescription = 'Max 500 characters';
    if (!form.basePrice || isNaN(Number(form.basePrice))) e.basePrice = 'Base price is required';
    else if (Number(form.basePrice) < 0) e.basePrice = 'Must be ≥ 0';
    if (form.compareAtPrice && Number(form.compareAtPrice) < 0) e.compareAtPrice = 'Must be ≥ 0';

    if (form.hasVariants) {
      if (!form.dimensions.length) e.dimensions = 'Add at least one dimension (e.g. Size)';
      else {
        const dimNames = new Set<string>();
        form.dimensions.forEach((d, i) => {
          if (!d.name?.trim()) e[`dim_${i}_name`] = 'Dimension name required';
          else if (dimNames.has(d.name.toLowerCase())) e[`dim_${i}_name`] = 'Duplicate dimension';
          dimNames.add(d.name.toLowerCase());
          if (!d.values?.length) e[`dim_${i}_values`] = 'Add at least one value';
        });
      }
      if (!form.variants.length) e.variants = 'No variants generated — check your dimensions';
      const skus = new Set<string>();
      form.variants.forEach((v, i) => {
        if (!v.sku?.trim()) e[`variant_${i}_sku`] = 'SKU required';
        else if (skus.has(v.sku)) e[`variant_${i}_sku`] = 'Duplicate SKU';
        skus.add(v.sku);
      });
    }
    // Compare-at is the struck-through "was" price — it only makes sense when it's
    // higher than what the buyer actually pays, otherwise the storefront renders a
    // backwards "discount". (Skip if the field already flagged a negative value.)
    if (form.compareAtPrice && !e.compareAtPrice) {
      const compareAt = Number(form.compareAtPrice);
      const base = Number(form.basePrice);
      if (form.basePrice && !isNaN(base) && !isNaN(compareAt) && compareAt <= base) {
        e.compareAtPrice = 'Compare-at price must be higher than the base price';
      }
    }
    setErrors(e);
    return e;
  };

  const sectionHasError = (id: SectionId, errs: Record<string, string> = errors) => Object.keys(errs).some(k => {
    if (id === 'basics')   return ['name', 'shortDescription'].includes(k);
    if (id === 'pricing')  return ['basePrice', 'compareAtPrice'].includes(k);
    if (id === 'variants') return k.startsWith('variant_') || k.startsWith('dim_') || k === 'variants' || k === 'dimensions';
    return false;
  });

  const sectionDone = (id: SectionId) => {
    if (id === 'basics')   return !!form.name;
    if (id === 'pricing')  return !!form.basePrice;
    if (id === 'variants') return form.hasVariants ? (form.dimensions.length > 0 && form.variants.length > 0) : true;
    if (id === 'images')   return form.images.length > 0;
    if (id === 'meta')     return !!form.metaTitle || form.attributes.length > 0;
    return false;
  };

  const persist = async (status: 'draft' | 'active') => {
    const dto = buildProductDto({ ...form, status });
    let stock: StockSeed;
    if (mode === 'new') {
      stock = buildStockSeed(form);
    } else if (form.hasVariants) {
      // Seed only variants that don't yet have an inventory record; existing ones
      // are managed in Inventory so their movement history isn't overwritten.
      stock = form.variants
        .filter(v => v.sku && !trackedSkus.has(v.sku) && v.stockOnHand !== '' && v.stockOnHand != null)
        .map(v => ({ sku: v.sku, onHand: Number(v.stockOnHand) || 0 }));
    } else if (existing?.sku && !trackedSkus.has(existing.sku) && form.stockOnHand !== '' && form.stockOnHand != null) {
      stock = [{ sku: existing.sku, onHand: Number(form.stockOnHand) || 0 }];
    } else {
      stock = [];
    }
    await onSave(dto, status, stock);
  };

  const submit = async (status: 'draft' | 'active') => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      // Jump to the first wizard section (in order) that has an unresolved error.
      // Use the freshly-computed `e`, not the `errors` state — state updates async,
      // so reading it here would be one click stale (and empty on the first submit).
      const firstBad = SECTIONS.find(s => sectionHasError(s.id, e));
      if (firstBad) setSection(firstBad.id);
      return;
    }
    // Soft guard: publishing an imageless product puts a placeholder live on the
    // storefront. Drafts are fine to save without images.
    if (status === 'active' && form.images.length === 0) {
      setConfirm({
        title: 'Publish without images?',
        message: 'This product has no images, so buyers will see a placeholder thumbnail. You can publish now and add images later.',
        confirmLabel: 'Publish anyway',
        variant: 'primary',
        onConfirm: () => persist('active'),
      });
      return;
    }
    await persist(status);
  };

  const dtoPreview = useMemo(() => buildProductDto({ ...form, status: form.status }), [form]);
  const requiredDone = REQUIRED_SECTIONS.filter(id => sectionDone(id)).length;
  const readyToPublish = requiredDone === REQUIRED_SECTIONS.length;

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <button onClick={leave} className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> Back to products
          </button>
          <h1 className="font-serif text-3xl text-stone-900">
            {mode === 'new' ? 'New product' : (existing?.name || 'Edit product')}
          </h1>
          <div className="text-sm text-stone-500 mt-1">
            {mode === 'new' ? 'Add a product to your catalog' : `SKU: ${existing?.sku ?? '—'} · Last edited ${existing?.updatedAt ?? '—'}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={leave}>Cancel</Button>
          <Button variant="secondary" onClick={() => submit('draft')} disabled={saving}>
            <Save className="w-3.5 h-3.5" /> Save draft
          </Button>
          <Button variant="primary" onClick={() => submit('active')} disabled={saving}>
            <Eye className="w-3.5 h-3.5" /> {mode === 'new' ? 'Publish' : 'Save & publish'}
          </Button>
        </div>
      </div>

      {Object.keys(errors).length > 0 && (
        <Alert variant="danger" className="mb-4">
          <strong>{Object.keys(errors).length} issue{Object.keys(errors).length === 1 ? '' : 's'}</strong> need to be resolved before publishing.
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* ─── Section sidebar ─── */}
        <aside className="lg:sticky lg:top-6 self-start no-print">
          <Card className="overflow-hidden">
            <div className="px-3 py-2.5 border-b border-stone-200 bg-stone-50/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-500">{readyToPublish ? 'Ready to publish' : 'Required to publish'}</span>
                {readyToPublish
                  ? <span className="flex items-center gap-1 text-brand-700 font-medium"><Check className="w-3.5 h-3.5" /> Done</span>
                  : <span className="text-stone-700 font-medium">{requiredDone} of {REQUIRED_SECTIONS.length}</span>}
              </div>
              <div className="h-1 bg-stone-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${(requiredDone / REQUIRED_SECTIONS.length) * 100}%` }} />
              </div>
            </div>
            <nav className="p-1.5">
              {SECTIONS.map(({ id, label, icon: Icon }) => {
                const isActive = section === id;
                const hasError = sectionHasError(id);
                const isDone = sectionDone(id);
                const isOptional = OPTIONAL_SECTIONS.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => setSection(id)}
                    className={clsx(
                      'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors text-left',
                      isActive ? 'bg-brand-50 text-brand-800 font-medium' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                    )}
                    type="button"
                  >
                    <Icon className={clsx('w-3.5 h-3.5 shrink-0', isActive ? 'text-brand-700' : 'text-stone-400')} strokeWidth={2} />
                    <span className="flex-1">{label}</span>
                    {hasError
                      ? <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      : isDone
                        ? <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                        : isOptional
                          ? <span className="text-2xs text-stone-400 shrink-0">Optional</span>
                          : null}
                  </button>
                );
              })}
            </nav>
          </Card>
        </aside>

        {/* ─── Section content ─── */}
        <div className="space-y-6 min-w-0">
          <Card className="p-6">
            {section === 'basics' && (
              <BasicsSection
                form={form}
                update={update}
                errors={errors}
                activeLocale={activeLocale}
                onLocaleChange={setActiveLocale}
              />
            )}
            {section === 'pricing'  && <PricingSection form={form} update={update} errors={errors} />}
            {section === 'variants' && (
              <>
                <SectionTitle title="Variants & stock" hint="Define your dimensions once — the variant grid generates from them" />
                <VariantsEditor
                  productName={form.name}
                  hasVariants={form.hasVariants}
                  dimensions={form.dimensions}
                  variants={form.variants}
                  stockOnHand={form.stockOnHand}
                  basePrice={form.basePrice}
                  errors={errors}
                  lockStock={mode === 'edit'}
                  productSku={existing?.sku}
                  trackedSkus={trackedSkus}
                  onToggleHasVariants={on => update(on
                    ? { hasVariants: true }
                    : { hasVariants: false, dimensions: [], variants: [] })}
                  onDimensionsChange={(dimensions, variants) => update({ dimensions, variants })}
                  onVariantsChange={variants => update({ variants })}
                  onStockChange={stockOnHand => update({ stockOnHand })}
                />
              </>
            )}
            {section === 'images' && <ImagesSection form={form} update={update} />}
            {section === 'meta'   && <MetaSection form={form} update={update} />}
            {section === 'review' && <ReviewSection form={form} onSubmit={submit} dto={dtoPreview} saving={saving} />}
          </Card>

          {/* Section nav buttons */}
          {section !== 'review' && (
            <div className="flex items-center justify-between">
              <Button
                onClick={() => {
                  const idx = SECTIONS.findIndex(s => s.id === section);
                  if (idx > 0) setSection(SECTIONS[idx - 1].id);
                }}
                disabled={SECTIONS.findIndex(s => s.id === section) === 0}
              >
                Previous
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const idx = SECTIONS.findIndex(s => s.id === section);
                  if (idx < SECTIONS.length - 1) setSection(SECTIONS[idx + 1].id);
                }}
              >
                Next: {SECTIONS[SECTIONS.findIndex(s => s.id === section) + 1]?.label}
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        variant={confirm?.variant}
        loading={saving}
        onConfirm={async () => { await confirm?.onConfirm(); setConfirm(null); }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Section components (kept in the same file — closely coupled to form state)
// ────────────────────────────────────────────────────────────

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-serif text-2xl text-stone-900">{title}</h2>
      {hint && <p className="text-sm text-stone-500 mt-1">{hint}</p>}
    </div>
  );
}

function BasicsSection({
  form, update, errors, activeLocale, onLocaleChange,
}: {
  form: FormState;
  update: (p: Partial<FormState>) => void;
  errors: Record<string, string>;
  activeLocale: 'en' | 'tr' | 'so' | 'sw' | 'am';
  onLocaleChange: (l: 'en' | 'tr' | 'so' | 'sw' | 'am') => void;
}) {
  const localized = form.localizations[activeLocale] ?? {};
  const updateLocalized = (patch: Partial<{ name?: string; shortDescription?: string; description?: string }>) =>
    update({
      localizations: {
        ...form.localizations,
        [activeLocale]: { ...localized, ...patch },
      },
    });

  // English is the canonical source — when activeLocale is 'en', edits apply to the
  // top-level fields too (so DTO stays clean)
  const onNameChange = (v: string) => {
    if (activeLocale === 'en') update({ name: v, localizations: { ...form.localizations, en: { ...form.localizations.en, name: v } } });
    else updateLocalized({ name: v });
  };
  const onShortDescChange = (v: string) => {
    if (activeLocale === 'en') update({ shortDescription: v, localizations: { ...form.localizations, en: { ...form.localizations.en, shortDescription: v } } });
    else updateLocalized({ shortDescription: v });
  };
  const onDescChange = (v: string) => {
    if (activeLocale === 'en') update({ description: v, localizations: { ...form.localizations, en: { ...form.localizations.en, description: v } } });
    else updateLocalized({ description: v });
  };

  const fieldValues = activeLocale === 'en'
    ? { name: form.name, shortDescription: form.shortDescription, description: form.description }
    : { name: localized.name ?? '', shortDescription: localized.shortDescription ?? '', description: localized.description ?? '' };

  const localeStatus = (code: string) => {
    const loc = form.localizations[code as keyof LocalizedFields];
    if (!loc) return 'empty';
    if (loc.name && loc.shortDescription) return 'complete';
    if (loc.name) return 'partial';
    return 'empty';
  };

  return (
    <div>
      <SectionTitle title="Basics" hint="Core product information shown to buyers" />

      {/* Locale tabs */}
      <div className="mb-5">
        <div className="flex items-center gap-1 mb-2 text-xs text-stone-500">
          <Globe className="w-3.5 h-3.5" />
          Language
        </div>
        <div className="flex flex-wrap gap-1 p-1 bg-stone-100 rounded-md">
          {LOCALES.map(loc => {
            const status = localeStatus(loc.code);
            const isActive = activeLocale === loc.code;
            // Translations aren't supported by the API yet — only English is editable
            // so the form never collects data that would be silently dropped on save.
            const disabled = loc.code !== 'en';
            return (
              <button
                key={loc.code}
                onClick={() => !disabled && onLocaleChange(loc.code as any)}
                disabled={disabled}
                title={disabled ? 'Translations coming soon' : undefined}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors',
                  isActive ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-600 hover:text-stone-900',
                  disabled && 'opacity-40 cursor-not-allowed'
                )}
                type="button"
              >
                <span>{loc.flag}</span>
                <span>{loc.label}</span>
                {disabled && <span className="text-2xs text-stone-400">soon</span>}
                {!disabled && status === 'complete' && <Check className="w-3 h-3 text-brand-600" />}
                {!disabled && status === 'partial'  && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>
            );
          })}
        </div>
        <div className="text-2xs text-stone-500 mt-2">
          Additional languages are coming soon — products are published in English for now.
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Product name" required error={activeLocale === 'en' ? errors.name : undefined} className="sm:col-span-2">
          <Input value={fieldValues.name} onChange={e => onNameChange(e.target.value)} placeholder="Cotton kaftan, navy" />
        </Field>

        {activeLocale === 'en' && (
          <>
            <Field label="Category" hint="Used for buyer filtering">
              <Select value={form.categoryId} onChange={e => update({ categoryId: e.target.value })}>
                <option value="">— None —</option>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Brand">
              <Select value={form.brandId} onChange={e => update({ brandId: e.target.value })}>
                <option value="">— None —</option>
                {BRANDS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
          </>
        )}

        <Field
          label="Short description"
          hint={`${fieldValues.shortDescription.length}/500 characters`}
          error={activeLocale === 'en' ? errors.shortDescription : undefined}
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            value={fieldValues.shortDescription}
            onChange={e => onShortDescChange(e.target.value)}
            placeholder="One line that hooks the buyer."
            maxLength={500}
          />
        </Field>

        <Field label="Full description" hint="Markdown supported" className="sm:col-span-2">
          <Textarea
            rows={5}
            value={fieldValues.description}
            onChange={e => onDescChange(e.target.value)}
            placeholder="Materials, craftsmanship, story behind the product…"
          />
        </Field>
      </div>

      {activeLocale === 'en' && (
        <div className="mt-5 pt-5 border-t border-stone-200">
          <label className="flex items-center gap-2 text-sm text-stone-800 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={e => update({ isFeatured: e.target.checked })}
              className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-500"
            />
            Feature this product on the storefront
          </label>
          <p className="text-xs text-stone-500 mt-1 ml-6">Featured products appear in curated areas like the homepage.</p>
        </div>
      )}
    </div>
  );
}

function PricingSection({ form, update, errors }: { form: FormState; update: (p: Partial<FormState>) => void; errors: Record<string, string> }) {
  return (
    <div>
      <SectionTitle title="Pricing" hint="Set the base price — variant overrides come next" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Base price" required error={errors.basePrice}>
          <Input
            type="number" step="0.01" min="0"
            value={form.basePrice}
            onChange={e => update({ basePrice: e.target.value })}
            placeholder="0.00"
          />
        </Field>
        <Field label="Compare-at price" hint="Shown struck through" error={errors.compareAtPrice}>
          <Input
            type="number" step="0.01" min="0"
            value={form.compareAtPrice}
            onChange={e => update({ compareAtPrice: e.target.value })}
            placeholder="—"
          />
        </Field>
        <Field label="Currency">
          <Select value={form.currency} onChange={e => update({ currency: e.target.value })}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
    </div>
  );
}

// Thumbnail that falls back to a placeholder if the URL fails to load, instead
// of showing the browser's broken-image icon.
function ImageThumb({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-stone-400">
        <ImageOff className="w-6 h-6" />
        <span className="text-2xs">Image unavailable</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setErrored(true)} className="w-full h-full object-cover" />
  );
}

function ImagesSection({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const addImage = (url: string, altText: string) =>
    update({ images: [...form.images, { url, altText, isPrimary: form.images.length === 0, sortOrder: form.images.length }] });
  const removeImage = (i: number) => update({ images: form.images.filter((_, idx) => idx !== i) });
  const setPrimary = (i: number) => update({
    images: form.images.map((img, idx) => ({ ...img, isPrimary: idx === i })),
  });
  const updateAlt = (i: number, altText: string) => update({
    images: form.images.map((img, idx) => idx === i ? { ...img, altText } : img),
  });

  return (
    <div>
      <SectionTitle title="Images" hint="First image is the primary thumbnail" />
      {form.images.length === 0 ? (
        <button
          onClick={() => setModalOpen(true)}
          className="w-full py-12 border-2 border-dashed border-stone-300 rounded-lg text-sm text-stone-600 hover:border-brand-600 hover:text-brand-700 hover:bg-brand-50/50 transition-colors flex flex-col items-center gap-2"
          type="button"
        >
          <ImageIcon className="w-8 h-8 text-stone-400" />
          <div className="font-medium">Add an image URL</div>
          <div className="text-xs text-stone-500">Paste a link — we’ll preview it before adding</div>
        </button>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
            {form.images.map((img, i) => (
              <div key={i} className="border border-stone-200 rounded-lg overflow-hidden bg-stone-50">
                <div className="aspect-square bg-stone-100 grid place-items-center">
                  <ImageThumb src={img.url} alt={img.altText || ''} />
                </div>
                <div className="p-2">
                  <input
                    placeholder="Alt text"
                    value={img.altText || ''}
                    onChange={e => updateAlt(i, e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-white border border-stone-200 rounded outline-none focus:border-brand-600 mb-1.5"
                  />
                  <div className="flex items-center justify-between gap-1">
                    {img.isPrimary
                      ? <Badge variant="success">Primary</Badge>
                      : <button onClick={() => setPrimary(i)} className="text-2xs text-brand-700 hover:text-brand-800" type="button">Make primary</button>}
                    <button onClick={() => removeImage(i)} className="text-2xs text-red-600 hover:text-red-700" type="button">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setModalOpen(true)} className="text-xs text-brand-700 hover:text-brand-800 font-medium" type="button">+ Add another image</button>
        </>
      )}

      <ImageUrlModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={addImage} />
    </div>
  );
}

function MetaSection({ form, update }: { form: FormState; update: (p: Partial<FormState>) => void }) {
  const addAttr = () => update({ attributes: [...form.attributes, { key: '', value: '' }] });
  const updateAttr = (i: number, patch: Partial<ProductAttribute>) =>
    update({ attributes: form.attributes.map((a, idx) => idx === i ? { ...a, ...patch } : a) });
  const removeAttr = (i: number) => update({ attributes: form.attributes.filter((_, idx) => idx !== i) });

  return (
    <div>
      <SectionTitle title="SEO & attributes" hint="Metadata for search engines and structured details" />
      <div className="space-y-5">
        <Field label="Meta title" hint={`${form.metaTitle.length}/60 characters`}>
          <Input value={form.metaTitle} onChange={e => update({ metaTitle: e.target.value })} placeholder="Cotton Kaftan, Navy — Gaarsii" maxLength={60} />
        </Field>
        <Field label="Meta description" hint={`${form.metaDescription.length}/160 characters`}>
          <Textarea
            rows={2}
            value={form.metaDescription}
            onChange={e => update({ metaDescription: e.target.value })}
            placeholder="One-line summary for Google search results."
            maxLength={160}
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-stone-800">Custom attributes</label>
            <button onClick={addAttr} className="text-xs text-brand-700 hover:text-brand-800 font-medium" type="button">+ Add attribute</button>
          </div>
          {form.attributes.length === 0 ? (
            <div className="text-sm text-stone-500 text-center py-6 border border-dashed border-stone-200 rounded-md">
              No custom attributes yet — add things like material, origin, care instructions.
            </div>
          ) : (
            <div className="space-y-2">
              {form.attributes.map((a, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Input value={a.key} onChange={e => updateAttr(i, { key: e.target.value })} placeholder="Material" />
                  <Input value={a.value} onChange={e => updateAttr(i, { value: e.target.value })} placeholder="100% Turkish cotton" />
                  <button onClick={() => removeAttr(i)} className="text-stone-400 hover:text-red-600 p-2" type="button">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewSection({
  form, onSubmit, dto, saving,
}: {
  form: FormState;
  onSubmit: (status: 'draft' | 'active') => void;
  dto: any;
  saving?: boolean;
}) {
  return (
    <div>
      <SectionTitle title="Review & publish" hint="Final check before saving" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Summary label="Name"      value={form.name || '—'} />
        <Summary label="Status"    value={form.status} />
        <Summary label="Base price" value={form.basePrice ? `${form.basePrice} ${form.currency}` : '—'} />
        <Summary label="Variants"  value={form.hasVariants ? `${form.variants.length} variant${form.variants.length === 1 ? '' : 's'}` : 'Single SKU'} />
        <Summary label="Images"    value={`${form.images.length} image${form.images.length === 1 ? '' : 's'}`} />
        <Summary label="Languages" value={`${Object.keys(form.localizations).filter(k => form.localizations[k as keyof LocalizedFields]?.name).length} of ${LOCALES.length}`} />
      </div>

      <details className="border border-stone-200 rounded-lg mb-5">
        <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-stone-800 hover:bg-stone-50/50">
          Payload preview (what gets sent to the API)
        </summary>
        <pre className="p-4 bg-stone-900 text-stone-100 text-xs overflow-x-auto rounded-b-lg">
{JSON.stringify(dto, null, 2)}
        </pre>
      </details>

      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={() => onSubmit('draft')} disabled={saving}>Save as draft</Button>
        <Button variant="primary" onClick={() => onSubmit('active')} disabled={saving}>Publish product</Button>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-stone-200 rounded-md p-3">
      <div className="text-2xs text-stone-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-stone-900 mt-1">{value}</div>
    </div>
  );
}
