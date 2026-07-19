import type { ReactNode } from 'react';
import { Button } from '@react-email/components';

interface Props {
  href: string;
  color?: string;
  children: ReactNode;
}

export function ActionButton({ href, color = '#1a2744', children }: Props) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: color,
        color: '#ffffff',
        padding: '11px 22px',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 'bold',
        textDecoration: 'none',
        display: 'inline-block',
      }}
    >
      {children}
    </Button>
  );
}
