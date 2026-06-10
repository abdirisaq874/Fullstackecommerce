'use client';

import { Users } from 'lucide-react';
import { Card } from '@/components/primitives/card';
import { EmptyState } from '@/components/data/states';
import { SettingsShell } from '../_components/settings-shell';

/**
 * Team / staff accounts.
 *
 * TODO(backend): no team-management endpoints exist yet. We need:
 *   - POST   /seller/me/team/invites           — invite an email at a role
 *   - GET    /seller/me/team                   — list members (active + pending)
 *   - PATCH  /seller/me/team/:userId           — change role
 *   - DELETE /seller/me/team/:userId           — remove a member
 * Until those land, this page is intentionally a placeholder.
 */
export default function TeamSettingsPage() {
  return (
    <SettingsShell title="Team" subtitle="Staff accounts, roles, and permissions">
      <Card>
        <EmptyState
          icon={Users}
          title="Team management is coming soon"
          description="Inviting teammates and assigning roles will be available once the backend exposes team-invite endpoints. We'll notify you the moment it's ready."
        />
      </Card>
    </SettingsShell>
  );
}
