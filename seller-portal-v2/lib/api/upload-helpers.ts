/**
 * Direct-to-CDN upload helper.
 *
 * The signed-url flow has two legs:
 *   1. POST /uploads/signed-url   → returns `{ uploadUrl, publicUrl, fields?, ... }`
 *   2. PUT  <uploadUrl>           → uploads the raw file bytes
 *
 * Leg 2 bypasses our RTK Query `baseApi` entirely: it talks to a third-party
 * storage host (S3 / Cloudinary), needs no `Authorization` header, must NOT
 * include the JSON envelope, and rejects request-id headers as unsigned. So
 * we use a plain `fetch` here and surface a friendly error string on failure.
 *
 * Kept in its own module (rather than inlined into `uploads-api.ts`) so it
 * can be unit-tested without dragging in the Redux store and so future
 * variations (e.g. multipart S3 POST forms) live in one place.
 */

export interface UploadToSignedUrlParams {
  uploadUrl: string;
  publicUrl: string;
  file: File | Blob;
  contentType: string;
  /**
   * Optional POST form fields (S3 POST policy style). When present, we POST
   * a multipart form instead of issuing a PUT. The stubbed backend doesn't
   * return any today, but the contract supports it.
   */
  fields?: Record<string, string>;
  /**
   * Abort signal for cancelling an in-flight upload (e.g. component unmount,
   * user-pressed cancel). Passed straight to `fetch`.
   */
  signal?: AbortSignal;
}

/**
 * Map a fetch failure / non-2xx response to a short, user-readable message.
 * Storage providers tend to return XML error bodies that we don't try to
 * parse — surface the HTTP status and a generic phrase instead.
 */
function friendlyUploadError(status: number, statusText: string): string {
  if (status === 0) return 'Upload failed: network error. Please check your connection.';
  if (status === 401 || status === 403) {
    return 'Upload failed: the signed URL was rejected. Please try again.';
  }
  if (status === 413) return 'Upload failed: file is larger than the allowed limit.';
  if (status >= 500) return 'Upload failed: the storage service is unavailable.';
  return `Upload failed (${status} ${statusText || 'error'}).`;
}

/**
 * PUT (or POST, when `fields` are present) the given blob to the pre-signed
 * URL. Resolves with `publicUrl` on success, throws an `Error` with a
 * friendly message otherwise.
 */
export async function uploadToSignedUrl({
  uploadUrl,
  publicUrl,
  file,
  contentType,
  fields,
  signal,
}: UploadToSignedUrlParams): Promise<string> {
  try {
    let response: Response;

    if (fields && Object.keys(fields).length > 0) {
      // S3 POST policy flow: form fields + the file last.
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        form.append(key, value);
      }
      form.append('file', file);
      response = await fetch(uploadUrl, {
        method: 'POST',
        body: form,
        signal,
      });
    } else {
      response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
        signal,
      });
    }

    if (!response.ok) {
      throw new Error(friendlyUploadError(response.status, response.statusText));
    }

    return publicUrl;
  } catch (err) {
    if (err instanceof Error) {
      // AbortError → caller-initiated cancellation, surface as-is.
      if (err.name === 'AbortError') throw err;
      // Already-friendly errors thrown above pass through unchanged.
      if (err.message.startsWith('Upload failed')) throw err;
      throw new Error(`Upload failed: ${err.message}`);
    }
    throw new Error('Upload failed: unknown error.');
  }
}
