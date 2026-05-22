"use client";
import Link from "next/link";
import { useGetDashboardStatsQuery, useGetRevenueChartQuery } from "../../store/api/endpointsApi";
import { StatCard, Card, CardHeader, StatusBadge, Skeleton, Button } from "../../components/ui";
import { formatCurrency, formatRelativeTime } from "../../lib/utils";

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStatsQuery();
  const { data: revenueData, isLoading: revenueLoading } = useGetRevenueChartQuery(14);

  const gradients = [
    "from-indigo-500 to-violet-500",
    "from-sky-500 to-cyan-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
  ];

  const statCards = stats ? [
    { label: "Monthly Revenue", value: formatCurrency(stats.overview.monthRevenue), icon: "$", gradient: gradients[0] },
    { label: "Total Orders", value: stats.overview.totalOrders.toLocaleString(), icon: "#", gradient: gradients[1] },
    { label: "Customers", value: stats.overview.totalCustomers.toLocaleString(), icon: "♡", gradient: gradients[2] },
    { label: "Pending Orders", value: stats.overview.pendingOrders.toString(), icon: "⏳", gradient: gradients[3] },
  ] : [];

  const maxRevenue = revenueData ? Math.max(...revenueData.map((d) => d.revenue), 1) : 1;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-800 tracking-tight">Dashboard</h1>
        <p className="text-[10px] text-gray-400 mt-0.5">Welcome back! Here's your store overview.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-6 w-28" /></Card>
            ))
          : statCards.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} gradient={s.gradient} />
            ))
        }
      </div>

      {/* Alert cards */}
      {stats && (stats.overview.lowStockCount > 0 || stats.overview.pendingOrders > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          {stats.overview.lowStockCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-amber-700">Low Stock Alert</div>
                <div className="text-[9px] text-amber-500">{stats.overview.lowStockCount} products below reorder point</div>
              </div>
              <Link href="/dashboard/inventory">
                <Button variant="ghost" size="sm">View Inventory →</Button>
              </Link>
            </div>
          )}
          {stats.overview.pendingOrders > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-indigo-700">Pending Orders</div>
                <div className="text-[9px] text-indigo-500">{stats.overview.pendingOrders} orders awaiting processing</div>
              </div>
              <Link href="/dashboard/orders">
                <Button variant="ghost" size="sm">View Orders →</Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Revenue chart */}
      <Card padding={false} className="mb-5">
        <CardHeader action={
          <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
            {["7D", "14D", "30D"].map((p, i) => (
              <button key={p} className={`px-2.5 py-1 rounded-md text-[9px] font-medium transition-all ${
                i === 1 ? "bg-white text-gray-700 shadow-sm" : "text-gray-400"
              }`}>{p}</button>
            ))}
          </div>
        }>Revenue Overview</CardHeader>
        <div className="px-5 py-4">
          {revenueLoading ? (
            <div className="flex items-end gap-2 h-32">
              {Array.from({ length: 14 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 rounded-lg" style={{ height: `${30 + Math.random() * 60}%` }} />
              ))}
            </div>
          ) : revenueData && revenueData.length > 0 ? (
            <div className="flex items-end gap-2 h-32">
              {revenueData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <div className="text-[8px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    {formatCurrency(d.revenue)}
                  </div>
                  <div
                    className="w-full rounded-lg transition-all duration-300 group-hover:opacity-90 cursor-pointer"
                    style={{
                      height: `${(d.revenue / maxRevenue) * 100}%`,
                      minHeight: "4px",
                      background: d.revenue / maxRevenue > 0.75
                        ? "linear-gradient(180deg, #6366f1, #a78bfa)"
                        : "linear-gradient(180deg, #c7d2fe, #e0e7ff)",
                    }}
                  />
                  <span className="text-[7px] text-gray-300 font-medium">
                    {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-[11px] text-gray-400">
              No revenue data for this period
            </div>
          )}
        </div>
      </Card>

      {/* Recent orders + stats */}
      <div className="grid grid-cols-5 gap-3">
        {/* Recent orders */}
        <Card padding={false} className="col-span-3">
          <CardHeader action={
            <Link href="/dashboard/orders" className="text-[9px] text-indigo-500 font-semibold hover:text-indigo-700">
              View all →
            </Link>
          }>Recent Orders</CardHeader>
          {statsLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3"><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-20" /></div>
              ))}
            </div>
          ) : stats?.recentOrders && stats.recentOrders.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {stats.recentOrders.map((order) => (
                <Link key={order._id} href={`/dashboard/orders/${order._id}`}
                  className="px-5 py-2.5 flex items-center gap-3 hover:bg-gray-50/50 transition-colors block">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-indigo-600">{order.orderNumber}</div>
                    <div className="text-[9px] text-gray-400">{formatRelativeTime(order.createdAt)}</div>
                  </div>
                  <div className="text-[11px] font-bold text-gray-700 w-20 text-right">
                    {formatCurrency(order.total)}
                  </div>
                  <StatusBadge status={order.status.charAt(0).toUpperCase() + order.status.slice(1)} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-[11px] text-gray-400">No orders yet</div>
          )}
        </Card>

        {/* Quick stats */}
        <div className="col-span-2 space-y-3">
          <Card>
            <div className="text-[10px] font-semibold text-gray-700 mb-3">Store Health</div>
            <div className="space-y-2.5">
              {stats ? [
                { label: "Active Products", value: stats.overview.totalProducts, color: "emerald" },
                { label: "Low Stock Items", value: stats.overview.lowStockCount, color: stats.overview.lowStockCount > 0 ? "amber" : "emerald" },
                { label: "Today's Orders", value: stats.overview.todayOrders, color: "indigo" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{item.label}</span>
                  <span className={`text-[11px] font-bold text-${item.color}-600`}>{item.value}</span>
                </div>
              )) : (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex justify-between"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-8" /></div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-100">
            <div className="text-[10px] font-semibold text-indigo-700 mb-1">Quick Actions</div>
            <div className="space-y-1.5 mt-2">
              <Link href="/dashboard/products/new" className="block">
                <Button variant="primary" size="sm" className="w-full justify-center">+ Add Product</Button>
              </Link>
              <Link href="/dashboard/orders" className="block">
                <Button variant="secondary" size="sm" className="w-full justify-center">Process Orders</Button>
              </Link>
              <Link href="/dashboard/inventory" className="block">
                <Button variant="secondary" size="sm" className="w-full justify-center">Check Inventory</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
