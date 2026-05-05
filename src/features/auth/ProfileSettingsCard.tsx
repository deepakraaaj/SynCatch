import { useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useAuthStore } from './auth-store';
import { showErrorToast, showInfoToast, showSuccessToast } from '../toasts/toast-store';

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

interface ProfileSettingsCardProps {
  completedMissionCount: number;
  completedTaskCount: number;
  missionCount: number;
  rootTaskCount: number;
  sessionCount: number;
  syncModeLabel: string;
}

export function ProfileSettingsCard({
  completedMissionCount,
  completedTaskCount,
  missionCount,
  rootTaskCount,
  sessionCount,
  syncModeLabel,
}: ProfileSettingsCardProps) {
  const session = useAuthStore((state) => state.session);
  const profileSaving = useAuthStore((state) => state.profileSaving);
  const signOut = useAuthStore((state) => state.signOut);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const user = session?.user ?? null;
  const currentDisplayName = getUserDisplayName(user?.user_metadata, user?.email);
  const [displayNameDraft, setDisplayNameDraft] = useState(currentDisplayName);

  useEffect(() => {
    setDisplayNameDraft(currentDisplayName);
  }, [currentDisplayName]);

  if (!user) {
    return null;
  }

  const trimmedDraft = displayNameDraft.trim();
  const canSave = Boolean(trimmedDraft) && trimmedDraft !== currentDisplayName;
  const initials = getInitials(trimmedDraft || currentDisplayName, user.email);
  const completionRate = rootTaskCount ? Math.round((completedTaskCount / rootTaskCount) * 100) : 0;
  const memberSince = formatShortDate(user.created_at);
  const lastSignIn = formatDateTime(user.last_sign_in_at);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  const userIdShort = `${user.id.slice(0, 8)}…${user.id.slice(-4)}`;

  async function handleCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      showSuccessToast(`${label} copied`, 'The value is ready to paste.');
    } catch (error) {
      showErrorToast(
        `Could not copy ${label.toLowerCase()}`,
        error instanceof Error ? error.message : 'Clipboard access was blocked.',
      );
    }
  }

  async function handleSaveProfile() {
    if (!canSave) {
      showInfoToast('No changes to save', 'Edit the display name before saving your profile.');
      return;
    }

    await updateProfile(trimmedDraft);
  }

  return (
    <Card className="rounded-[34px] p-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Badge tone="accent">Account</Badge>
            {user.email_confirmed_at ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Verify email</Badge>}
          </div>
          <h2 className="mt-4 text-xl font-semibold text-text-primary">Profile</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Keep your identity details clear, verify your account status, and check the shape of
            your workspace from one place.
          </p>
        </div>

        <Button onClick={() => void signOut()} size="sm" type="button" variant="secondary">
          Sign out
        </Button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-borderSoft/30 bg-panel/30 p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="accent-avatar flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] text-2xl font-semibold uppercase">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Display name</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <Input
                    onChange={(event) => setDisplayNameDraft(event.target.value)}
                    placeholder="How your profile should appear"
                    value={displayNameDraft}
                  />
                  <Button
                    disabled={!canSave || profileSaving}
                    onClick={() => void handleSaveProfile()}
                    type="button"
                    variant="primary"
                  >
                    {profileSaving ? 'Saving…' : 'Save'}
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoCell
                    actionLabel="Copy"
                    label="Email"
                    onAction={() => void handleCopy(user.email ?? '', 'Email')}
                    value={user.email ?? 'No email'}
                  />
                  <InfoCell
                    actionLabel="Copy"
                    label="User ID"
                    onAction={() => void handleCopy(user.id, 'User ID')}
                    value={userIdShort}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCell label="Member since" value={memberSince} />
            <InfoCell label="Last sign in" value={lastSignIn} />
            <InfoCell label="Sync mode" value={syncModeLabel} />
            <InfoCell label="Time zone" value={timezone} />
          </div>
        </div>

        <div className="rounded-[28px] border border-borderSoft/30 bg-panel/30 p-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Workspace snapshot</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <WorkspaceStat label="Root tasks" tone="accent" value={String(rootTaskCount)} />
            <WorkspaceStat label="Done rate" tone="success" value={`${completionRate}%`} />
            <WorkspaceStat label="Missions" tone="warning" value={String(missionCount)} />
            <WorkspaceStat label="Sessions" tone="neutral" value={String(sessionCount)} />
          </div>

          <div className="mt-4 rounded-[22px] border border-borderSoft/24 bg-panel2/34 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-text-primary">Completion overview</p>
              <span className="text-sm text-text-secondary">
                {completedTaskCount}/{rootTaskCount || 0} tasks
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent/75 to-success/80 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, completionRate))}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              {completedMissionCount} mission{completedMissionCount === 1 ? '' : 's'} completed so far.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function InfoCell({
  label,
  value,
  actionLabel,
  onAction,
}: {
  label: string;
  value: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-[20px] border border-borderSoft/24 bg-panel/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">{label}</p>
        {actionLabel && onAction ? (
          <button
            className="text-xs font-medium text-accent transition-colors hover:text-text-primary"
            onClick={onAction}
            type="button"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}

function WorkspaceStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'accent' | 'success' | 'warning' | 'neutral';
}) {
  const valueTone =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'neutral'
          ? 'text-text-primary'
          : 'text-accent';

  return (
    <div className="rounded-[20px] border border-borderSoft/24 bg-panel2/32 px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">{label}</p>
      <p className={`mt-2 text-[1.6rem] font-semibold leading-none tracking-[-0.05em] ${valueTone}`}>
        {value}
      </p>
    </div>
  );
}

function getUserDisplayName(
  metadata: Record<string, unknown> | undefined,
  email: string | undefined,
) {
  if (metadata?.display_name && typeof metadata.display_name === 'string') {
    return metadata.display_name;
  }

  if (metadata?.full_name && typeof metadata.full_name === 'string') {
    return metadata.full_name;
  }

  if (email) {
    return email.split('@')[0];
  }

  return 'Mission Operator';
}

function getInitials(name: string, email: string | undefined) {
  const source = name.trim() || email?.split('@')[0] || 'MC';
  const parts = source.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  return initials || 'MC';
}

function formatShortDate(value: string | null | undefined) {
  if (!value) {
    return 'Unknown';
  }

  return shortDateFormatter.format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return 'No sign-in yet';
  }

  return dateTimeFormatter.format(new Date(value));
}
