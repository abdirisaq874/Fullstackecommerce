import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function PasswordReset({ data }: EmailTemplateProps) {
  return (
    <EmailLayout preview="Reset your password" brand={data.brand}>
      <Text style={styles.h}>Reset your password</Text>
      <Text style={styles.p}>
        Hi {data.name || 'there'}, we received a request to reset your password. Click below to choose a new one.
      </Text>
      <ActionButton href={data.resetUrl} color={data.brand?.brandColor}>Reset password</ActionButton>
      <Text style={styles.muted}>
        This link expires in 1 hour. If you didn’t request this, you can safely ignore it.
      </Text>
    </EmailLayout>
  );
}
