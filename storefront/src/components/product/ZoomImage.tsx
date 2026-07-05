'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ZoomIn, X } from 'lucide-react';

/** Product image with hover-to-zoom (magnifier) on desktop and tap-to-expand
 *  fullscreen lightbox everywhere. */
export function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(false);
  const [full, setFull] = useState(false);

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setPos({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  };

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={onMove}
        onClick={() => setFull(true)}
        className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-3xl border border-line bg-muted"
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="(max-width:1024px) 100vw, 50vw"
          className="object-cover transition-transform duration-200 ease-out"
          style={zoom ? { transform: 'scale(2.2)', transformOrigin: `${pos.x}% ${pos.y}%` } : undefined}
        />
        <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-semibold text-ink opacity-0 shadow-card backdrop-blur transition group-hover:opacity-100">
          <ZoomIn className="h-3.5 w-3.5" /> Hover to zoom · click to expand
        </span>
      </div>

      {full && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/90 p-4"
          onClick={() => setFull(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Product image"
        >
          <button
            className="focus-ring absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="relative h-full max-h-[86vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <Image src={src} alt={alt} fill className="object-contain" sizes="90vw" />
          </div>
        </div>
      )}
    </>
  );
}
