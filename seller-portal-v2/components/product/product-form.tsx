'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch, type SubmitHandler, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, AlertCircle, Save, Eye, ArrowLeft, FileText, ImageIcon, Tag as TagIcon, Hash, Layers, Globe, Loader2, Upload, GripVertical, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { Card } from '@/components/primitives/card';
import { Alert } from '@/components/primitives/alert';
import { Field, Input, Textarea, Select } from '@/components/primitives/field';
import { VariantsEditor } from '@/components/product/variants-editor';
import { ConfirmDialog } from '@/components/primitives/confirm-dialog';
import { CURRENCIES, LOCALES } from '@/lib/config/reference-data';
import { useGetCategoriesQuery, useGetBrandsQuery } from '@/lib/api/catalog-api';
import { useAiDraftProductMutation } from '@/lib/api/products-api';
import { inferDimensions, buildProductDto } from '@/lib/utils';
import {
  productFormSchema,
  type ProductFormValues,
  type ProductLocaleCode,
} from '@/lib/schemas/product';
import {
  useUploadFile,
  ALLOWED_UPLOAD_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  type AllowedUploadContentType,
} from '@/lib/api/uploads-api';
import type { Product, LocalizedFields, ProductVariant } from '@/lib/types';

// ────────────────────────────────────────────────────────────
// Section config
// ────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'basics',   label: 'Basics',           icon: FileText },
  { id: 'pricing',  label: 'Pricing',          icon: TagIcon  },
  { id: 'variants', label: 'Variants & stock', icon: Layers   },
  { id: 'images',   label: 'Images',           icon: ImageIcon },
  { id: 'meta',     label: 'SEO & attributes', icon: Hash     },
  { id: 'review',   label: 'Review & publish', icon: Check    },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

// Field name lists per section — used both for `trigger()` per-tab validation
// and for the "section has error" indicator in the sidebar.
const SECTION_FIELDS: Record<Exclude<SectionId, 'review'>, FieldPath<ProductFormValues>[]> = {
  basics:   ['name', 'shortDescription', 'description', 'categoryId', 'brandId', 'localizations', 'isFeatured'],
  pricing:  ['basePrice', 'compareAtPrice', 'currency'],
  variants: ['hasVariants', 'dimensions', 'variants', 'stockOnHand'],
  images:   ['images'],
  meta:     ['metaTitle', 'metaDescription', 'attributes'],
};

// ────────────────────────────────────────────────────────────
// Defaults / mapping helpers
// ────────────────────────────────────────────────────────────

const blankDefaults: ProductFormValues = {
  name: '',
  categoryId: '',
  brandId: '',
  shortDescription: '',
  description: '',
  tags: [],
  keywords: [],
  status: 'draft',
  isFeatured: false,
  condition: 'new',
  packageDimensionsCm: { length: '', width: '', height: '' },
  basePrice: '',
  compareAtPrice: '',
  currency: 'USD',
  hasVariants: false,
  stockOnHand: '',
  dimensions: [],
  variants: [],
  images: [],
  metaTitle: '',
  metaDescription: '',
  attributes: [],
  localizations: { en: {} },
};

// A populated category/brand ref comes back as { _id, name, ... }; an unpopulated
// one is a plain id string. Normalize to the id so the form <select> matches.
function refId(v: unknown): string {
  if (v && typeof v === 'object' && '_id' in (v as object)) return String((v as { _id: unknown })._id);
  return v ? String(v) : '';
}

