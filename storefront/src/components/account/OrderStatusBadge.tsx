import { Badge } from '@/components/ui';
import type { OrderStatus } from '@/types';

const MAP: Record<string, { label: string; variant: 'brand' | 'sale' | 'success' | 'neutral' }> = {
  pending: { label: 'Pending', variant: 'sale' },
  confirmed: { label: 'Confirmed', variant: 'brand' },
  processing: { label: 'Processing', variant: 'brand' },
  shipped: { label: 'Shipped', variant: 'brand' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus | string }) {
  const cfg = MAP[status] ?? { label: status, variant: 'neutral' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
