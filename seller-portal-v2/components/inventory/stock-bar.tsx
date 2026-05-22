import clsx from 'clsx';

export function StockBar({
  onHand, available, reorderThreshold, className,
}: {
  onHand: number;
  available: number;
  reorderThreshold: number;
  className?: string;
}) {
  const max = Math.max(onHand, reorderThreshold * 2, 10);
  const reserved = onHand - available;
  const isOut = onHand === 0;
  const isLow = available <= reorderThreshold && !isOut;

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden relative">
        {/* Reorder threshold marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-500"
          style={{ left: `${(reorderThreshold / max) * 100}%` }}
          title={`Reorder threshold: ${reorderThreshold}`}
        />
        {/* Available */}
        <div
          className={clsx(
            'h-full rounded-full',
            isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-brand-600'
          )}
          style={{ width: `${(available / max) * 100}%` }}
        />
        {/* Reserved (overlay) */}
        {reserved > 0 && (
          <div
            className="absolute top-0 h-full bg-stone-400 opacity-60"
            style={{ left: `${(available / max) * 100}%`, width: `${(reserved / max) * 100}%` }}
          />
        )}
      </div>
      <span className={clsx(
        'text-xs tabular-nums shrink-0 w-12 text-right',
        isOut ? 'text-red-600 font-medium' : isLow ? 'text-amber-700 font-medium' : 'text-stone-700'
      )}>
        {available}/{onHand}
      </span>
    </div>
  );
}
