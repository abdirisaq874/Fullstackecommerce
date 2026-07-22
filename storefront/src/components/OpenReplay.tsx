'use client';

import { useEffect, useRef } from 'react';
import type Tracker from '@openreplay/tracker';
import { useAppSelector } from '@/store';

// Project key is required; ingestPoint is only for a self-hosted OpenReplay
// server (leave unset to use the openreplay.com cloud default). Both are public
// (they ship in client JS), like the Meta pixel id.
const PROJECT_KEY = process.env.NEXT_PUBLIC_OPENREPLAY_PROJECT_KEY;
const INGEST_POINT = process.env.NEXT_PUBLIC_OPENREPLAY_INGEST_POINT;

// Module-level singleton so the tracker starts exactly once per tab (survives
// React StrictMode's double-mount in dev).
let trackerInstance: Tracker | null = null;

async function ensureTracker(): Promise<Tracker | null> {
  if (typeof window === 'undefined' || !PROJECT_KEY) return null;
  if (trackerInstance) return trackerInstance;

  const { default: TrackerCtor } = await import('@openreplay/tracker');
  trackerInstance = new TrackerCtor({
    projectKey: PROJECT_KEY,
    // Passing `ingestPoint: undefined` would clobber the tracker's cloud
    // default, so only include it when self-hosting.
    ...(INGEST_POINT ? { ingestPoint: INGEST_POINT } : {}),
    obscureInputEmails: true,
    // Capture network calls (RTK Query/fetch) for debugging, with auth headers
    // and sensitive bodies stripped. Network tracking is built into the tracker.
    network: {
      capturePayload: true,
      ignoreHeaders: ['authorization', 'cookie', 'set-cookie', 'x-csrf-token', 'x-api-key'],
      sanitiser: sanitiseNetwork,
      failuresOnly: false,
      sessionTokenHeader: false,
      captureInIframes: true,
    },
  } as ConstructorParameters<typeof TrackerCtor>[0]);
  await trackerInstance.start();
  return trackerInstance;
}

// Defer the (large) tracker bundle + start to main-thread idle so it never
// competes with first paint, hydration, or the initial data fetches.
function runWhenIdle(fn: () => void, timeout = 5000): () => void {
  if (typeof window === 'undefined') return () => {};
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(fn, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, timeout);
  return () => window.clearTimeout(id);
}

// Body fields that must never appear in recordings — replaced before the payload
// reaches OpenReplay.
const SENSITIVE_BODY_KEYS =
  /^(password|newpassword|confirmpassword|currentpassword|token|refreshtoken|accesstoken|otp|cardnumber|cvv|cvc|pan|securitycode)$/i;

function redactBody(body: unknown): unknown {
  if (body == null) return body;
  if (typeof body === 'string') {
    try {
      return JSON.stringify(redactBody(JSON.parse(body)));
    } catch {
      return body;
    }
  }
  if (Array.isArray(body)) return body.map(redactBody);
  if (typeof body === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      out[k] = SENSITIVE_BODY_KEYS.test(k) ? '[REDACTED]' : redactBody(v);
    }
    return out;
  }
  return body;
}

function sanitiseNetwork(data: any): any {
  if (data?.request) data.request.body = redactBody(data.request.body);
  if (data?.response) data.response.body = redactBody(data.response.body);
  return data;
}

/**
 * Loads OpenReplay session replay for the storefront. No-op until
 * NEXT_PUBLIC_OPENREPLAY_PROJECT_KEY is set, so it's safe to ship dormant.
 */
export function OpenReplay() {
  const user = useAppSelector((s) => s.auth.user);
  const identifiedRef = useRef<string | null>(null);

  // Start once on mount (deferred to idle; no-op without a project key).
  useEffect(() => runWhenIdle(() => void ensureTracker(), 5000), []);

  // Identify the shopper once a session is known, so replays are searchable by
  // email and tagged with role/id.
  useEffect(() => {
    if (!user?.email || identifiedRef.current === user.email) return;
    void ensureTracker().then((tracker) => {
      if (!tracker) return;
      tracker.setUserID(user.email);
      tracker.setMetadata('userId', user._id || '');
      tracker.setMetadata('role', user.role || '');
      identifiedRef.current = user.email;
    });
  }, [user]);

  return null;
}
