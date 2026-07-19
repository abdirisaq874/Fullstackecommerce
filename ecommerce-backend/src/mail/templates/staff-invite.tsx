import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function StaffInvite({ data }: EmailTemplateProps) {
  return (
    <EmailLayout preview={`Join ${data.storeName || 'the store'} on Gaarsii`} brand={data.brand}>
      <Text style={styles.h}>You’ve been invited 👋</Text>
      <Text style={styles.p}>
        {data.inviterName ? `${data.inviterName} invited you` : 'You’ve been invited'} to join{' '}
        <b>{data.storeName || 'a store'}</b> as {data.role || 'staff'} on Gaarsii.
      </Text>
      <ActionButton href={data.acceptUrl} color={data.brand?.brandColor}>Accept invite</ActionButton>
      <Text style={styles.muted}>If you weren’t expecting this, you can ignore this email.</Text>
    </EmailLayout>
  );
}