function defaultsFromExisting(existing: Product): ProductFormValues {
  return {
    name: existing.name,
    categoryId: refId(existing.categoryId),
    brandId: refId(existing.brandId),
    shortDescription: existing.shortDescription ?? '',
    description: existing.description ?? '',
    tags: (existing as { tags?: string[] }).tags ?? [],
    keywords: (existing as { keywords?: string[] }).keywords ?? [],
    status: existing.status,
    isFeatured: !!existing.isFeatured,
    condition: (['new', 'used', 'refurbished'].includes((existing as any).condition)
      ? (existing as any).condition
      : 'new') as 'new' | 'used' | 'refurbished',
    packageDimensionsCm: {
      length: (existing as any).packageDimensionsCm?.length != null ? String((existing as any).packageDimensionsCm.length) : '',
      width: (existing as any).packageDimensionsCm?.width != null ? String((existing as any).packageDimensionsCm.width) : '',
      height: (existing as any).packageDimensionsCm?.height != null ? String((existing as any).packageDimensionsCm.height) : '',
    },
    basePrice: String(existing.basePrice ?? ''),
    compareAtPrice: existing.compareAtPrice != null ? String(existing.compareAtPrice) : '',
    currency: existing.currency || 'USD',
    hasVariants: !!existing.variants?.length,
    stockOnHand: existing.stock != null ? String(existing.stock) : '',
    dimensions: inferDimensions(existing.variants),
    variants: existing.variants || [],
    images: existing.images || [],
    metaTitle: existing.metaTitle ?? '',
    metaDescription: existing.metaDescription ?? '',
    attributes: existing.attributes || [],
    localizations: (existing.localizations as ProductFormValues['localizations']) || { en: {} },
  };
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

interface ProductFormProps {
  mode: 'new' | 'edit';
  existing?: Product;
  onSave: (dto: ReturnType<typeof buildProductDto>, status: 'draft' | 'active') => Promise<void> | void;
  saving?: boolean;
}

export function ProductForm({ mode, existing, onSave, saving }: ProductFormProps) {
  const router = useRouter();
  const [section, setSection] = useState<SectionId>('basics');
  const [activeLocale, setActiveLocale] = useState<ProductLocaleCode>('en');

  const defaultValues = useMemo<ProductFormValues>(
    () => (mode === 'edit' && existing ? defaultsFromExisting(existing) : blankDefaults),
    [mode, existing],
  );

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as never,
    defaultValues,
    mode: 'onBlur',
  });

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    watch,
    formState: { errors, isDirty },
  } = form;

  // Confirmation dialog — reused for "discard unsaved changes" and "publish
  // without images". Holds the action to run when the user confirms.
  const [confirm, setConfirm] = useState<null | {
    title: string;
    message?: string;
    confirmLabel?: string;
    variant?: 'primary' | 'danger';
    onConfirm: () => void | Promise<void>;
  }>(null);

  // Warn before losing unsaved edits on a hard browser navigation (refresh / close).
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Leaving the form (Cancel / Back) — confirm first if there are unsaved edits.
  const leave = () => {
    if (!isDirty) { router.push('/products'); return; }
    setConfirm({
      title: 'Discard unsaved changes?',
      message: "You have unsaved changes. If you leave now, they'll be lost.",
      confirmLabel: 'Discard changes',
      variant: 'danger',
      onConfirm: () => router.push('/products'),
    });
  };

  // Live preview of the DTO. `useWatch` keeps the whole form reactive without
  // forcing every section to re-render through prop drilling.
  const liveValues = useWatch({ control }) as ProductFormValues;

  const dtoPreview = useMemo(
    () => buildProductDto({ ...liveValues, status: liveValues.status ?? 'draft' }),
    [liveValues],
  );

  // ── Section helpers ──────────────────────────────────────
  const sectionHasError = (id: SectionId): boolean => {
    if (id === 'review') return false;
    return SECTION_FIELDS[id].some((field) => {
      // errors is a deeply nested object — dot-path check via reduce.
      const parts = String(field).split('.');
      let cur: unknown = errors;
      for (const p of parts) {
        if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[p];
        } else {
          cur = undefined;
          break;
        }
      }
      return !!cur;
    });
  };

  const sectionDone = (id: SectionId): boolean => {
    const v = liveValues;
    if (id === 'basics')   return !!v?.name;
    if (id === 'pricing')  return !!v?.basePrice;
    if (id === 'variants') return v?.hasVariants ? (v.dimensions.length > 0 && v.variants.length > 0) : true;
    if (id === 'images')   return (v?.images?.length ?? 0) > 0;
    if (id === 'meta')     return !!v?.metaTitle || (v?.attributes?.length ?? 0) > 0;
    return false;
  };

  // Only basics/pricing/variants gate publishing; images + SEO are optional, so the
  // meter reflects publish-readiness rather than "every section filled in".
  const REQUIRED_SECTIONS: SectionId[] = ['basics', 'pricing', 'variants'];
  const OPTIONAL_SECTIONS: SectionId[] = ['images', 'meta'];
  const requiredDone = REQUIRED_SECTIONS.filter((id) => sectionDone(id)).length;
  const readyToPublish = requiredDone === REQUIRED_SECTIONS.length;

  // Validate just the active tab's fields before navigating "Next".
  const goNext = async () => {
    const idx = SECTIONS.findIndex((s) => s.id === section);
    if (idx >= SECTIONS.length - 1) return;
    const id = SECTIONS[idx].id;
    if (id !== 'review') {
      const ok = await trigger(SECTION_FIELDS[id]);
      if (!ok) return;
    }
    setSection(SECTIONS[idx + 1].id);
  };

  const goPrev = () => {
    const idx = SECTIONS.findIndex((s) => s.id === section);
    if (idx > 0) setSection(SECTIONS[idx - 1].id);
  };

  // Submit: validate via RHF, then surface the right tab on failure.
  const buildSubmitHandler = (publishStatus: 'draft' | 'active'): SubmitHandler<ProductFormValues> =>
    async (values) => {
      // Soft guard: publishing with no images puts a placeholder live on the storefront.
      if (publishStatus === 'active' && (values.images?.length ?? 0) === 0) {
        setConfirm({
          title: 'Publish without images?',
          message: 'This product has no images, so buyers will see a placeholder thumbnail. You can publish now and add images later.',
          confirmLabel: 'Publish anyway',
          variant: 'primary',
          onConfirm: async () => { await onSave(buildProductDto({ ...values, status: 'active' }), 'active'); },
        });
        return;
      }
      const dto = buildProductDto({ ...values, status: publishStatus });
      await onSave(dto, publishStatus);
    };

  const submit = (publishStatus: 'draft' | 'active') => async () => {
    const handler = handleSubmit(buildSubmitHandler(publishStatus), (errs) => {
      // Jump to the first section that has an error.
      const firstSection = (Object.keys(SECTION_FIELDS) as (keyof typeof SECTION_FIELDS)[]).find((id) =>
        SECTION_FIELDS[id].some((f) => {
          const parts = String(f).split('.');
          let cur: unknown = errs;
          for (const p of parts) {
            if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
              cur = (cur as Record<string, unknown>)[p];
            } else {
              cur = undefined;
              break;
            }
          }
          return !!cur;
        }),
      );
      if (firstSection) setSection(firstSection);
    });
    await handler();
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <button
            type="button"
            onClick={leave}
            className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-2"
          >
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
          <Button variant="secondary" onClick={submit('draft')} disabled={saving}>
            <Save className="w-3.5 h-3.5" /> Save draft
          </Button>
          <Button variant="primary" onClick={submit('active')} disabled={saving}>
            <Eye className="w-3.5 h-3.5" /> {mode === 'new' ? 'Publish' : 'Save & publish'}
          </Button>
        </div>
      </div>

      {errorCount > 0 && (
        <Alert variant="danger" className="mb-4">
          <strong>{errorCount} issue{errorCount === 1 ? '' : 's'}</strong> need to be resolved before publishing.
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
                <div
                  className="h-full bg-brand-600 rounded-full transition-all"
                  style={{ width: `${(requiredDone / REQUIRED_SECTIONS.length) * 100}%` }}
                />
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
                      isActive ? 'bg-brand-50 text-brand-800 font-medium' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900',
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
                control={control}
                register={register}
                setValue={setValue}
                getValues={getValues}
                watch={watch}
                errors={errors}
                activeLocale={activeLocale}
                onLocaleChange={setActiveLocale}
              />
            )}
            {section === 'pricing'  && <PricingSection register={register} errors={errors} />}
            {section === 'variants' && (
              <>
                <SectionTitle title="Variants & stock" hint="Define your dimensions once — the variant grid generates from them" />
                <Controller
                  control={control}
                  name="hasVariants"
                  render={({ field: hasVariantsField }) => (
                    <Controller
                      control={control}
                      name="dimensions"
                      render={({ field: dimsField }) => (
                        <Controller
                          control={control}
                          name="variants"
                          render={({ field: varsField }) => (
                            <Controller
                              control={control}
                              name="stockOnHand"
                              render={({ field: stockField }) => (
                                <VariantsEditor
                                  productName={watch('name')}
                                  hasVariants={hasVariantsField.value}
                                  dimensions={dimsField.value}
                                  variants={varsField.value as ProductVariant[]}
                                  stockOnHand={stockField.value}
                                  basePrice={watch('basePrice')}
                                  errors={flattenVariantErrors(errors)}
                                  onToggleHasVariants={(on) => {
                                    hasVariantsField.onChange(on);
                                    if (!on) {
                                      dimsField.onChange([]);
                                      varsField.onChange([]);
                                    }
                                  }}
                                  onDimensionsChange={(dims, vars) => {
                                    dimsField.onChange(dims);
                                    varsField.onChange(vars);
                                  }}
                                  onVariantsChange={(vars) => varsField.onChange(vars)}
                                  onStockChange={(s) => stockField.onChange(s)}
                                />
                              )}
                            />
                          )}
                        />
                      )}
                    />
                  )}
                />
              </>
            )}
            {section === 'images' && <ImagesSection control={control} />}
            {section === 'meta'   && <MetaSection control={control} register={register} errors={errors} />}
            {section === 'review' && (
              <ReviewSection
                values={liveValues}
                dto={dtoPreview}
                onSubmit={(status) => submit(status)()}
                saving={saving}
              />
            )}
          </Card>

          {/* Section nav buttons */}
          {section !== 'review' && (
            <div className="flex items-center justify-between">
              <Button onClick={goPrev} disabled={SECTIONS.findIndex((s) => s.id === section) === 0}>
                Previous
              </Button>
              <Button variant="primary" onClick={goNext}>
                Next: {SECTIONS[SECTIONS.findIndex((s) => s.id === section) + 1]?.label}
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
    </form>
  );
}

