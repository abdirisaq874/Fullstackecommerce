"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAppSelector } from "../../hooks/useAppStore";
import { selectCurrentUser, selectUserRole } from "../../store/slices/authSlice";
import { useGetUnreadCountQuery, useGetDashboardStatsQuery } from "../../store/api/endpointsApi";
import { cn } from "../../lib/utils";
import type { UserRole } from "../../types";

interface NavItem {
  icon: string;
  label: string;
  href: string;
  roles: UserRole[];
  badge?: "notifications" | "orders";
}

const navigation: NavItem[] = [
  { icon: "◻", label: "Dashboard", href: "/dashboard", roles: ["admin", "seller"] },
  { icon: "◼", label: "Products", href: "/dashboard/products", roles: ["admin", "seller"] },
  { icon: "▦", label: "Orders", href: "/dashboard/orders", roles: ["admin", "seller"] },
  { icon: "▤", label: "Inventory", href: "/dashboard/inventory", roles: ["admin", "seller"] },
  { icon: "◉", label: "Analytics", href: "/dashboard/analytics", roles: ["admin", "seller"] },
  { icon: "◎", label: "Customers", href: "/dashboard/customers", roles: ["admin"] },
  { icon: "▣", label: "Promotions", href: "/dashboard/promotions", roles: ["admin"] },
  { icon: "⊞", label: "Settings", href: "/dashboard/settings", roles: ["admin"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAppSelector(selectCurrentUser);
  const role = useAppSelector(selectUserRole) || "seller";
  const { data: unreadCount } = useGetUnreadCountQuery(undefined, { pollingInterval: 30000 });
  const { data: dashboardStats } = useGetDashboardStatsQuery(undefined, { pollingInterval: 60000 });
  const pendingOrderCount = dashboardStats?.overview?.pendingOrders ?? 0;

  const visibleNav = navigation.filter((item) => item.roles.includes(role as UserRole));

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fc]" style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-white border-r border-gray-100 p-4 flex flex-col">
        <Link href="/dashboard" className="mb-6 px-2 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>S</div>
          <div className="text-sm font-bold text-gray-800 tracking-tight">ShopFlow</div>
        </Link>

        <div className="text-[8px] uppercase text-gray-300 tracking-[0.15em] font-semibold px-3 mb-2">Menu</div>
        <nav className="space-y-0.5 flex-1">
          {visibleNav.map((item) => (
            <Link key={item.href} href={item.href}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-[11px] flex items-center gap-2.5 transition-all duration-150",
                isActive(item.href)
                  ? "bg-indigo-50 text-indigo-600 font-semibold"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50",
              )}>
              <span className={cn("text-[10px]", isActive(item.href) ? "text-indigo-400" : "text-gray-300")}>
                {item.icon}
              </span>
              {item.label}
              {item.label === "Orders" && pendingOrderCount > 0 && (
                <span className="ml-auto text-[8px] w-4 h-4 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center font-bold">
                  {pendingOrderCount > 99 ? "99+" : pendingOrderCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User card */}
        <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
              {user?.firstName?.[0] || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-medium text-gray-700 truncate">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-[8px] text-gray-400 capitalize">{role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <header className="shrink-0 px-6 py-3 bg-white border-b border-gray-100 flex items-center justify-end gap-3">
          <div className="relative">
            <input className="pl-8 pr-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[10px] text-gray-600 w-48 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 placeholder:text-gray-300"
              placeholder="Search anything..." />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-[10px]">⌕</span>
          </div>
          <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 relative cursor-pointer hover:bg-gray-200 transition-colors">
            ◉
            {(unreadCount?.count || 0) > 0 && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 border border-white" />
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
