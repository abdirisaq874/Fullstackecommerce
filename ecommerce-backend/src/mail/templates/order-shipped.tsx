import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function OrderShipped({ data }: EmailTemplateProps) {
  return (
    <EmailLayout preview={`Order ${data.orderNumber} shipped`} brand={data.brand}>
      <Text style={styles.h}>Your order is on the way 📦</Text>
      <Text style={styles.p}>
        Hi {data.customerName || 'there'}, order <b>{data.orderNumber}</b> from {data.storeName || 'the store'} has
        shipped.
      </Text>
      {data.trackingNumber ? (
        <Text style={styles.muted}>
          Tracking: {data.carrier || ''} {data.trackingNumber}
        </Text>
      ) : null}
      {data.orderUrl ? (
        <ActionButton href={data.orderUrl} color={data.brand?.brandColor}>Track order</ActionButton>
      ) : null}
    </EmailLayout>
  );
}
