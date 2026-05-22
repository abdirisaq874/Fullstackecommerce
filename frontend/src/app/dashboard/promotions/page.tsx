"use client";
import { useState } from "react";
import { useGetCouponsQuery, useCreateCouponMutation } from "../../../store/api/endpointsApi";
import { Button, Card, CardHeader, DataTable, StatusBadge, Input, Select, TableSkeleton, EmptyState } from "../../../components/ui";

export default function PromotionsPage() {
  const { data: coupons, isLoading } = useGetCouponsQuery();
  const [createCoupon, { isLoading: isCreating }] = useCreateCouponMutation();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: "", type: "percentage", value: "", minOrderAmount: "", expiresAt: "" });

  const handleCreate = async () => {
    try {
      await createCoupon({
        code: form.code.toUpperCase(),
        type: form.type as any,
        value: Number(form.value),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
        expiresAt: form.expiresAt,
        isActive: true,
      }).unwrap();
      setShowCreate(false);
      setForm({ code: "", type: "percentage", value: "", minOrderAmount: "", expiresAt: "" });
    } catch (err) {
      console.error("Create coupon failed", err);
    }
  };

  const columns = [
    {
      key: "code", header: "Code",
      render: (c: any) => (
        <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-mono">{c.code}</span>
      ),
    },
    {
      key: "type", header: "Type",
      render: (c: any) => <span className="text-[10px] text-gray-500 capitalize">{c.type.replace("_", " ")}</span>,
    },
    {
      key: "value", header: "Value",
      render: (c: any) => (
        <span className="text-[11px] font-bold text-gray-700">
          {c.type === "percentage" ? `${c.value}%` : c.type === "fixed_amount" ? `$${c.value}` : "Free"}
        </span>
      ),
    },
    {
      key: "usage", header: "Used / Limit",
      render: (c: any) => (
        <div>
          <div className="text-[10px] text-gray-600 font-medium">
            {c.usageCount}{c.usageLimit ? ` / ${c.usageLimit}` : " / ∞"}
          </div>
          {c.usageLimit && (
            <div className="w-16 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.min((c.usageCount / c.usageLimit) * 100, 100)}%` }} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "expires", header: "Expires",
      render: (c: any) => <span className="text-[10px] text-gray-400">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}</span>,
    },
    {
      key: "status", header: "Status",
      render: (c: any) => <StatusBadge status={c.isActive ? "Active" : "Expired"} />,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">Promotions</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">Create and manage discount codes.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Create Coupon</Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : !coupons || coupons.length === 0 ? (
        <EmptyState icon="🎫" title="No coupons yet" description="Create your first discount code."
          action={<Button onClick={() => setShowCreate(true)}>+ Create Coupon</Button>} />
      ) : (
        <DataTable columns={columns} data={coupons} keyExtractor={(c) => c._id} />
      )}

      {/* Create coupon modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <Card className="w-[420px]" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-gray-700 mb-4">Create Coupon</div>
            <div className="space-y-3">
              <Input label="Coupon Code" required placeholder="e.g. SPRING25" value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Type" required options={[
                  { value: "percentage", label: "Percentage %" },
                  { value: "fixed_amount", label: "Fixed Amount $" },
                  { value: "free_shipping", label: "Free Shipping" },
                ]} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
                <Input label="Value" required type="number" placeholder={form.type === "percentage" ? "25" : "10.00"}
                  value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              <Input label="Minimum Order Amount" type="number" placeholder="50.00"
                value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} />
              <Input label="Expires At" type="date" value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} loading={isCreating}>Create Coupon</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
