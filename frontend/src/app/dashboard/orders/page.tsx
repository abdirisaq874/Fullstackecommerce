"use client";
import { useState } from "react";
import Link from "next/link";
import { useGetOrdersQuery, useUpdateOrderStatusMutation } from "../../../../store/api/endpointsApi";
import { Button, Card, CardHeader, DataTable, StatusBadge, Pagination, TableSkeleton, EmptyState } from "../../../../components/ui";
import { formatCurrency, formatDate, formatRelativeTime } from "../../../../lib/utils";
import type { Order, OrderStatus } from "../../../../types";

const statusFilters: { label: string; value: OrderStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

export default function OrdersPage() {
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isFetching } = useGetOrdersQuery({
    status: status === "all" ? undefined : status,
    page,
    limit,
  });

  const [updateStatus, { isLoading: isUpdating }] = useUpdateOrderStatusMutation();

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateStatus({ id: orderId, status: newStatus }).unwrap();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const capitalizeStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const columns = [
    {
      key: "orderNumber",
      header: "Order",
      render: (o: Order) => (
        <Link href={`/dashboard/orders/${o._id}`} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
          {o.orderNumber}
        </Link>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (o: Order) => (
        <div>
          <div className="text-[10px] text-gray-700 font-medium">{o.items.length} item{o.items.length !== 1 ? "s" : ""}</div>
          <div className="text-[9px] text-gray-400 truncate max-w-[160px]">
            {o.items.map((i) => i.productName).join(", ")}
          </div>
        </div>
      ),
    },
    {
      key: "total",
      header: "Total",
      render: (o: Order) => <span className="text-[11px] font-bold text-gray-800">{formatCurrency(o.total)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (o: Order) => <StatusBadge status={capitalizeStatus(o.status)} />,
    },
    {
      key: "date",
      header: "Date",
      render: (o: Order) => (
        <div>
          <div className="text-[10px] text-gray-500">{formatDate(o.createdAt)}</div>
          <div className="text-[8px] text-gray-300">{formatRelativeTime(o.createdAt)}</div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (o: Order) => {
        const nextActions: Record<string, { label: string; status: string; variant: "success" | "primary" | "danger" }[]> = {
          pending: [{ label: "Confirm", status: "confirmed", variant: "success" }, { label: "Cancel", status: "cancelled", variant: "danger" }],
          confirmed: [{ label: "Process", status: "processing", variant: "primary" }],
          processing: [{ label: "Ship", status: "shipped", variant: "success" }],
          shipped: [{ label: "Deliver", status: "delivered", variant: "success" }],
        };
        const actions = nextActions[o.status] || [];
        return (
          <div className="flex gap-1">
            <Link href={`/dashboard/orders/${o._id}`}>
              <Button variant="ghost" size="sm">View</Button>
            </Link>
            {actions.map((a) => (
              <Button key={a.status} variant={a.variant} size="sm" loading={isUpdating}
                onClick={(e) => { e.preventDefault(); handleStatusUpdate(o._id, a.status); }}>
                {a.label}
              </Button>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">Orders</h1>
          <p className="text-[10px] text-gray-400 mt-0.5">Track and manage customer orders.</p>
        </div>
        <Button variant="secondary">Export CSV</Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg overflow-x-auto">
          {statusFilters.map((f) => (
            <button key={f.value} onClick={() => { setStatus(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all whitespace-nowrap ${
                status === f.value ? "bg-white text-gray-700 shadow-sm" : "text-gray-400 hover:text-gray-600"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} cols={6} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon="📋" title="No orders found" description={status !== "all" ? `No ${status} orders.` : "Orders will appear here when customers place them."} />
      ) : (
        <>
          <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
            <DataTable columns={columns} data={data.data} keyExtractor={(o) => o._id} />
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
