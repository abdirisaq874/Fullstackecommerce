'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ZoomIn, Expand } from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';

export type GalleryImage = { url: string; altText?: string };

/**
 * Gallery main image with:
 *  - Desktop hover-magnifier (fine-pointer only), zooming the whole product
 *    (object-contain) from a high-res source so magnified detail stays crisp.
 *  - Tap/click to open a fullscreen lightbox spanning ALL gallery images with
 *    pinch-zoom + pan (mobile), wheel/double-click zoom (desktop), swipe/arrow/
 *    thumbnail navigation, Escape, and focus handling (via the lightbox lib).
 *
 * The lightbox is fed the original image URLs directly (not the Next-optimized
 * downscale) so zoom uses full resolution.
 */
export function ZoomImage({
  images,
  index,
  alt,
  onIndexChange,
}: {
  images: GalleryImage[];
  index: number;
  alt: string;
  onIndexChange?: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(false);
  const [open, setOpen] = useState(false);
  // Frozen at open-time so the view-sync callback (which updates the parent's
  // active index) can never feed back into the lightbox's initial-index prop.
  const [openIndex, setOpenIndex] = useState(0);
  const [canHover, setCanHover] = useState(false);

  // Hover-magnifier only makes sense on devices with a precise pointer. Touch
  // devices get the pinch-zoom lightbox instead.
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const safeIndex = Math.min(Math.max(index, 0), Math.max(images.length - 1, 0));
  const current = images[safeIndex];
  const src = current?.url;

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setPos({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  };

  const slides = images.map((im) => ({ src: im.url, alt: im.altText || alt }));

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={() => canHover && setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={canHover ? onMove : undefined}
        onClick={() => {
          setOpenIndex(safeIndex);
          setOpen(true);
        }}
        className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-3xl border border-line bg-muted"
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            priority
            // Deliberately request a large source on desktop so the hover
            // magnifier has real pixels to enlarge (mobile gets its display size).
            sizes="(max-width:1024px) 100vw, 1400px"
            quality={85}
            className="object-contain transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={zoom ? { transform: 'scale(2.4)', transformOrigin: `${pos.x}% ${pos.y}%` } : undefined}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-muted-fg">No image</div>
        )}

        <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-semibold text-ink opacity-0 shadow-card backdrop-blur transition group-hover:opacity-100">
          {canHover ? (
            <>
              <ZoomIn className="h-3.5 w-3.5" /> Hover to zoom · click to expand
            </>
          ) : (
            <>
              <Expand className="h-3.5 w-3.5" /> Tap to zoom
            </>
          )}
        </span>
      </div>

      {src && (
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          index={openIndex}
          slides={slides}
          on={{ view: ({ index: i }) => onIndexChange?.(i) }}
          plugins={
            images.length > 1 ? [Zoom, Counter, Thumbnails] : [Zoom, Counter]
          }
          zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true, doubleTapDelay: 250 }}
          counter={{ container: { style: { top: 'unset', bottom: 0 } } }}
          carousel={{ finite: images.length <= 1 }}
          thumbnails={{ vignette: false }}
          styles={{ container: { backgroundColor: 'rgba(15, 23, 42, 0.94)' } }}
          controller={{ closeOnBackdropClick: true }}
        />
      )}
    </>
  );
}
