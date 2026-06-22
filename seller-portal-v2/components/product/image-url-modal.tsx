'use client';

import { useState, useEffect } from 'react';
import { ImageIcon, Loader2, AlertCircle, Check } from 'lucide-react';
import { Modal } from '@/components/primitives/modal';
import { Button } from '@/components/primitives/button';
import { Field, Input } from '@/components/primitives/field';

interface ImageUrlModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (url: string, altText: string) => void;
}

type Status = 'idle' | 'loading' | 'ok' | 'error';

/**
 * Styled replacement for the old `window.prompt('Image URL:')`. Probes the URL
 * by loading it in a detached Image and only lets the seller add it once it
 * actually decodes — so a broken/invalid link never becomes a broken thumbnail.
 */
export function ImageUrlModal({ open, onClose, onAdd }: ImageUrlModalProps) {
  const [url, setUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  // Reset fields each time the modal is (re)opened.
  useEffect(() => {
    if (open) { setUrl(''); setAltText(''); setStatus('idle'); }
  }, [open]);

  // Validate by actually decoding the image. `cancelled` guards against a
  // stale probe resolving after the user has typed a newer URL.
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) { setStatus('idle'); return; }
    setStatus('loading');
    const img = new window.Image();
    let cancelled = false;
    img.onload = () => { if (!cancelled) setStatus('ok'); };
    img.onerror = () => { if (!cancelled) setStatus('error'); };
    img.src = trimmed;
    return () => { cancelled = true; };
  }, [url]);

  const canAdd = status === 'ok';

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(url.trim(), altText.trim());
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Add image" subtitle="Paste a direct link to an image file">
      <div className="px-6 py-5 space-y-4">
        <Field
          label="Image URL"
          error={status === 'error' ? 'Couldn’t load an image from this URL — check the link.' : undefined}
          hint={
            status === 'loading' ? 'Checking…'
              : status === 'ok' ? 'Image loaded ✓'
                : status === 'idle' ? 'e.g. https://…/photo.jpg'
                  : undefined
          }
        >
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="https://…"
            autoFocus
          />
        </Field>

        {/* Live preview */}
        <div className="aspect-video bg-stone-100 border border-stone-200 rounded-lg grid place-items-center overflow-hidden">
          {status === 'ok' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url.trim()} alt={altText || 'Preview'} className="w-full h-full object-contain" />
          ) : status === 'loading' ? (
            <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
          ) : status === 'error' ? (
            <div className="flex flex-col items-center gap-1.5 text-red-500 text-xs">
              <AlertCircle className="w-7 h-7" />
              Couldn’t load image
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-stone-400 text-xs">
              <ImageIcon className="w-8 h-8" />
              Preview appears here
            </div>
          )}
        </div>

        <Field label="Alt text" hint="Describes the image for accessibility & SEO (optional)">
          <Input
            value={altText}
            onChange={e => setAltText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Navy cotton kaftan, front view"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd} disabled={!canAdd}>
            {status === 'ok' && <Check className="w-3.5 h-3.5" />} Add image
          </Button>
        </div>
      </div>
    </Modal>
  );
}