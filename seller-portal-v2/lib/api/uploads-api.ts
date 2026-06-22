/**
 * Uploads RTK Query slice — wired to backend module F6 (`POST /uploads/signed-url`).
 *
 * Two surfaces:
 *
 *   1. `useGetSignedUrlMutation` — RTK Query mutation that hits
 *      `POST /uploads/signed-url` with `{ fileName, contentType, sizeBytes, scope? }`
 *      and returns the signed-URL envelope (`uploadUrl`, `publicUrl`, etc.).
 *      Used directly when callers want to manage the two-step flow themselves
 *      (e.g. progress reporting via XHR).
 *
 *   2. `useUploadFile` — convenience hook that runs both legs end-to-end:
 *        a. get a signed URL,
 *        b. PUT the file bytes to it (via `uploadToSignedUrl` in `upload-helpers.ts`,
 *           which bypasses `baseApi` because the upload target is the storage host,
 *           not our NestJS API).
 *      Returns `{ uploadFile, isLoading, error, reset }`. `uploadFile` resolves
 *      to the `publicUrl` on success and rejects with a friendly Error on failure.
 *
 * No `Upload` tag is registered — uploads aren't tracked server-side, so there's
 * nothing to invalidate.  Any "list of recently uploaded assets" feature that
 * lands later can register its own tag at that time.
 */
import { useCallback, useState } from 'react';
import { baseApi, unwrapEnvelope, type ResponseEnvelope } from './base-api';
import { uploadToSignedUrl } from './upload-helpers';

// --- domain types -----------------------------------------------------------

/** Mirrors backend `UploadScope` in `signed-url-request.dto.ts`. */
export type UploadScope = 'product' | 'logo' | 'document';

/**
 * Mirrors backend allow-list. The backend rejects anything outside this set
 * with a 400; we re-export so client-side validators / file-pickers can use
 * the same source of truth.
 */
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;
export type AllowedUploadContentType = (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — mirrors backend `MAX_UPLOAD_BYTES`.

// --- request / response shapes ---------------------------------------------

export interface SignedUrlRequest {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  scope?: UploadScope;
}

/** Mirrors backend `SignedUrlResponseDto`. */
export interface SignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  fields?: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
}

/**
 * Options for the `useUploadFile` convenience hook. `scope` is forwarded to
 * the signed-url request; `signal` lets callers cancel an in-flight upload.
 */
export interface UploadOptions {
  scope?: UploadScope;
  signal?: AbortSignal;
}

// --- endpoint slice ---------------------------------------------------------

export const uploadsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSignedUrl: builder.mutation<SignedUrlResponse, SignedUrlRequest>({
      query: (body) => ({
        url: '/uploads/signed-url',
        method: 'POST',
        body,
      }),
      transformResponse: (r: ResponseEnvelope<SignedUrlResponse> | SignedUrlResponse) =>
        unwrapEnvelope<SignedUrlResponse>(r),
    }),
  }),
});

export const { useGetSignedUrlMutation } = uploadsApi;

// --- convenience hook -------------------------------------------------------

export interface UseUploadFileResult {
  /**
   * Run the full signed-URL → PUT flow. Resolves with the `publicUrl` on
   * success; rejects with an `Error` whose `.message` is safe to show to
   * the user (e.g. via `toast.error(err.message)`).
   */
  uploadFile: (file: File, options?: UploadOptions) => Promise<string>;
  /** True while either the signed-URL request or the PUT is in flight. */
  isLoading: boolean;
  /** Last error from either leg, cleared on the next successful upload or `reset`. */
  error: Error | null;
  /** Clear local error / loading state without affecting cached signed-URL responses. */
  reset: () => void;
}

/**
 * Two-step upload hook: fetches a signed URL, then PUTs the file bytes to it.
 *
 * Example:
 *
 * ```ts
 * const { uploadFile, isLoading, error } = useUploadFile();
 *
 * async function onSelect(file: File) {
 *   try {
 *     const url = await uploadFile(file, { scope: 'product' });
 *     setImageUrl(url);
 *   } catch (e) {
 *     toast.error((e as Error).message);
 *   }
 * }
 * ```
 */
export function useUploadFile(): UseUploadFileResult {
  const [getSignedUrl, { isLoading: signLoading }] = useGetSignedUrlMutation();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadFile = useCallback(
    async (file: File, options?: UploadOptions): Promise<string> => {
      setError(null);
      setIsUploading(true);
      try {
        // Leg 1: ask backend for a signed URL. `.unwrap()` throws the
        // unwrapped error payload on a non-2xx so we can map it.
        let signed: SignedUrlResponse;
        try {
          signed = await getSignedUrl({
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
            scope: options?.scope,
          }).unwrap();
        } catch (err) {
          // RTK Query mutation errors come back as `FetchBaseQueryError` or
          // `SerializedError` — surface a friendly message either way.
          const message = extractFriendlyMessage(err) ?? 'Could not start upload. Please try again.';
          throw new Error(message);
        }

        // Leg 2: PUT bytes directly to storage. `uploadToSignedUrl` already
        // throws `Error` instances with friendly messages.
        const publicUrl = await uploadToSignedUrl({
          uploadUrl: signed.uploadUrl,
          publicUrl: signed.publicUrl,
          file,
          contentType: file.type,
          fields: signed.fields,
          signal: options?.signal,
        });

        return publicUrl;
      } catch (e) {
        const asError = e instanceof Error ? e : new Error('Upload failed.');
        setError(asError);
        throw asError;
      } finally {
        setIsUploading(false);
      }
    },
    [getSignedUrl],
  );

  const reset = useCallback(() => {
    setError(null);
    setIsUploading(false);
  }, []);

  return {
    uploadFile,
    isLoading: signLoading || isUploading,
    error,
    reset,
  };
}

// --- helpers ----------------------------------------------------------------

/**
 * Best-effort extraction of a user-readable message from an RTK Query error.
 *
 * RTK mutation rejections come as `FetchBaseQueryError` (with `.status` and
 * `.data`) or `SerializedError` (with `.message`). The NestJS envelope
 * surfaces validation errors under `data.message` (string | string[]).
 */
function extractFriendlyMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  // FetchBaseQueryError
  const e = err as { status?: number | string; data?: unknown; message?: string };
  if (e.data && typeof e.data === 'object') {
    const data = e.data as { message?: string | string[]; error?: string };
    if (Array.isArray(data.message)) return data.message[0] ?? null;
    if (typeof data.message === 'string') return data.message;
    if (typeof data.error === 'string') return data.error;
  }
  if (typeof e.message === 'string') return e.message;
  if (typeof e.status === 'number') {
    if (e.status === 413) return 'File is larger than the allowed limit.';
    if (e.status === 400) return 'Invalid file type or size.';
  }
  return null;
}
