// Identifies a not-signed-in shopper's cart. Shoppers can fill a cart before
// they have an account; the backend keeps that cart in Redis keyed by this id
// and folds it into the user's cart at login/signup (see AuthService).
//
// Deliberately NOT a cookie: it is only ever read by our own fetch layer, so
// localStorage keeps it out of every request to every other origin.
const KEY = 'suuq:cartId';

/** Random enough to avoid collisions; not a security boundary. */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * The current guest cart id, creating one on first use. Returns undefined during
 * SSR, where there is no cart to act on and no storage to read.
 */
export function getCartId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = newId();
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage disabled — the shopper still browses fine, they
    // just don't get a persistent guest cart.
    return undefined;
  }
}

/** Read without creating — for callers that must not mint an id as a side effect. */
export function peekCartId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem(KEY) || undefined;
  } catch {
    return undefined;
  }
}

/** Drop the guest id once the backend has merged that cart into a user's. */
export function clearCartId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}
