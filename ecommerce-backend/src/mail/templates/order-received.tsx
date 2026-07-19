import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function OrderReceived({ data }: EmailTemplateProps) {
  const orders = Array.isArray(data.orders) ? data.orders : [];
  return (
    <EmailLayout preview="We received your order" brand={data.brand}>
      <Text style={styles.h}>Thanks for your order, {data.customerName || 'there'}! 🎉</Text>
      <Text style={styles.p}>
        We’ve received your order and passed it to {orders.length > 1 ? `${orders.length} stores` : 'the store'}. You’ll
        pay <b>{data.currency} {data.total}</b> on delivery (cash on delivery).
      </Text>
      {orders.map((o: any, i: number) => (
        <Text key={i} style={styles.muted}>
          • {o.storeName}: order <b>{o.orderNumber}</b> — {data.currency} {o.total}
        </Text>
      ))}
      {data.ordersUrl ? (
        <ActionButton href={data.ordersUrl} color={data.brand?.brandColor}>View your orders</ActionButton>
      ) : null}
    </EmailLayout>
  );
}
