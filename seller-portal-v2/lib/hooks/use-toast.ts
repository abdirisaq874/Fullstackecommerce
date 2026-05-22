'use client';

import { useAppDispatch } from '@/lib/api/store';
import { pushToast } from '@/lib/api/ui-slice';

export function useToast() {
  const dispatch = useAppDispatch();
  return {
    success: (text: string) => dispatch(pushToast({ kind: 'success', text })),
    error:   (text: string) => dispatch(pushToast({ kind: 'error',   text })),
    info:    (text: string) => dispatch(pushToast({ kind: 'info',    text })),
  };
}
