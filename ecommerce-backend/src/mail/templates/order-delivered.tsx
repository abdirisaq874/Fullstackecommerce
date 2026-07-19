import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function OrderDelivered({ data }: EmailTemplateProps) {
  const cta = data.reviewUrl || data.orderUrl;
  return (
    <EmailLayout preview={`Order ${data.orderNumber} delivered`} brand={data.brand}>
      <Text style={styles.h}>Your order was delivered 🎁</Text>
      <Text style={styles.p}>
        Hi {data.customerName || 'there'}, order <b>{data.orderNumber}</b> from {data.storeName || 'the store'} has been
        delivered. We hope you love it!
      </Text>
      {cta ? (
        <ActionButton href={cta} color={data.brand?.brandColor}>
          {data.reviewUrl ? 'Leave a review' : 'View order'}
        </ActionButton>
      ) : null}
    </EmailLayout>
  );
}