// ────────────────────────────────────────────────────────────
// Section components
// ────────────────────────────────────────────────────────────

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-serif text-2xl text-stone-900">{title}</h2>
      {hint && <p className="text-sm text-stone-500 mt-1">{hint}</p>}
    </div>
  );
}

// Flatten RHF nested errors into the flat `{ variant_0_sku: '...' }` shape the
// existing VariantsEditor expects, so we don't touch that component.
function flattenVariantErrors(errors: Record<string, unknown>): Record<string, string> {
  const flat: Record<string, string> = {};
  const dims = (errors as { dimensions?: unknown }).dimensions;
  if (Array.isArray(dims)) {
    dims.forEach((d, i) => {
      if (!d) return;
      const dim = d as { name?: { message?: string }; values?: { message?: string } };
      if (dim.name?.message)   flat[`dim_${i}_name`]   = dim.name.message;
      if (dim.values?.message) flat[`dim_${i}_values`] = dim.values.message;
    });
  } else if (dims && typeof dims === 'object' && 'message' in dims) {
    flat.dimensions = (dims as { message?: string }).message || 'Add at least one dimension';
  }
  const vars = (errors as { variants?: unknown }).variants;
  if (Array.isArray(vars)) {
    vars.forEach((v, i) => {
      if (!v) return;
      const variant = v as { sku?: { message?: string } };
      if (variant.sku?.message) flat[`variant_${i}_sku`] = variant.sku.message;
    });
  } else if (vars && typeof vars === 'object' && 'message' in vars) {
    flat.variants = (vars as { message?: string }).message || 'No variants generated';
  }
  return flat;
}

