import type { ReactNode } from 'react';
import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from '@react-email/components';

export interface EmailBrand {
  name?: string;
  logoUrl?: string;
  supportEmail?: string;
  addressLine?: string;
  brandColor?: string;
}

interface Props {
  preview: string;
  brand?: EmailBrand;
  children: ReactNode;
}

/** Shared wrapper for every email: branded header, content, footer. */
export function EmailLayout({ preview, brand, children }: Props) {
  const color = brand?.brandColor || '#1a2744';
  const name = brand?.name || 'Gaarsii';
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: '24px 0' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: '8px', maxWidth: '560px', margin: '0 auto', overflow: 'hidden' }}>
          <Section style={{ backgroundColor: color, padding: '20px 28px' }}>
            {brand?.logoUrl ? (
              <Img src={brand.logoUrl} alt={name} height="32" style={{ maxHeight: '32px' }} />
            ) : (
              <Text style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{name}</Text>
            )}
          </Section>
          <Section style={{ padding: '28px' }}>{children}</Section>
          <Hr style={{ borderColor: '#e4e4e7', margin: 0 }} />
          <Section style={{ padding: '18px 28px' }}>
            <Text style={{ color: '#71717a', fontSize: '12px', margin: 0 }}>
              {name}
              {brand?.addressLine ? ` · ${brand.addressLine}` : ''}
            </Text>
            {brand?.supportEmail ? (
              <Text style={{ color: '#71717a', fontSize: '12px', margin: '4px 0 0' }}>
                Questions? <Link href={`mailto:${brand.supportEmail}`} style={{ color }}>{brand.supportEmail}</Link>
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Shared inline styles so templates stay DRY. */
export const styles = {
  h: { fontSize: '20px', color: '#18181b', margin: '0 0 12px', fontWeight: 'bold' as const },
  p: { fontSize: '14px', color: '#3f3f46', lineHeight: '22px', margin: '0 0 14px' },
  muted: { fontSize: '13px', color: '#71717a', margin: '0 0 10px' },
};
