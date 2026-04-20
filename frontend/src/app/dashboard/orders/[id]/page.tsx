"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useGetOrderQuery, useUpdateOrderStatusMutation } from "../../../../store/api/endpointsApi";
import { Button, Card, CardHeader, StatusBadge, Skeleton } from "../../../../components/ui";
import { formatCurrency, formatDate } from "../../../../lib/utils";

const statusTimeline = ["pending", "confirmed", "processing", "shipped", "delivered"];

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { data: order, isLoading } = useGetOrderQuery(orderId);
  const [updateStatus, { isLoading: isUpdating }] = useUpdateOrderStatusMutation();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2"><Skeleton className="h-48" /></Card>
          <Card><Skeleton className="h-48" /></Card>
        </div>
      </div>
    );
  }

  if (!order) return <div className="text-center py-12 text-gray-400">Order not found</div>;

  const capitalizeStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const currentIdx = statusTimeline.indexOf(order.status);
  const isCancelled = order.status === "cancelled" || order.status === "refunded";

  const nextActions: Record<string, { label: string; status: string; variant: "success" | "primary" | "danger" }[]> = {
    pending: [{ label: "Confirm Order", status: "confirmed", variant: "success" }, { label: "Cancel", status: "cancelled", variant: "danger" }],
    confirmed: [{ label: "Start Processing", status: "processing", variant: "primary" }, { label: "Cancel", status: "cancelled", variant: "danger" }],
    processing: [{ label: "Mark as Shipped", status: "shipped", variant: "success" }],
    shipped: [{ label: "Mark as Delivered", status: "delivered", variant: "success" }],
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <Link href="/dashboard/orders" className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors">← Back to Orders</Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-lg font-bold text-gray-800 tracking-tight">{order.orderNumber}</h1>
            <StatusBadge status={capitalizeStatus(order.status)} />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          {(nextActions[order.status] || []).map((a) => (
            <Button key={a.status} variant={a.variant} loading={isUpdating}
              onClick={() => updateStatus({ id: order._id, status: a.status })}>
              {a.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Status timeline */}
      {!isCancelled && (
        <Card className="mb-5">
          <div className="flex items-center justify-between">
            {statusTimeline.map((step, i) => {
              const isCompleted = i <= currentIdx;
              const isActive = i === currentIdx;
              return (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                      isCompleted
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "bg-white border-gray-200 text-gray-300"
                    } ${isActive ? "ring-4 ring-emerald-100" : ""}`}>
                      {isCompleted ? "✓" : i + 1}
                    </div>
                    <span className={`text-[9px] mt-1.5 font-medium ${isCompleted ? "text-emerald-600" : "text-gray-300"}`}>
                      {capitalizeStatus(step)}
                    </span>
                    {step === order.status && order[`${step}At` as keyof typeof order] && (
                      <span className="text-[8px] text-gray-400">
                        {formatDate(order[`${step}At` as keyof typeof order] as string)}
                      </span>
                    )}
                  </div>
                  {i < statusTimeline.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${i < currentIdx ? "bg-emerald-400" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {isCancelled && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-3 mb-5">
          <div className="text-[11px] font-semibold text-rose-700">
            Order {order.status === "cancelled" ? "Cancelled" : "Refunded"}
          </div>
          <div className="text-[9px] text-rose-500">
            on {formatDate(order.cancelledAt || order.updatedAt)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Order items */}
        <Card padding={false} className="col-span-2">
          <CardHeader>Order Items ({order.items.length})</CardHeader>
          <div className="divide-y divide-gray-50">
            {order.items.map((item, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                    : <span className="text-lg">📦</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-gray-700">{item.productName}</div>
                  <div className="text-[9px] text-gray-400">{item.variantName} · SKU: {item.sku}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] text-gray-700 font-medium">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                  </div>
                  <div className="text-[11px] font-bold text-gray-800">{formatCurrency(item.totalPrice)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Shipping</span>
              <span className="text-gray-700">{formatCurrency(order.shippingCost)}</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Tax</span>
              <span className="text-gray-700">{formatCurrency(order.taxAmount)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">Discount</span>
                <span className="text-emerald-600">-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[12px] font-bold border-t border-gray-200 pt-1.5 mt-1.5">
              <span className="text-gray-700">Total</span>
              <span className="text-gray-900">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </Card>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Shipping address */}
          <Card>
            <div className="text-[10px] font-semibold text-gray-700 mb-2">Shipping Address</div>
            {order.shippingAddress && (
              <div className="text-[10px] text-gray-500 space-y-0.5">
                <div className="font-medium text-gray-700">{order.shippingAddress.fullName}</div>
                <div>{order.shippingAddress.line1}</div>
                {order.shippingAddress.line2 && <div>{order.shippingAddress.line2}</div>}
                <div>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}</div>
                <div>{order.shippingAddress.countryCode}</div>
                {order.shippingAddress.phone && <div className="mt-1 text-gray-400">{order.shippingAddress.phone}</div>}
              </div>
            )}
          </Card>

          {/* Order notes */}
          {order.notes && (
            <Card>
              <div className="text-[10px] font-semibold text-gray-700 mb-2">Customer Notes</div>
              <div className="text-[10px] text-gray-500">{order.notes}</div>
            </Card>
          )}

          {/* Timestamps */}
          <Card>
            <div className="text-[10px] font-semibold text-gray-700 mb-2">Timeline</div>
            <div className="space-y-2">
              {[
                { label: "Placed", date: order.placedAt },
                { label: "Confirmed", date: order.confirmedAt },
                { label: "Shipped", date: order.shippedAt },
                { label: "Delivered", date: order.deliveredAt },
                { label: "Cancelled", date: order.cancelledAt },
              ].filter((t) => t.date).map((t) => (
                <div key={t.label} className="flex items-center justify-between">
                  <span className="text-[9px] text-gray-500">{t.label}</span>
                  <span className="text-[9px] text-gray-700 font-medium">{formatDate(t.date!)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
