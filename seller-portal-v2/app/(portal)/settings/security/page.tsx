'use client';

import Link from 'next/link';
import { KeyRound, Monitor, Shield } from 'lucide-react';
import { Card } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Badge } from '@/components/primitives/badge';
import { SettingsShell } from '../_components/settings-shell';

/**
 * Security settings.
 *
 * The seller-settings backend module does not store anything security-related,
 * so this page is mostly informational. We link out to the existing
 * forgot-password flow (the only auth endpoint that mutates a password today,
 * see ecommerce-backend/src/auth/auth.controller.ts) and stub the other
 * controls.
 *
 * TODO(backend):
 *   - PATCH /auth/change-password  (in-session password change)
 *   - GET   /auth/sessions         (list active refresh tokens / devices)
 *   - DELETE /auth/sessions/:id    (revoke a session)
 *   - POST  /auth/2fa/enable etc.  (TOTP enrollment)
 */
export default function SecuritySettingsPage() {
  return (
    <SettingsShell title="Security" subtitle="Password, sessions, and two-factor authentication">
      <div className="space-y-4">
        {/* Change password ───────────────────────────────────────────────── */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 grid place-items-center shrink-0">
              <KeyRound className="w-4 h-4 text-brand-700" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-stone-900">Password</h3>
              <p className="text-xs text-stone-500 mt-1">
                Use the password reset flow to set a new password. We&apos;ll email you a secure link.
              </p>
            </div>
            <Link href="/forgot-password">
              <Button variant="secondary">Change password</Button>
            </Link>
          </div>
          {/* TODO(backend): replace with an in-session PATCH /auth/change-password
              once that endpoint exists so users don't need to leave the portal. */}
        </Card>

        {/* Active sessions ───────────────────────────────────────────────── */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-stone-100 grid place-items-center shrink-0">
              <Monitor className="w-4 h-4 text-stone-600" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-stone-900">Active sessions</h3>
                <Badge variant="neutral">Coming soon</Badge>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                See which devices are signed in to your account and revoke any you don&apos;t recognise.
              </p>
            </div>
            <Button variant="secondary" disabled>
              View sessions
            </Button>
          </div>
        </Card>

        {/* 2FA ──────────────────────────────────────────────────────────── */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-stone-100 grid place-items-center shrink-0">
              <Shield className="w-4 h-4 text-stone-600" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-medium text-stone-900">Two-factor authentication</h3>
                <Badge variant="neutral">Coming soon</Badge>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Require a one-time code from an authenticator app on every sign-in.
              </p>
            </div>
            <Button variant="secondary" disabled>
              Enable 2FA
            </Button>
          </div>
        </Card>
      </div>
    </SettingsShell>
  );
}
