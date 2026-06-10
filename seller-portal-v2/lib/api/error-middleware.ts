import { isRejectedWithValue, type Middleware } from '@reduxjs/toolkit';
import { toast } from 'sonner';

/**
 * Shape returned by the NestJS HttpExceptionFilter on the backend:
 *   { success: false, statusCode, message, errors?, timestamp, path }
 * RTK Query wraps this in a FetchBaseQueryError as
 *   { status: number, data: { message: string, ... } }
 *
 * We try several fallbacks so we always show *something* meaningful.
 */
function extractErrorMessage(payload: unknown, fallback = 'Something went wrong'): string {
  if (!payload || typeof payload !== 'object') return fallback;

  const p = payload as Record<string, unknown>;

  // FetchBaseQueryError: { status, data: { message } }
  const data = p.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.message === 'string' && d.message.trim()) return d.message;
    if (Array.isArray(d.message) && d.message.length > 0) return String(d.message[0]);
    if (typeof d.error === 'string' && d.error.trim()) return d.error;
  }

  // FETCH_ERROR / PARSING_ERROR / CUSTOM_ERROR: { status, error: 'msg' }
  if (typeof p.error === 'string' && p.error.trim()) return p.error;

  // SerializedError: { message }
  if (typeof p.message === 'string' && p.message.trim()) return p.message;

  return fallback;
}

/**
 * Redux middleware that surfaces RTK Query mutation errors as toast notifications.
 * Observes rejected actions only — never blocks or swallows them.
 */
export const rtkQueryErrorMiddleware: Middleware = () => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    const message = extractErrorMessage(action.payload);
    toast.error(message);
  }
  return next(action);
};
