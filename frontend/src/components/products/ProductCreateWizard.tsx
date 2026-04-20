"use client";
import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useRouter } from "next/navigation";
import {
  Button, Input, Textarea, Select, Card, CardHeader, Stepper, Badge, StatusBadge,
} from "../ui";
import {
  useCreateProductMutation, useUpdateProductMutation,
  useGetCategoryTreeQuery, useGetBrandsQuery,
} from "../../store/api/productsApi";
import { useAdjustStockMutation } from "../../store/api/endpointsApi";
import type { CreateProductRequest, Category } from "../../types";
import { generateSku } from "../../lib/utils";

// ─── Step definitions ───
const STEPS = [
  { label: "Basic Info", description: "Name, description, category" },
  { label: "Pricing", description: "Prices and currency" },
  { label: "Variants", description: "Options and SKUs" },
  { label: "Images", description: "Product photos" },
  { label: "Attributes", description: "Specs and SEO" },
  { label: "Inventory", description: "Initial stock" },
  { label: "Review", description: "Publish product" },
];

// ─── Form data shape ───
interface ProductFormData {
  name: string;
  shortDescription: string;
  description: string;
  categoryId: string;
  brandId: string;
  basePrice: number;
  compareAtPrice?: number;
  currency: string;
  metaTitle: string;
  metaDescription: string;
}

interface OptionType {
  name: string;
  values: string[];
}

interface VariantRow {
  sku: string;
  name: string;
  options: { name: string; value: string }[];
  priceOverride: string;
  costPrice: string;
  weightGrams: string;
}

interface ImageItem {
  url: string;
  altText: string;
  isPrimary: boolean;
  file?: File;
  preview?: string;
}

interface AttributeRow {
  key: string;
  value: string;
}

