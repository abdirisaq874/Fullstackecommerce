import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function ReturnRequested({ data }: EmailTemplateProps) {
  return (
    <EmailLayout preview="Return request received" brand={data.brand}>
      <Text style={styles.h}>We got your return request</Text>
      <Text style={styles.p}>
        Hi {data.customerName || 'there'}, we’ve received your return request for order <b>{data.orderNumber}</b>.{' '}
        {data.storeName || 'The store'} will review it and get back to you shortly.
      </Text>
      {data.returnUrl ? (
        <ActionButton href={data.returnUrl} color={data.brand?.brandColor}>View request</ActionButton>
      ) : null}
    </EmailLayout>
  );
}
