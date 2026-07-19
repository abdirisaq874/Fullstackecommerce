import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function StoreNewOrder({ data }: EmailTemplateProps) {
  return (
    <EmailLayout preview={`New order ${data.orderNumber}`} brand={data.brand}>
      <Text style={styles.h}>You’ve got a new order 🛎️</Text>
      <Text style={styles.p}>
        {data.storeName || 'Your store'} received order <b>{data.orderNumber}</b>
        {data.buyerName ? ` from ${data.buyerName}` : ''} — {data.itemCount || 0} item(s), {data.currency} {data.total}.
      </Text>
      {data.dashboardUrl ? (
        <ActionButton href={data.dashboardUrl} color={data.brand?.brandColor}>Fulfill order</ActionButton>
      ) : null}
    </EmailLayout>
  );
}
