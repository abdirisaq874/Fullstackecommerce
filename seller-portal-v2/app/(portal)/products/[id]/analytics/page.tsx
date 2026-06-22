'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Eye, ShoppingCart, RotateCcw, TrendingUp, Edit2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/primitives/card';
import { Badge } from '@/components/primitives/badge';
import { Button } from '@/components/primitives/button';
import { MetricCard } from '@/components/dashboard/metric-card';
import { CardSkeleton, ErrorState } from '@/components/data/states';
import { Money } from '@/components/shared/format';
import { useGetProductQuery, useListOrdersQuery } from '@/lib/api';
import { catName, brandName, formatNumber, formatPercent, productDisplayStatus } from '@/lib/utils';

export default function ProductAnalyticsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: product, isLoading, isError, refetch } = useGetProductQuery(params.id);
  const { data: orders = [] } = useListOrdersQuery();

  if (isError) return <ErrorState onRetry={refetch} />;
  if (isLoading || !product) return <CardSkeleton height={400} />;

  // Recent orders containing this product
  const productOrders = orders.filter(o => o.itemsList.some(i => i.productId === product.id)).slice(0, 5);

  // Faux daily views and conversion for the last 14 days
  const viewTrend = Array.from({ length: 14 }, (_, i) => Math.round(40 + Math.sin(i * 0.6) * 20 + Math.random() * 15));
  const maxViews = Math.max(...viewTrend);
  const displayStatus = productDisplayStatus(product);

  return (
    <>
      <button onClick={() => router.push('/products')} className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to products
      </button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-stone-100 grid place-items-center shrink-0 ring-1 ring-stone-200">
            {product.images?.[0]?.url
              ? <Image src={product.images[0].url} alt={product.name} width={64} height={64} className="w-full h-full object-cover" unoptimized />
              : <span className="font-serif text-2xl text-stone-500">{product.initial ?? product.name[0]}</span>}
          </div>
          <div>
            <h1 className="font-serif text-3xl text-stone-900">{product.name}</h1>
            <div className="text-sm text-stone-500 mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-mono">{product.sku}</span>
              <span>·</span>
              <span>{catName(product.categoryId)}</span>
              <span>·</span>
              <span>{brandName(product.brandId)}</span>
              <Badge variant={displayStatus.variant}>{displayStatus.label}</Badge>
            </div>
          </div>
        </div>
        <Link href={`/products/${product.id}/edit`}>
          <Button variant="secondary"><Edit2 className="w-3.5 h-3.5" /> Edit product</Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Views (lifetime)"    value={formatNumber(product.viewsLifetime)}    delta="+8.2% this week" trend="up" />
        <MetricCard label="Units sold"          value={formatNumber(product.totalSold)}       delta="+47% this week"  trend="up" />
        <MetricCard label="Conversion"          value={formatPercent(product.conversionRate ?? 0)} hint="Views → purchase" />
        <MetricCard label="Return rate"         value={formatPercent(product.returnRate ?? 0)} hint="Lower is better" />
      </div>

      {/* Views trend */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-medium text-stone-900">Views — last 14 days</h2>
            <p className="text-xs text-stone-500 mt-0.5">Pageviews on the product page</p>
          </div>
          <Badge variant="success">Trending up</Badge>
        </div>
        <div className="flex items-end gap-1 h-32">
          {viewTrend.map((v, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-brand-600 to-brand-400 rounded-t hover:opacity-80 transition-opacity"
              style={{ height: `${(v / maxViews) * 100}%` }}
              title={`Day ${i + 1}: ${v} views`}
            />
          ))}
        </div>
      </Card>

      {/* Revenue + recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <h2 className="text-sm font-medium text-stone-900 mb-3">Lifetime revenue</h2>
          <div className="font-serif text-4xl text-stone-900 tabular-nums">
            <Money value={product.revenueLifetime} />
          </div>
          <div className="text-xs text-stone-500 mt-2">
            From {product.totalSold} units · avg <Money value={product.totalSold ? product.revenueLifetime / product.totalSold : 0} />/unit
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="px-5 py-3 border-b border-stone-200">
            <h2 className="text-sm font-medium text-stone-900">Recent orders containing this product</h2>
          </div>
          {productOrders.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-stone-500">No orders yet</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {productOrders.map(o => (
                <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-stone-50/60 transition-colors">
                  <div className="text-sm font-mono text-stone-700 w-24">{o.id}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-stone-900 truncate">{o.customer}</div>
                    <div className="text-xs text-stone-500">{o.destination} · {o.date}</div>
                  </div>
                  <Badge variant={o.status === 'delivered' ? 'success' : o.status === 'shipped' ? 'info' : 'warning'}>{o.status}</Badge>
                  <div className="text-sm font-medium tabular-nums w-20 text-right">
                    <Money value={o.total} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Variants performance */}
      {product.variants.length > 0 && (
        <Card className="mb-6">
          <div className="px-5 py-3 border-b border-stone-200">
            <h2 className="text-sm font-medium text-stone-900">Variant performance</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50/60 border-b border-stone-200">
                <th className="text-left px-5 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Variant</th>
                <th className="text-left px-5 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">SKU</th>
                <th className="text-right px-5 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Stock</th>
                <th className="text-right px-5 py-2.5 text-2xs font-medium text-stone-500 uppercase tracking-wide">Sales (est.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {product.variants.map((v, i) => (
                <tr key={i} className="hover:bg-stone-50/40">
                  <td className="px-5 py-3 text-stone-900">{v.name || (v.options || []).map(o => o.value).join(' / ')}</td>
                  <td className="px-5 py-3 font-mono text-xs text-stone-600">{v.sku}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{v.stockOnHand}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-stone-600">{Math.floor(product.totalSold / product.variants.length + (i * 2))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
