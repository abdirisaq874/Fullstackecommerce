import { formatCurrency, countryFlag as flagFor } from '@/lib/utils';
import clsx from 'clsx';

export function Money({ value, currency = 'USD', className }: { value: number; currency?: string; className?: string }) {
  return <span className={clsx('tabular-nums', className)}>{formatCurrency(value, currency)}</span>;
}

export function CountryFlag({ destination }: { destination: string }) {
  return <span aria-hidden>{flagFor(destination)}</span>;
}
