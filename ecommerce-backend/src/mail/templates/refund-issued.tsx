import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function RefundIssued({ data }: EmailTemplateProps) {
  return (
    <EmailLayout preview="Your refund has been issued" brand={data.brand}>
      <Text style={styles.h}>Your refund is on its way 💸</Text>
      <Text style={styles.p}>
        Hi {data.customerName || 'there'}, a refund of <b>{data.currency} {data.amount}</b> for order{' '}
        <b>{data.orderNumber}</b> has been issued. It may take a few days to appear.
      </Text>
      {data.refundUrl ? (
        <ActionButton href={data.refundUrl} color={data.brand?.brandColor}>View details</ActionButton>
      ) : null}
    </EmailLayout>
  );
}
