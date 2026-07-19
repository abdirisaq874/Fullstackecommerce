import { Text } from '@react-email/components';
import { EmailLayout, styles } from './components/EmailLayout';
import { ActionButton } from './components/ActionButton';
import type { EmailTemplateProps } from './registry';

export default function EmailVerification({ data }: EmailTemplateProps) {
  return (
    <EmailLayout preview="Verify your email" brand={data.brand}>
      <Text style={styles.h}>Verify your email</Text>
      <Text style={styles.p}>
        Hi {data.name || 'there'}, please confirm your email address to activate your account.
      </Text>
      <ActionButton href={data.verifyUrl} color={data.brand?.brandColor}>Verify email</ActionButton>
      <Text style={styles.muted}>
        This link expires in 24 hours. If you didn’t create an account, you can ignore this email.
      </Text>
    </EmailLayout>
  );
}
