import * as React from 'react';
import { Star } from 'lucide-react';
import { cn, formatPrice, discountPercent } from '@/lib/utils';

export { Button } from './button';
export { Input } from './input';

// ── Container ──
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('container', className)}>{children}</div>;
}

// ── Section heading ──
export function SectionHeading({
  eyebrow, title, action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <span className="text-xs font-bold uppercase tracking-widest text-accent">{eyebrow}</span>
        )}
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ── Badge ──
type BadgeVariant = 'brand' | 'sale' | 'neutral' | 'success' | 'outline';
const badgeVariants: Record<BadgeVariant, string> = {
  brand: 'bg-brand text-brand-fg',
  sale: 'bg-sale text-sale-fg',
  neutral: 'bg-muted text-muted-fg',
  success: 'bg-success/15 text-success',
  outline: 'border border-line text-ink',
};
export function Badge({
  children, variant = 'neutral', className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold', badgeVariants[variant], className)}>
      {children}
    </span>
  );
}

// ── Skeleton ──
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} />;
}

// ── Spinner ──
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      role="status"
      aria-label="Loading"
    />
  );
}

// ── Star rating ──
export function Rating({ value = 0, count, size = 14 }: { value?: number; count?: number; size?: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Rated ${value} of 5`}>
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={i < Math.round(value) ? 'fill-sale text-sale' : 'fill-muted text-muted'}
          />
        ))}
      </div>
      {count !== undefined && <span className="text-xs text-muted-fg">({count})</span>}
    </div>
  );
}

// ── Price with compare-at + discount ──
export function Price({
  amount, compareAt, currency = 'USD', className,
}: {
  amount: number;
  compareAt?: number;
  currency?: string;
  className?: string;
}) {
  const pct = discountPercent(amount, compareAt);
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="font-display text-lg font-extrabold text-ink">{formatPrice(amount, currency)}</span>
      {pct && (
        <>
          <span className="text-sm text-muted-fg line-through">{formatPrice(compareAt, currency)}</span>
          <Badge variant="sale">-{pct}%</Badge>
        </>
      )}
    </div>
  );
}

// ── Quantity stepper ──
export function QtyStepper({
  value, onChange, min = 1, max = 99,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex h-11 items-center rounded-xl border-2 border-line">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="focus-ring h-full w-10 text-lg font-bold text-ink hover:text-brand disabled:opacity-40"
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="w-10 text-center font-bold" aria-live="polite">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="focus-ring h-full w-10 text-lg font-bold text-ink hover:text-brand disabled:opacity-40"
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}

// ── Empty state ──
export function EmptyState({
  icon, title, description, action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line py-16 text-center">
      {icon && <div className="mb-4 text-muted-fg">{icon}</div>}
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-muted-fg">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
