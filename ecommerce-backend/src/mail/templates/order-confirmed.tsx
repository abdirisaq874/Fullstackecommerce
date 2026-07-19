import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function OrderConfirmed({ data }: EmailTemplateProps) {
  return (
    <EmailLayout preview={`Order ${data.orderNumber} confirmed`} brand={data.brand}>
      <Text style={styles.h}>Your order is confirmed ✅</Text>
      <Text style={styles.p}>
        Hi {data.customerName || 'there'}, {data.storeName || 'the store'} has confirmed order{' '}
        <b>{data.orderNumber}</b>. We’ll let you know as soon as it ships.
      </Text>
      {data.orderUrl ? (
        <ActionButton href={data.orderUrl} color={data.brand?.brandColor}>View order</ActionButton>
      ) : null}
    </EmailLayout>
  );
}