export default function ProductCreateWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [productId, setProductId] = useState<string | null>(null);

  // RTK Query mutations
  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const [adjustStock] = useAdjustStockMutation();

  // Data queries
  const { data: categories = [] } = useGetCategoryTreeQuery();
  const { data: brands = [] } = useGetBrandsQuery();

  // Form state
  const { register, handleSubmit, watch, formState: { errors }, getValues, trigger } = useForm<ProductFormData>({
    defaultValues: {
      name: "", shortDescription: "", description: "",
      categoryId: "", brandId: "", basePrice: 0,
      currency: "USD", metaTitle: "", metaDescription: "",
    },
  });

  // Variants state
  const [optionTypes, setOptionTypes] = useState<OptionType[]>([]);
  const [newOptName, setNewOptName] = useState("");
  const [newOptValues, setNewOptValues] = useState("");
  const [variants, setVariants] = useState<VariantRow[]>([]);

  // Images state
  const [images, setImages] = useState<ImageItem[]>([]);

  // Attributes state
  const [attributes, setAttributes] = useState<AttributeRow[]>([{ key: "", value: "" }]);

  // Inventory state
  const [inventory, setInventory] = useState<Record<string, number>>({});

  // ─── Flatten category tree for select ───
  const flattenCategories = (cats: Category[], depth = 0): { value: string; label: string }[] => {
    return cats.flatMap((cat) => [
      { value: cat._id, label: `${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}${cat.name}` },
      ...(cat.children ? flattenCategories(cat.children, depth + 1) : []),
    ]);
  };

  // ─── Variant generation ───
  const addOptionType = () => {
    if (!newOptName || !newOptValues) return;
    const values = newOptValues.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) return;
    setOptionTypes((prev) => [...prev, { name: newOptName, values }]);
    setNewOptName("");
    setNewOptValues("");
  };

  const generateVariants = () => {
    if (optionTypes.length === 0) return;
    const combos = optionTypes.reduce<{ name: string; value: string }[][]>(
      (acc, opt) => {
        if (acc.length === 0) return opt.values.map((v) => [{ name: opt.name, value: v }]);
        return acc.flatMap((combo) => opt.values.map((v) => [...combo, { name: opt.name, value: v }]));
      }, [],
    );

    const productName = getValues("name") || "PROD";
    const generated = combos.map((combo) => ({
      name: combo.map((c) => c.value).join(" / "),
      sku: generateSku(productName, combo.map((c) => c.value)),
      options: combo,
      priceOverride: "",
      costPrice: "",
      weightGrams: "",
    }));
    setVariants(generated);

    const inv: Record<string, number> = {};
    generated.forEach((v) => { inv[v.sku] = 0; });
    setInventory(inv);
  };

  // ─── Image handling ───
  const fileInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.value = "";
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const preview = URL.createObjectURL(file);
      const isPrimary = images.length === 0;
      setImages((prev) => [...prev, {
        url: preview,
        altText: file.name.replace(/\.[^/.]+$/, ""),
        isPrimary: prev.length === 0,
        file,
        preview,
      }]);
    });

    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const addImage = () => {
    // Trigger the hidden file input
    const input = document.getElementById("product-image-input") as HTMLInputElement;
    input?.click();
  };

  const setPrimaryImage = (index: number) => {
    setImages((prev) => prev.map((img, i) => ({ ...img, isPrimary: i === index })));
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((img) => img.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  };

  // ─── Step navigation ───
  const markCompleted = (step: number) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  };

  const goNext = async () => {
    // Validate current step before proceeding
    let isValid = true;

    if (currentStep === 0) {
      isValid = await trigger(["name", "categoryId"]);
      if (isValid) {
        // Save draft on first step
        if (!productId) {
          try {
            const result = await createProduct({
              name: getValues("name"),
              description: getValues("description"),
              shortDescription: getValues("shortDescription"),
              categoryId: getValues("categoryId") || undefined,
              brandId: getValues("brandId") || undefined,
              status: "draft",
              basePrice: 0,
            }).unwrap();
            setProductId(result._id);
          } catch (err) {
            console.error("Failed to create product draft", err);
            return;
          }
        } else {
          await saveCurrentStep();
        }
      }
    } else if (currentStep === 1) {
      isValid = await trigger(["basePrice"]);
      if (isValid) await saveCurrentStep();
    } else if (currentStep === 2) {
      if (variants.length === 0) {
        // Allow skipping variants (simple product)
      }
      await saveCurrentStep();
    } else if (currentStep === 3) {
      await saveCurrentStep();
    } else if (currentStep === 4) {
      await saveCurrentStep();
    } else if (currentStep === 5) {
      await saveInventory();
    }

    if (isValid) {
      markCompleted(currentStep);
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const goPrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const saveCurrentStep = async () => {
    if (!productId) return;

    const data: Partial<CreateProductRequest> = {};

    switch (currentStep) {
      case 0:
        data.name = getValues("name");
        data.description = getValues("description");
        data.shortDescription = getValues("shortDescription");
        data.categoryId = getValues("categoryId") || undefined;
        data.brandId = getValues("brandId") || undefined;
        break;
      case 1:
        data.basePrice = Number(getValues("basePrice"));
        data.compareAtPrice = getValues("compareAtPrice") ? Number(getValues("compareAtPrice")) : undefined;
        data.currency = getValues("currency");
        break;
      case 2:
        data.variants = variants.map((v) => ({
          sku: v.sku,
          name: v.name,
          options: v.options,
          priceOverride: v.priceOverride ? Number(v.priceOverride) : undefined,
          costPrice: v.costPrice ? Number(v.costPrice) : undefined,
          weightGrams: v.weightGrams ? Number(v.weightGrams) : undefined,
          isActive: true,
          sortOrder: 0,
        }));
        break;
      case 3:
        data.images = images.map((img, i) => ({
          url: img.url,
          altText: img.altText,
          isPrimary: img.isPrimary,
          sortOrder: i,
        }));
        break;
      case 4:
        data.attributes = attributes.filter((a) => a.key && a.value);
        data.metaTitle = getValues("metaTitle") || undefined;
        data.metaDescription = getValues("metaDescription") || undefined;
        break;
    }

    try {
      await updateProduct({ id: productId, data }).unwrap();
    } catch (err) {
      console.error("Failed to save step", err);
    }
  };

  const saveInventory = async () => {
    for (const [sku, qty] of Object.entries(inventory)) {
      if (qty > 0) {
        try {
          await adjustStock({ variantSku: sku, quantity: qty, notes: "Initial stock" }).unwrap();
        } catch (err) {
          console.error(`Failed to set stock for ${sku}`, err);
        }
      }
    }
  };

  const publishProduct = async () => {
    if (!productId) return;
    try {
      await updateProduct({ id: productId, data: { status: "active" } }).unwrap();
      router.push("/dashboard/products");
    } catch (err) {
      console.error("Failed to publish", err);
    }
  };

  // ─── Completeness check ───
  const canPublish =
    getValues("name") &&
    Number(getValues("basePrice")) > 0 &&
    images.length > 0 &&
    images.some((img) => img.isPrimary);

  // ─── Step content renderers ───
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card>
            <div className="space-y-4">
              <Input label="Product Name" required placeholder="e.g. Premium Cotton Hoodie"
                {...register("name", { required: "Product name is required" })} error={errors.name?.message} />
              <Input label="Short Description" placeholder="Brief summary for search results"
                {...register("shortDescription")} />
              <Textarea label="Full Description" placeholder="Detailed product description with materials, features..." rows={5}
                {...register("description")} />
              <div className="grid grid-cols-2 gap-4">
                <Select label="Category" required placeholder="Select category..."
                  options={flattenCategories(categories)} {...register("categoryId", { required: "Category is required" })}
                  error={errors.categoryId?.message} />
                <Select label="Brand" placeholder="Select brand..."
                  options={brands.map((b) => ({ value: b._id, label: b.name }))} {...register("brandId")} />
              </div>
            </div>
          </Card>
        );

      case 1:
        return (
          <Card>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Input label="Base Price" required type="number" step="0.01" placeholder="0.00"
                  {...register("basePrice", { required: "Price is required", min: { value: 0.01, message: "Must be > 0" } })}
                  error={errors.basePrice?.message} />
                <Input label="Compare-at Price" type="number" step="0.01" placeholder="0.00"
                  hint="Shown as strikethrough" {...register("compareAtPrice")} />
                <Select label="Currency" options={[
                  { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" },
                  { value: "GBP", label: "GBP" }, { value: "TRY", label: "TRY" },
                ]} {...register("currency")} />
              </div>
              {watch("basePrice") > 0 && watch("compareAtPrice") && Number(watch("compareAtPrice")) > Number(watch("basePrice")) && (
                <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-[10px] text-emerald-700 font-medium">
                  {Math.round((1 - Number(watch("basePrice")) / Number(watch("compareAtPrice"))) * 100)}% discount — Customer sees:{" "}
                  <span className="line-through text-gray-400">${watch("compareAtPrice")}</span> ${watch("basePrice")}
                </div>
              )}
            </div>
          </Card>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Card>
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Option Types</h4>
                {optionTypes.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
                    <span className="text-[10px] font-semibold text-gray-700 w-16">{opt.name}</span>
                    <div className="flex-1 flex gap-1 flex-wrap">
                      {opt.values.map((v) => (
                        <Badge key={v} variant="info">{v}</Badge>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setOptionTypes((prev) => prev.filter((_, j) => j !== i));
                      setVariants([]);
                    }}>Remove</Button>
                  </div>
                ))}

                <div className="flex gap-2 items-end">
                  <Input label="Option Name" placeholder="e.g. Color" value={newOptName}
                    onChange={(e) => setNewOptName(e.target.value)} className="w-36" />
                  <Input label="Values (comma-separated)" placeholder="e.g. Black, Red, Navy"
                    value={newOptValues} onChange={(e) => setNewOptValues(e.target.value)} />
                  <Button variant="secondary" onClick={addOptionType}>+ Add</Button>
                </div>

                {optionTypes.length > 0 && (
                  <Button variant="primary" onClick={generateVariants}>
                    Generate {optionTypes.reduce((a, o) => a * o.values.length, 1)} Variants
                  </Button>
                )}
              </div>
            </Card>

            {variants.length > 0 && (
              <Card padding={false}>
                <CardHeader>Generated Variants ({variants.length})</CardHeader>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Variant", "SKU", "Price Override ($)", "Cost ($)", "Weight (g)"].map((h) => (
                        <th key={h} className="text-left px-4 py-2 text-[8px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2 text-[10px] font-medium text-gray-700">{v.name}</td>
                        <td className="px-4 py-2">
                          <input className="w-28 px-2 py-1 rounded bg-gray-50 border border-gray-200 text-[9px] font-mono text-indigo-600 focus:outline-none focus:border-indigo-300"
                            value={v.sku} onChange={(e) => { const n = [...variants]; n[i] = { ...n[i], sku: e.target.value }; setVariants(n); }} />
                        </td>
                        <td className="px-4 py-2">
                          <input className="w-20 px-2 py-1 rounded bg-gray-50 border border-gray-200 text-[9px] focus:outline-none focus:border-indigo-300"
                            placeholder="—" type="number" step="0.01" value={v.priceOverride}
                            onChange={(e) => { const n = [...variants]; n[i] = { ...n[i], priceOverride: e.target.value }; setVariants(n); }} />
                        </td>
                        <td className="px-4 py-2">
                          <input className="w-20 px-2 py-1 rounded bg-gray-50 border border-gray-200 text-[9px] focus:outline-none focus:border-indigo-300"
                            placeholder="0.00" type="number" step="0.01" value={v.costPrice}
                            onChange={(e) => { const n = [...variants]; n[i] = { ...n[i], costPrice: e.target.value }; setVariants(n); }} />
                        </td>
                        <td className="px-4 py-2">
                          <input className="w-16 px-2 py-1 rounded bg-gray-50 border border-gray-200 text-[9px] focus:outline-none focus:border-indigo-300"
                            placeholder="0" type="number" value={v.weightGrams}
                            onChange={(e) => { const n = [...variants]; n[i] = { ...n[i], weightGrams: e.target.value }; setVariants(n); }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        );

      case 3:
        return (
          <Card>
            <div className="space-y-4">
              <h4 className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Product Images</h4>
              <input
                id="product-image-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="flex gap-3 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    <div className={`w-28 h-28 rounded-xl border-2 overflow-hidden transition-all ${img.isPrimary ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200"}`}>
                      <img src={img.url} alt={img.altText || `Image ${i + 1}`} className="w-full h-full object-cover" />
                    </div>
                    {img.isPrimary && <span className="absolute -top-1 -right-1 text-[7px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-md font-bold">PRIMARY</span>}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-1">
                      {!img.isPrimary && (
                        <Button variant="secondary" size="sm" onClick={() => setPrimaryImage(i)}>★</Button>
                      )}
                      <Button variant="danger" size="sm" onClick={() => removeImage(i)}>✕</Button>
                    </div>
                  </div>
                ))}
                <button onClick={addImage}
                  className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors">
                  <span className="text-xl">+</span>
                  <span className="text-[8px] font-medium">Upload Image</span>
                </button>
              </div>
              {images.length > 0 && (
                <p className="text-[9px] text-gray-400">{images.length} image(s) uploaded. First image is set as primary. Hover to change primary or remove.</p>
              )}
            </div>
          </Card>
        );

      case 4:
        return (
          <div className="space-y-4">
            <Card>
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Product Specifications</h4>
                {attributes.map((attr, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input placeholder="e.g. Material" value={attr.key}
                      onChange={(e) => { const a = [...attributes]; a[i] = { ...a[i], key: e.target.value }; setAttributes(a); }} className="w-40" />
                    <Input placeholder="e.g. 80% Cotton, 20% Polyester" value={attr.value}
                      onChange={(e) => { const a = [...attributes]; a[i] = { ...a[i], value: e.target.value }; setAttributes(a); }} />
                    {attributes.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => setAttributes(attributes.filter((_, j) => j !== i))}>✕</Button>
                    )}
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setAttributes([...attributes, { key: "", value: "" }])}>+ Add Attribute</Button>
              </div>
            </Card>
            <Card>
              <div className="space-y-3">
                <h4 className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider">SEO</h4>
                <Input label="Meta Title" placeholder="Auto-generated from product name if blank" {...register("metaTitle")} />
                <Textarea label="Meta Description" placeholder="Auto-generated from description if blank" rows={3} {...register("metaDescription")} />
              </div>
            </Card>
          </div>
        );

      case 5:
        return (
          <Card padding={false}>
            <CardHeader>Set Initial Stock ({variants.length} variants)</CardHeader>
            {variants.length === 0 ? (
              <div className="p-8 text-center text-[11px] text-gray-400">
                No variants created. Go back to Step 3 to add variants, or skip to publish as a simple product.
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Variant", "SKU", "Initial Quantity"].map((h) => (
                      <th key={h} className="text-left px-4 py-2 text-[8px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.sku} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-2 text-[10px] font-medium text-gray-700">{v.name}</td>
                      <td className="px-4 py-2 text-[9px] font-mono text-indigo-600">{v.sku}</td>
                      <td className="px-4 py-2">
                        <input className="w-24 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[10px] focus:outline-none focus:border-indigo-300"
                          type="number" min="0" placeholder="0" value={inventory[v.sku] || ""}
                          onChange={(e) => setInventory({ ...inventory, [v.sku]: Number(e.target.value) })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        );

      case 6:
        return (
          <div className="space-y-4">
            <Card>
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Review & Publish</h4>
              <div className="space-y-3">
                {[
                  { label: "Name", value: watch("name"), ok: !!watch("name") },
                  { label: "Price", value: `$${watch("basePrice") || 0}`, ok: Number(watch("basePrice")) > 0 },
                  { label: "Category", value: watch("categoryId") ? "Selected" : "Not set", ok: !!watch("categoryId") },
                  { label: "Variants", value: `${variants.length} variants`, ok: true },
                  { label: "Images", value: `${images.length} images`, ok: images.length > 0 && images.some((i) => i.isPrimary) },
                  { label: "Attributes", value: `${attributes.filter((a) => a.key).length} specs`, ok: true },
                  { label: "Inventory", value: `${Object.values(inventory).filter((q) => q > 0).length} variants stocked`, ok: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-[10px] text-gray-500">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-gray-700">{item.value}</span>
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${item.ok ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                        {item.ok ? "✓" : "!"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-200">
              <div className="text-center">
                <h4 className="text-sm font-bold text-indigo-800 mb-1">Ready to publish?</h4>
                <p className="text-[10px] text-indigo-500 mb-4">This will make the product visible to all customers.</p>
                <Button variant="success" size="lg" onClick={publishProduct} loading={isUpdating}
                  disabled={!canPublish}>
                  Publish Product
                </Button>
                {!canPublish && (
                  <p className="text-[9px] text-rose-500 mt-2">
                    Missing required fields. Please complete all steps.
                  </p>
                )}
              </div>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/dashboard/products")}>← Back to Products</Button>
        <div className="flex items-center gap-2">
          <StatusBadge status="Draft" />
          {productId && <span className="text-[9px] text-gray-300">ID: {productId.slice(-8)}</span>}
        </div>
      </div>

      {/* Stepper */}
      <Card className="overflow-x-auto">
        <Stepper steps={STEPS} currentStep={currentStep}
          onStepClick={(step) => { if (completedSteps.has(step) || step <= currentStep) setCurrentStep(step); }}
          completedSteps={completedSteps} />
      </Card>

      {/* Step content */}
      {renderStep()}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="secondary" onClick={goPrev} disabled={currentStep === 0}>
          ← Previous
        </Button>
        <span className="text-[10px] text-gray-400">
          Step {currentStep + 1} of {STEPS.length}
        </span>
        {currentStep < STEPS.length - 1 ? (
          <Button variant="primary" onClick={goNext} loading={isCreating || isUpdating}>
            {currentStep === 0 && !productId ? "Save Draft & Continue" : "Save & Continue"} →
          </Button>
        ) : (
          <div /> // Publish button is inside the review step
        )}
      </div>
    </div>
  );
}
