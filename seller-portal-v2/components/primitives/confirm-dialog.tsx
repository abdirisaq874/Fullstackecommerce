'use client';

import type { ReactNode } from 'react';
import { Modal } from '@/components/primitives/modal';
import { Button } from '@/components/primitives/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual weight of the confirm button — use `danger` for destructive actions. */
  variant?: 'primary' | 'danger';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Reusable confirmation dialog built on the Modal primitive. Replaces native
 * `window.confirm()` so confirmations are styled, keyboard-dismissible, and can
 * reflect in-flight state via `loading`.
 */
export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'primary', loading, onConfirm, onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} size="sm" title={title}>
      <div className="px-6 py-5">
        {message && <div className="text-sm text-stone-600">{message}</div>}
        <div className="flex justify-end gap-2 mt-6">
          <Button onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button variant={variant} onClick={onConfirm} disabled={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}