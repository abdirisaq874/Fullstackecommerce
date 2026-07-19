import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function OrderCancelled({ data }: EmailTemplateProps) {
  return (
    <EmailLayout preview={`Order ${data.orderNumber} cancelled`} brand={data.brand}>
      <Text style={styles.h}>Your order was cancelled</Text>
      <Text style={styles.p}>
        Hi {data.customerName || 'there'}, order <b>{data.orderNumber}</b> from {data.storeName || 'the store'} has been
        cancelled.
      </Text>
      {data.reason ? <Text style={styles.muted}>Reason: {data.reason}</Text> : null}
      {data.orderUrl ? (
        <ActionButton href={data.orderUrl} color={data.brand?.brandColor}>View order</ActionButton>
      ) : null}
    </EmailLayout>
  );
}