// ── Basics ──────────────────────────────────────────────────

interface BasicsSectionProps {
  control: ReturnType<typeof useForm<ProductFormValues>>['control'];
  register: ReturnType<typeof useForm<ProductFormValues>>['register'];
  setValue: ReturnType<typeof useForm<ProductFormValues>>['setValue'];
  getValues: ReturnType<typeof useForm<ProductFormValues>>['getValues'];
  watch: ReturnType<typeof useForm<ProductFormValues>>['watch'];
  errors: Record<string, unknown>;
  activeLocale: ProductLocaleCode;
  onLocaleChange: (l: ProductLocaleCode) => void;
}

function BasicsSection({
  control, register, setValue, getValues, watch, errors, activeLocale, onLocaleChange,
}: BasicsSectionProps) {
  // Real categories/brands from the backend (replaces hard-coded reference-data).
  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: brands = [] } = useGetBrandsQuery();

  // ── AI assist: generate copy/tags/keywords + auto-assign the category ──
  const [aiDraft, { isLoading: aiLoading }] = useAiDraftProductMutation();
  const [brief, setBrief] = useState('');
  const [assignedPath, setAssignedPath] = useState('');
  const currentCategoryId = watch('categoryId');
  const aiTags = (watch('tags') ?? []) as string[];
  const aiKeywords = (watch('keywords') ?? []) as string[];
  // Prefer the AI-returned full path; fall back to the stored category's name (edit mode).
  const categoryDisplay =
    assignedPath || categories.find((c) => c._id === currentCategoryId)?.name || '';

  const runAi = async () => {
    const name = (getValues('name') || '').trim();
    if (!name) {
      toast.error('Enter a product name first — the AI builds everything from it.');
      return;
    }
    const attrs = (getValues('attributes') || []).filter((a) => a.key && a.value);
    const images = getValues('images') || [];
    const primary = images.find((i) => i.isPrimary) || images[0];
    const brandName = brands.find((b) => b._id === getValues('brandId'))?.name;
    try {
      const res = await aiDraft({
        name,
        brief: brief.trim() || undefined,
        brand: brandName,
        attributes: attrs.length ? attrs : undefined,
        imageUrl: primary?.url,
      }).unwrap();

      setValue('shortDescription', res.shortDescription, { shouldDirty: true, shouldValidate: true });
      setValue('description', res.description, { shouldDirty: true });
      setValue('tags', res.tags || [], { shouldDirty: true });
      setValue('keywords', res.keywords || [], { shouldDirty: true });
      // Mirror the generated copy into the canonical English localization.
      const cur = getValues('localizations') ?? { en: {} };
      setValue(
        'localizations',
        { ...cur, en: { ...(cur.en ?? {}), name, shortDescription: res.shortDescription, description: res.description } },
        { shouldDirty: true },
      );
      // Category is system-owned — set it from the AI, sellers can't change it.
      if (res.categoryId) setValue('categoryId', res.categoryId, { shouldDirty: true });
      setAssignedPath(res.categoryPath || '');
      toast.success('AI draft ready — review and tweak before publishing.');
    } catch (e) {
      const msg = (e as { data?: { message?: string } })?.data?.message;
      toast.error(msg || 'AI generation failed. Please try again.');
    }
  };
  // Watch the localizations object so the locale-status pills stay live.
  const localizations = (watch('localizations') ?? { en: {} }) as LocalizedFields;
  const enValues = {
    name: watch('name') ?? '',
    shortDescription: watch('shortDescription') ?? '',
    description: watch('description') ?? '',
  };

  const localized = localizations[activeLocale] ?? {};

  const setLocalized = (patch: Partial<{ name?: string; shortDescription?: string; description?: string }>) => {
    const current = getValues('localizations') ?? { en: {} };
    setValue(
      'localizations',
      {
        ...current,
        [activeLocale]: { ...(current[activeLocale] ?? {}), ...patch },
      },
      { shouldDirty: true, shouldValidate: false },
    );
  };

  // English is the canonical source — mirror edits to the top-level fields.
  const onNameChange = (v: string) => {
    if (activeLocale === 'en') {
      setValue('name', v, { shouldDirty: true, shouldValidate: true });
      setLocalized({ name: v });
    } else {
      setLocalized({ name: v });
    }
  };
  const onShortDescChange = (v: string) => {
    if (activeLocale === 'en') {
      setValue('shortDescription', v, { shouldDirty: true, shouldValidate: true });
      setLocalized({ shortDescription: v });
    } else {
      setLocalized({ shortDescription: v });
    }
  };
  const onDescChange = (v: string) => {
    if (activeLocale === 'en') {
      setValue('description', v, { shouldDirty: true, shouldValidate: false });
      setLocalized({ description: v });
    } else {
      setLocalized({ description: v });
    }
  };

  const fieldValues = activeLocale === 'en'
    ? enValues
    : {
        name: localized.name ?? '',
        shortDescription: localized.shortDescription ?? '',
        description: localized.description ?? '',
      };

  const localeStatus = (code: string): 'empty' | 'partial' | 'complete' => {
    const loc = localizations[code as keyof LocalizedFields];
    if (!loc) return 'empty';
    if (loc.name && loc.shortDescription) return 'complete';
    if (loc.name) return 'partial';
    return 'empty';
  };

  const nameError = (errors as { name?: { message?: string } }).name?.message;
  const shortDescError = (errors as { shortDescription?: { message?: string } }).shortDescription?.message;

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
          {LOCALES.map((loc) => {
            const status = localeStatus(loc.code);
            const isActive = activeLocale === loc.code;
            return (
              <button
                key={loc.code}
                onClick={() => onLocaleChange(loc.code as ProductLocaleCode)}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors',
                  isActive ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-600 hover:text-stone-900',
                )}
                type="button"
              >
                <span>{loc.flag}</span>
                <span>{loc.label}</span>
                {status === 'complete' && <Check className="w-3 h-3 text-brand-600" />}
                {status === 'partial'  && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>
            );
          })}
        </div>
        {activeLocale !== 'en' && (
          <div className="text-2xs text-stone-500 mt-2">
            Editing the {LOCALES.find((l) => l.code === activeLocale)?.label} translation. Empty fields fall back to English.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Product name"
          required
          error={activeLocale === 'en' ? nameError : undefined}
          className="sm:col-span-2"
        >
          <Input
            value={fieldValues.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Cotton kaftan, navy"
          />
        </Field>

        {activeLocale === 'en' && (
          <div className="sm:col-span-2 rounded-lg border border-brand-200 bg-brand-50/60 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-medium text-stone-900">AI product assistant</span>
            </div>
            <p className="text-xs text-stone-600 mb-3">
              From the name (plus any note, brand, attributes or photo you add), the assistant writes
              the description, tags and keywords, and assigns the best category automatically.
            </p>
            <Textarea
              rows={2}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Optional note — colour, material, size, key features, who it's for…"
              className="mb-3"
            />
            <Button type="button" onClick={runAi} disabled={aiLoading || !fieldValues.name.trim()}>
              {aiLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate with AI</>
              )}
            </Button>
          </div>
        )}

        {activeLocale === 'en' && (
          <>
            <Field label="Category" hint="Assigned automatically by AI — buyers browse by this">
              <div className="flex items-center min-h-[2.5rem] px-3 py-2 rounded-md border border-stone-200 bg-stone-50 text-sm">
                {categoryDisplay ? (
                  <span className="inline-flex items-center gap-1.5 text-stone-800">
                    <Sparkles className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                    <span className="truncate">{categoryDisplay}</span>
                  </span>
                ) : (
                  <span className="text-stone-400">Assigned when you generate with AI</span>
                )}
              </div>
            </Field>
            <Field label="Brand">
              <Select {...register('brandId')}>
                <option value="">— None —</option>
                {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </Select>
            </Field>
          </>
        )}

        <Field
          label="Short description"
          hint={`${fieldValues.shortDescription.length}/500 characters`}
          error={activeLocale === 'en' ? shortDescError : undefined}
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            value={fieldValues.shortDescription}
            onChange={(e) => onShortDescChange(e.target.value)}
            placeholder="One line that hooks the buyer."
            maxLength={500}
          />
        </Field>

        <Field label="Full description" hint="Markdown supported" className="sm:col-span-2">
          <Textarea
            rows={5}
            value={fieldValues.description}
            onChange={(e) => onDescChange(e.target.value)}
            placeholder="Materials, craftsmanship, story behind the product…"
          />
        </Field>

        {activeLocale === 'en' && (aiTags.length > 0 || aiKeywords.length > 0) && (
          <div className="sm:col-span-2 space-y-2">
            {aiTags.length > 0 && (
              <div>
                <div className="text-xs text-stone-500 mb-1.5">Tags (AI-generated)</div>
                <div className="flex flex-wrap gap-1.5">
                  {aiTags.map((t) => (
                    <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {aiKeywords.length > 0 && (
              <div>
                <div className="text-xs text-stone-500 mb-1.5">Search keywords (AI-generated)</div>
                <div className="flex flex-wrap gap-1.5">
                  {aiKeywords.map((k) => (
                    <span key={k} className="inline-flex items-center px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 text-xs">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {activeLocale === 'en' && (
        <div className="mt-5 pt-5 border-t border-stone-200">
          <label className="flex items-center gap-2 text-sm text-stone-800 cursor-pointer">
            <input
              type="checkbox"
              {...register('isFeatured')}
              className="w-4 h-4 rounded border-stone-300 text-brand-700 focus:ring-brand-500"
            />
            Feature this product on the storefront
          </label>
          <p className="text-xs text-stone-500 mt-1 ml-6">Featured products appear in curated areas like the homepage.</p>
        </div>
      )}
      {activeLocale === 'en' && (
        <div className="mt-5 pt-5 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-800 mb-1">Condition</label>
            <Select {...register('condition')}>
              <option value="new">New</option>
              <option value="used">Used</option>
              <option value="refurbished">Refurbished</option>
            </Select>
            <p className="text-xs text-stone-500 mt-1">Gender, colour &amp; material are detected automatically.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-800 mb-1">Package size — cm (optional)</label>
            <div className="flex gap-2">
              {(['length', 'width', 'height'] as const).map((k) => (
                <input
                  key={k}
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder={k.charAt(0).toUpperCase()}
                  {...register(`packageDimensionsCm.${k}` as const)}
                  className="w-full px-2 py-1.5 text-sm border border-stone-300 rounded outline-none focus:border-brand-600"
                />
              ))}
            </div>
            <p className="text-xs text-stone-500 mt-1">L × W × H — used for accurate shipping rates.</p>
          </div>
        </div>
      )}
      {/* Silence unused-deps lint — control reserved for future Controllers. */}
      {void control}
    </div>
  );
}

// ── Pricing ─────────────────────────────────────────────────

function PricingSection({
  register, errors,
}: {
  register: ReturnType<typeof useForm<ProductFormValues>>['register'];
  errors: Record<string, unknown>;
}) {
  const basePriceError = (errors as { basePrice?: { message?: string } }).basePrice?.message;
  const compareError   = (errors as { compareAtPrice?: { message?: string } }).compareAtPrice?.message;

  return (
    <div>
      <SectionTitle title="Pricing" hint="Set the base price — variant overrides come next" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Base price" required error={basePriceError}>
          <Input type="number" step="0.01" min="0" placeholder="0.00" {...register('basePrice')} />
        </Field>
        <Field label="Compare-at price" hint="Shown struck through" error={compareError}>
          <Input type="number" step="0.01" min="0" placeholder="—" {...register('compareAtPrice')} />
        </Field>
        <Field label="Currency">
          <Select {...register('currency')}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      </div>
    </div>
  );
}

// ── Images ──────────────────────────────────────────────────

/**
 * An in-progress upload tile, keyed by a stable client ID so the user can see
 * progress + a friendly preview (via a local object URL) while the bytes are
 * being PUT to storage. These never enter form state — only the resulting
 * `publicUrl` does, once the upload resolves.
 */
interface PendingUpload {
  id: string;
  previewUrl: string;
  fileName: string;
}

function ImagesSection({
  control,
}: {
  control: ReturnType<typeof useForm<ProductFormValues>>['control'];
}) {
  const { uploadFile } = useUploadFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Live variant dimensions → per-image "Applies to" options (color/material/…).
  const variantDims = (
    (useWatch({ control, name: 'dimensions' }) as { name: string; values: string[] }[] | undefined) || []
  ).filter((d) => d?.name?.trim() && d.values?.length);

  // ALLOWED_UPLOAD_CONTENT_TYPES is a tuple of literal strings; produce a comma-
  // separated `accept` attribute and a readable label for error messages.
  const acceptAttr = ALLOWED_UPLOAD_CONTENT_TYPES.join(',');
  const acceptLabel = ALLOWED_UPLOAD_CONTENT_TYPES
    .map((t) => t.replace('image/', '').toUpperCase())
    .join(', ');

  return (
    <Controller
      control={control}
      name="images"
      render={({ field }) => {
        const images = field.value;

        const removeImage = (i: number) =>
          field.onChange(
            images
              .filter((_, idx) => idx !== i)
              // If the removed tile was primary, promote the new first image.
              .map((img, idx, arr) => ({
                ...img,
                isPrimary: arr.some((x) => x.isPrimary) ? img.isPrimary : idx === 0,
                sortOrder: idx,
              })),
          );

        const setPrimary = (i: number) =>
          field.onChange(images.map((img, idx) => ({ ...img, isPrimary: idx === i })));

        const updateAlt = (i: number, altText: string) =>
          field.onChange(images.map((img, idx) => (idx === i ? { ...img, altText } : img)));

        // Which variant(s) an image represents (color/material/…). Single-dimension
        // selection covers the common case; empty = shared across all variants.
        const updateAppliesTo = (i: number, appliesTo: { name: string; value: string }[]) =>
          field.onChange(images.map((img, idx) => (idx === i ? { ...img, appliesTo } : img)));

        const reorder = (from: number, to: number) => {
          if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return;
          const next = images.slice();
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          field.onChange(next.map((img, idx) => ({ ...img, sortOrder: idx })));
        };

        const validateFile = (file: File): string | null => {
          if (!ALLOWED_UPLOAD_CONTENT_TYPES.includes(file.type as AllowedUploadContentType)) {
            return `${file.name}: unsupported type. Allowed: ${acceptLabel}.`;
          }
          if (file.size > MAX_UPLOAD_BYTES) {
            return `${file.name}: file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`;
          }
          return null;
        };

        const handleFiles = async (files: FileList | File[]) => {
          const list = Array.from(files);
          for (const file of list) {
            const validationErr = validateFile(file);
            if (validationErr) {
              toast.error(validationErr);
              continue;
            }

            // Track a pending tile so the user gets immediate feedback.
            const tempId =
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const previewUrl = URL.createObjectURL(file);
            const tile: PendingUpload = { id: tempId, previewUrl, fileName: file.name };
            setPending((prev) => [...prev, tile]);

            try {
              const publicUrl = await uploadFile(file, { scope: 'product' });
              // Append to form state. We read the latest value from `field` —
              // note React's stale-closure pitfall: read images via getValues
              // would be safer in a tight loop, but the form preserves order
              // since each await yields back to React before the next file.
              const current = (field.value ?? []) as typeof images;
              field.onChange([
                ...current,
                {
                  url: publicUrl,
                  altText: '',
                  isPrimary: current.length === 0,
                  sortOrder: current.length,
                },
              ]);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Upload failed.';
              toast.error(message);
            } finally {
              URL.revokeObjectURL(previewUrl);
              setPending((prev) => prev.filter((p) => p.id !== tempId));
            }
          }
        };

        const onSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
          const files = e.target.files;
          if (!files || files.length === 0) return;
          void handleFiles(files);
          // Reset the input so selecting the same file again re-triggers change.
          e.target.value = '';
        };

        const onDropFiles = (e: React.DragEvent<HTMLElement>) => {
          // Distinguish "user dragged a file from desktop" (has dataTransfer.files)
          // from "user dragged an existing tile to reorder" (handled per-tile).
          e.preventDefault();
          const files = e.dataTransfer?.files;
          if (files && files.length > 0) {
            void handleFiles(files);
          }
        };

        const openPicker = () => fileInputRef.current?.click();

        const hasContent = images.length > 0 || pending.length > 0;

        return (
          <div>
            <SectionTitle title="Images" hint="First image is the primary thumbnail · drag tiles to reorder" />

            <input
              ref={fileInputRef}
              type="file"
              accept={acceptAttr}
              multiple
              onChange={onSelectFiles}
              className="hidden"
              aria-label="Upload product images"
            />

            {!hasContent ? (
              <button
                onClick={openPicker}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropFiles}
                className="w-full py-12 border-2 border-dashed border-stone-300 rounded-lg text-sm text-stone-600 hover:border-brand-600 hover:text-brand-700 hover:bg-brand-50/50 transition-colors flex flex-col items-center gap-2"
                type="button"
              >
                <Upload className="w-8 h-8 text-stone-400" aria-hidden="true" />
                <div className="font-medium">Click to upload or drop images</div>
                <div className="text-xs text-stone-500">
                  {acceptLabel} · up to {Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB
                </div>
              </button>
            ) : (
              <>
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-3"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDropFiles}
                >
                  {images.map((img, i) => (
                    <div
                      key={`${img.url}-${i}`}
                      draggable
                      onDragStart={(e) => {
                        setDragIndex(i);
                        e.dataTransfer.effectAllowed = 'move';
                        // Some browsers require a payload to start a drag.
                        e.dataTransfer.setData('text/plain', String(i));
                      }}
                      onDragOver={(e) => {
                        if (dragIndex !== null) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        // Reorder only if this is a tile drag, not a file drop.
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (dragIndex === null) return;
                        reorder(dragIndex, i);
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      className={clsx(
                        'border border-stone-200 rounded-lg overflow-hidden bg-stone-50 transition-opacity',
                        dragIndex === i && 'opacity-50',
                      )}
                    >
                      <div className="relative aspect-square bg-stone-100 grid place-items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.altText || ''} className="w-full h-full object-cover" />
                        <div
                          className="absolute top-1.5 left-1.5 bg-white/80 backdrop-blur rounded p-1 text-stone-500 cursor-grab active:cursor-grabbing"
                          aria-hidden="true"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-3 h-3" />
                        </div>
                      </div>
                      <div className="p-2">
                        <input
                          placeholder="Alt text"
                          value={img.altText || ''}
                          onChange={(e) => updateAlt(i, e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-white border border-stone-200 rounded outline-none focus:border-brand-600 mb-1.5"
                        />
                        {variantDims.length > 0 && (
                          <div className="mb-1.5 space-y-1" title="Which variant(s) does this image show? Leave a dimension on 'any' to not constrain it.">
                            {variantDims.map((d) => {
                              const cur = img.appliesTo?.find((a) => a.name === d.name)?.value || '';
                              return (
                                <select
                                  key={d.name}
                                  value={cur}
                                  onChange={(e) => {
                                    const rest = (img.appliesTo || []).filter((a) => a.name !== d.name);
                                    updateAppliesTo(i, e.target.value ? [...rest, { name: d.name, value: e.target.value }] : rest);
                                  }}
                                  className="w-full px-2 py-1 text-xs bg-white border border-stone-200 rounded outline-none focus:border-brand-600"
                                >
                                  <option value="">{d.name}: any</option>
                                  {d.values.map((v) => (
                                    <option key={v} value={v}>{d.name}: {v}</option>
                                  ))}
                                </select>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-1">
                          {img.isPrimary
                            ? <Badge variant="success">Primary</Badge>
                            : <button onClick={() => setPrimary(i)} className="text-2xs text-brand-700 hover:text-brand-800" type="button">Make primary</button>}
                          <button onClick={() => removeImage(i)} className="text-2xs text-red-600 hover:text-red-700" type="button">Remove</button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {pending.map((p) => (
                    <div key={p.id} className="border border-stone-200 rounded-lg overflow-hidden bg-stone-50">
                      <div className="relative aspect-square bg-stone-100 grid place-items-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.previewUrl} alt="" className="w-full h-full object-cover opacity-60" />
                        <div className="absolute inset-0 grid place-items-center bg-stone-900/30">
                          <div className="flex flex-col items-center gap-1.5 text-white">
                            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                            <span className="text-2xs font-medium">Uploading…</span>
                          </div>
                        </div>
                      </div>
                      <div className="p-2">
                        <div className="text-2xs text-stone-500 truncate" title={p.fileName}>
                          {p.fileName}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={openPicker}
                  className="text-xs text-brand-700 hover:text-brand-800 font-medium"
                  type="button"
                >
                  + Add more images
                </button>
              </>
            )}
          </div>
        );
      }}
    />
  );
}


// ── SEO + attributes ────────────────────────────────────────

function MetaSection({
  control, register, errors,
}: {
  control: ReturnType<typeof useForm<ProductFormValues>>['control'];
  register: ReturnType<typeof useForm<ProductFormValues>>['register'];
  errors: Record<string, unknown>;
}) {
  const metaTitleValue       = useWatch({ control, name: 'metaTitle' }) ?? '';
  const metaDescriptionValue = useWatch({ control, name: 'metaDescription' }) ?? '';
  const metaTitleError       = (errors as { metaTitle?: { message?: string } }).metaTitle?.message;
  const metaDescError        = (errors as { metaDescription?: { message?: string } }).metaDescription?.message;

  return (
    <div>
      <SectionTitle title="SEO & attributes" hint="Metadata for search engines and structured details" />
      <div className="space-y-5">
        <Field label="Meta title" hint={`${metaTitleValue.length}/60 characters`} error={metaTitleError}>
          <Input placeholder="Cotton Kaftan, Navy — Gaarsii" maxLength={60} {...register('metaTitle')} />
        </Field>
        <Field
          label="Meta description"
          hint={`${metaDescriptionValue.length}/160 characters`}
          error={metaDescError}
        >
          <Textarea
            rows={2}
            placeholder="One-line summary for Google search results."
            maxLength={160}
            {...register('metaDescription')}
          />
        </Field>

        <Controller
          control={control}
          name="attributes"
          render={({ field }) => {
            const attrs = field.value;
            const addAttr = () => field.onChange([...attrs, { key: '', value: '' }]);
            const updateAttr = (i: number, patch: { key?: string; value?: string }) =>
              field.onChange(attrs.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
            const removeAttr = (i: number) => field.onChange(attrs.filter((_, idx) => idx !== i));

            return (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-stone-800">Custom attributes</label>
                  <button onClick={addAttr} className="text-xs text-brand-700 hover:text-brand-800 font-medium" type="button">
                    + Add attribute
                  </button>
                </div>
                {attrs.length === 0 ? (
                  <div className="text-sm text-stone-500 text-center py-6 border border-dashed border-stone-200 rounded-md">
                    No custom attributes yet — add things like material, origin, care instructions.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {attrs.map((a, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <Input value={a.key} onChange={(e) => updateAttr(i, { key: e.target.value })} placeholder="Material" />
                        <Input value={a.value} onChange={(e) => updateAttr(i, { value: e.target.value })} placeholder="100% Turkish cotton" />
                        <button
                          onClick={() => removeAttr(i)}
                          className="text-stone-400 hover:text-red-600 p-2"
                          type="button"
                          aria-label={a.key ? `Remove attribute ${a.key}` : 'Remove attribute'}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

// ── Review ──────────────────────────────────────────────────

function ReviewSection({
  values, dto, onSubmit, saving,
}: {
  values: ProductFormValues;
  dto: ReturnType<typeof buildProductDto>;
  onSubmit: (status: 'draft' | 'active') => void;
  saving?: boolean;
}) {
  const localizations = values.localizations ?? { en: {} };
  const languagesFilled = Object.keys(localizations).filter(
    (k) => localizations[k as keyof LocalizedFields]?.name,
  ).length;

  return (
    <div>
      <SectionTitle title="Review & publish" hint="Final check before saving" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Summary label="Name"       value={values.name || '—'} />
        <Summary label="Status"     value={values.status} />
        <Summary label="Base price" value={values.basePrice ? `${values.basePrice} ${values.currency}` : '—'} />
        <Summary
          label="Variants"
          value={values.hasVariants ? `${values.variants.length} variant${values.variants.length === 1 ? '' : 's'}` : 'Single SKU'}
        />
        <Summary label="Images"    value={`${values.images.length} image${values.images.length === 1 ? '' : 's'}`} />
        <Summary label="Languages" value={`${languagesFilled} of ${LOCALES.length}`} />
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
