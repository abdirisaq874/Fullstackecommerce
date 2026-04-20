"use client";
import { useGetDashboardStatsQuery, useGetRevenueChartQuery, useGetOrdersByStatusQuery } from "../../../../store/api/endpointsApi";
import { Card, CardHeader, StatCard, Skeleton } from "../../../../components/ui";
import { formatCurrency } from "../../../../lib/utils";

export default function AnalyticsPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStatsQuery();
  const { data: revenueData, isLoading: revLoading } = useGetRevenueChartQuery(30);
  const { data: ordersByStatus, isLoading: statusLoading } = useGetOrdersByStatusQuery();

  const maxRevenue = revenueData ? Math.max(...revenueData.map((d) => d.revenue), 1) : 1;
  const totalOrders = ordersByStatus?.reduce((sum, s) => sum + s.count, 0) || 0;

  const statusColors: Record<string, string> = {
    delivered: "bg-emerald-500", confirmed: "bg-sky-500", processing: "bg-violet-500",
    shipped: "bg-indigo-500", pending: "bg-amber-500", cancelled: "bg-rose-400", refunded: "bg-gray-400",
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-800 tracking-tight">Analytics</h1>
        <p className="text-[10px] text-gray-400 mt-0.5">Understand your store performance.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Card key={i}><Skeleton className="h-12" /></Card>)
        ) : stats ? (
          <>
            <StatCard label="Monthly Revenue" value={formatCurrency(stats.overview.monthRevenue)} icon="$" gradient="from-indigo-500 to-violet-500" />
            <StatCard label="Total Orders" value={stats.overview.totalOrders} icon="#" gradient="from-sky-500 to-cyan-500" />
            <StatCard label="Total Customers" value={stats.overview.totalCustomers} icon="♡" gradient="from-emerald-500 to-teal-500" />
            <StatCard label="Active Products" value={stats.overview.totalProducts} icon="◼" gradient="from-amber-500 to-orange-500" />
          </>
        ) : null}
      </div>

      {/* Revenue chart */}
      <Card padding={false} className="mb-5">
        <CardHeader>Revenue Trend (30 Days)</CardHeader>
        <div className="px-5 py-4">
          {revLoading ? (
            <div className="flex items-end gap-1 h-36">
              {Array.from({ length: 30 }).map((_, i) => <Skeleton key={i} className="flex-1 rounded" style={{ height: `${20 + Math.random() * 70}%` }} />)}
            </div>
          ) : revenueData && revenueData.length > 0 ? (
            <div className="flex items-end gap-1 h-36">
              {revenueData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                  <div className="text-[7px] text-gray-400 opacity-0 group-hover:opacity-100 font-medium transition-opacity">
                    {formatCurrency(d.revenue)}
                  </div>
                  <div className="w-full rounded-t transition-all group-hover:opacity-80"
                    style={{
                      height: `${Math.max((d.revenue / maxRevenue) * 100, 2)}%`,
                      background: d.revenue / maxRevenue > 0.7
                        ? "linear-gradient(180deg, #6366f1, #a78bfa)"
                        : "linear-gradient(180deg, #c7d2fe, #e0e7ff)",
                    }} />
                  {i % 5 === 0 && (
                    <span className="text-[6px] text-gray-300">
                      {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-36 flex items-center justify-center text-[11px] text-gray-400">No data</div>
          )}
        </div>
      </Card>

      {/* Orders by status */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="text-[10px] font-semibold text-gray-700 mb-4">Orders by Status</div>
          {statusLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6" />)}</div>
          ) : ordersByStatus && ordersByStatus.length > 0 ? (
            <div className="space-y-2.5">
              {ordersByStatus.map((s) => (
                <div key={s._id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-600 font-medium capitalize">{s._id}</span>
                    <span className="text-[10px] text-gray-500">
                      {s.count} ({totalOrders > 0 ? Math.round((s.count / totalOrders) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${statusColors[s._id] || "bg-gray-400"}`}
                      style={{ width: `${totalOrders > 0 ? (s.count / totalOrders) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-gray-400">No order data</div>
          )}
        </Card>

        <Card>
          <div className="text-[10px] font-semibold text-gray-700 mb-4">Performance Summary</div>
          {stats ? (
            <div className="space-y-3">
              {[
                { label: "Avg. Order Value", value: stats.overview.totalOrders > 0 ? formatCurrency(stats.overview.monthRevenue / stats.overview.totalOrders) : "$0" },
                { label: "Orders Today", value: stats.overview.todayOrders },
                { label: "Low Stock Alerts", value: stats.overview.lowStockCount },
                { label: "Pending Orders", value: stats.overview.pendingOrders },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-[10px] text-gray-500">{item.label}</span>
                  <span className="text-[11px] font-bold text-gray-700">{item.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5" />)}</div>
          )}
        </Card>
      </div>
    </>
  );
}
