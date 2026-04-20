"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchProductsQuery } from "../../../../store/api/productsApi";
import { Button, DataTable, StatusBadge, StatCard, TableSkeleton, Pagination, EmptyState } from "../../../../components/ui";
import { formatCurrency } from "../../../../lib/utils";
import type { Product, ProductStatus } from "../../../../types";

const statusFilters: { label: string; value: ProductStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
  { label: "Archived", value: "archived" },
];

export default function ProductsPage() {
  const [status, setStatus] = useState<ProductStatus | "all">("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isFetching } = useSearchProductsQuery({
    status: status === "all" ? undefined : status,
    page,
    limit,
  });

  const columns = [
    {
      key: "name", header: "Product",
      render: (p: Product) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center text-sm border border-gray-100 overflow-hidden">
            {p.images[0]?.url ? <img src={p.images[0].url} alt="" className="w-full h-full object-cover" /> : "📦"}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-gray-700">{p.name}</div>
            <div className="text-[9px] text-gray-400">{p.variants.length} variants</div>
          </div>
        </div>
      ),
    },
    {
      key: "sku", header: "SKU",
      render: (p: Product) => <span className="text-[10px] font-mono text-gray-400">{p.variants[0]?.sku || "—"}</span>,
    },
    {
      key: "basePrice", header: "Price",
      render: (p: Product) => <span className="text-[11px] font-semibold text-gray-700">{formatCurrency(p.basePrice)}</span>,
    },
    {
      key: "avgRating", header: "Rating",
      render: (p: Product) => <span className="text-[10px] text-gray-500">{p.avgRating > 0 ? `★ ${p.avgRating}` : "—"}</span>,
    },
    {
      key: "totalSold", header: "Sold",
      render: (p: Product) => <span className="text-[10px] text-gray-500">{p.totalSold}</span>,
    },
    {
      key: "status", header: "Status",
      render: (p: Product) => <StatusBadge status={p.status === "active" ? "Active" : p.status === "draft" ? "Draft" : "Archived"} />,
    },
    {
      key: "actions", header: "",
      render: (p: Product) => (
        <Link href={`/dashboard/products/${p._id}`} className="text-[9px] text-indigo-500 font-semibold hover:text-indigo-700">
          Edit
        </Link>
      ),
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">Products</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">Manage your product catalog.</p>
        </div>
        <Link href="/dashboard/products/new">
          <Button>+ Add Product</Button>
        </Link>
      </div>

      <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg w-fit mb-4">
        {statusFilters.map((f) => (
          <button key={f.value} onClick={() => { setStatus(f.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all ${
              status === f.value ? "bg-white text-gray-700 shadow-sm" : "text-gray-400 hover:text-gray-600"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon="📦" title="No products found" description="Create your first product to get started."
          action={<Link href="/dashboard/products/new"><Button>+ Add Product</Button></Link>} />
      ) : (
        <>
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <DataTable columns={columns} data={data.data} keyExtractor={(p) => p._id} />
          </div>
          {data.meta.totalPages > 1 && (
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages}
              total={data.meta.total} limit={data.meta.limit} onPageChange={setPage} />
          )}
        </>
      )}
    </>
  );
}
