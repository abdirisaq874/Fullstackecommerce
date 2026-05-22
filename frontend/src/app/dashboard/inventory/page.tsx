"use client";
import { useState } from "react";
import { useSearchProductsQuery } from "../../../store/api/productsApi";
import { useGetProductInventoryQuery, useAdjustStockMutation } from "../../../store/api/endpointsApi";
import { Button, Card, CardHeader, StatCard, Input, StatusBadge, DataTable, TableSkeleton, EmptyState } from "../../../components/ui";

export default function InventoryPage() {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [adjustSku, setAdjustSku] = useState("");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [showAdjust, setShowAdjust] = useState(false);

  const { data: products, isLoading: productsLoading } = useSearchProductsQuery({ limit: 100 });
  const { data: inventory, isLoading: invLoading } = useGetProductInventoryQuery(selectedProductId!, { skip: !selectedProductId });
  const [adjustStock, { isLoading: isAdjusting }] = useAdjustStockMutation();

  const handleAdjust = async () => {
    if (!adjustSku || !adjustQty) return;
    try {
      await adjustStock({ variantSku: adjustSku, quantity: Number(adjustQty), notes: adjustNotes }).unwrap();
      setShowAdjust(false);
      setAdjustSku("");
      setAdjustQty("");
      setAdjustNotes("");
    } catch (err) {
      console.error("Adjust failed", err);
    }
  };

  // Build flat inventory view from all products
  const allVariants = products?.data.flatMap((p) =>
    p.variants.map((v) => ({
      productId: p._id,
      productName: p.name,
      variantName: v.name,
      sku: v.sku,
      isActive: v.isActive,
    }))
  ) || [];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">Inventory</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">Monitor stock levels across all variants.</p>
        </div>
        <Button onClick={() => setShowAdjust(true)}>+ Adjust Stock</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Total Products" value={products?.meta.total || 0} icon="◼" gradient="from-indigo-500 to-violet-500" />
        <StatCard label="Total Variants" value={allVariants.length} icon="▤" gradient="from-sky-500 to-cyan-500" />
        <StatCard label="Active Variants" value={allVariants.filter((v) => v.isActive).length} icon="✓" gradient="from-emerald-500 to-teal-500" />
        <StatCard label="Inactive" value={allVariants.filter((v) => !v.isActive).length} icon="✕" gradient="from-rose-500 to-pink-500" />
      </div>

      {/* Product selector */}
      <Card className="mb-4">
        <div className="text-[10px] font-semibold text-gray-700 mb-2">Select a product to view stock levels</div>
        <div className="flex gap-2 flex-wrap">
          {productsLoading ? (
            <div className="text-[10px] text-gray-400">Loading products...</div>
          ) : (
            products?.data.map((p) => (
              <button key={p._id} onClick={() => setSelectedProductId(p._id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                  selectedProductId === p._id
                    ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}>
                {p.name} ({p.variants.length})
              </button>
            ))
          )}
        </div>
      </Card>

      {/* Stock table for selected product */}
      {selectedProductId && (
        invLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : inventory && inventory.length > 0 ? (
          <Card padding={false}>
            <CardHeader>Stock Levels</CardHeader>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["SKU", "Quantity", "Reserved", "Available", "Reorder Point", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inventory.map((inv) => {
                  const available = inv.quantity - inv.reserved;
                  const isLow = inv.quantity <= inv.reorderPoint && inv.quantity > 0;
                  const isOut = inv.quantity === 0;
                  return (
                    <tr key={inv._id} className={`border-b border-gray-50 last:border-0 ${isOut ? "bg-rose-50/30" : isLow ? "bg-amber-50/30" : ""}`}>
                      <td className="px-4 py-2.5 text-[10px] font-mono text-indigo-600 font-medium">{inv.variantSku}</td>
                      <td className="px-4 py-2.5 text-[11px] font-bold" style={{ color: isOut ? "#ef4444" : isLow ? "#f59e0b" : "#374151" }}>{inv.quantity}</td>
                      <td className="px-4 py-2.5 text-[10px] text-amber-600 font-medium">{inv.reserved || "—"}</td>
                      <td className="px-4 py-2.5 text-[11px] font-bold text-emerald-600">{available}</td>
                      <td className="px-4 py-2.5 text-[10px] text-gray-400">{inv.reorderPoint}</td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={isOut ? "Out of Stock" : isLow ? "Low Stock" : "Active"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ) : (
          <EmptyState icon="📦" title="No inventory records"
            description="Stock hasn't been set for this product's variants yet."
            action={<Button onClick={() => setShowAdjust(true)}>+ Adjust Stock</Button>} />
        )
      )}

      {!selectedProductId && !productsLoading && (
        <EmptyState icon="👆" title="Select a product above" description="Choose a product to see stock levels for each variant." />
      )}

      {/* Adjust stock modal */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowAdjust(false)}>
          <Card className="w-96" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-gray-700 mb-4">Adjust Stock</div>
            <div className="space-y-3">
              <Input label="Variant SKU" required placeholder="e.g. HOODIE-BLK-M" value={adjustSku} onChange={(e) => setAdjustSku(e.target.value)} />
              <Input label="Quantity (+/-)" required type="number" placeholder="+50 or -5" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)}
                hint="Positive to add, negative to remove" />
              <Input label="Notes" placeholder="e.g. New shipment received" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setShowAdjust(false)}>Cancel</Button>
              <Button onClick={handleAdjust} loading={isAdjusting}>Adjust Stock</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
