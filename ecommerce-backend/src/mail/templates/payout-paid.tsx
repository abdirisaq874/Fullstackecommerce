import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function PayoutPaid({ data }: EmailTemplateProps) {
  return (
    <EmailLayout preview="You’ve been paid" brand={data.brand}>
      <Text style={styles.h}>Payout sent 🏦</Text>
      <Text style={styles.p}>
        {data.storeName || 'Your store'} has been paid <b>{data.currency} {data.amount}</b>
        {data.periodLabel ? ` for ${data.periodLabel}` : ''}. Reference: {data.payoutRef}.
      </Text>
      {data.financeUrl ? (
        <ActionButton href={data.financeUrl} color={data.brand?.brandColor}>View earnings</ActionButton>
      ) : null}
    </EmailLayout>
  );
}
