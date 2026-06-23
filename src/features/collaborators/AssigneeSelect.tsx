import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Plus, Search, Users, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Badge } from '../../components/ui/badge';
import { useAuthStore } from '../auth/auth-store';
import { useCollaboratorStore } from './collaborator-store';
import { collaboratorLabel, shortUserId } from './collaborator-helpers';
import type { UserProfileResult } from '../../lib/supabase';

interface AssigneeSelectProps {
  value: string[];
  onChange: (assigneeIds: string[]) => void;
  className?: string;
  // Compact renders just the trigger button (no inline chip row below it).
  compact?: boolean;
}

const SUPABASE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL);

export function AssigneeSelect({ value, onChange, className, compact }: AssigneeSelectProps) {
  const collaborators = useCollaboratorStore((s) => s.collaborators);
  const hydrate = useCollaboratorStore((s) => s.hydrate);
  const addCollaborator = useCollaboratorStore((s) => s.addCollaborator);
  const localMode = useAuthStore((s) => s.localMode);

  // Email invite is only possible when signed in to the cloud. Offline we fall
  // back to adding a raw User ID.
  const canInvite = SUPABASE_CONFIGURED && !localMode;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<UserProfileResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!open) return;
    function onClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Reset the lookup result whenever the text changes.
  useEffect(() => {
    setResult(null);
    setSearched(false);
    setError(null);
  }, [input]);

  const byUserId = useMemo(
    () => new Map(collaborators.map((c) => [c.user_id, c])),
    [collaborators],
  );

  const selectedLabels = value.map((id) => {
    const collaborator = byUserId.get(id);
    return { id, label: collaborator ? collaboratorLabel(collaborator) : shortUserId(id) };
  });

  function toggle(userId: string) {
    if (value.includes(userId)) {
      onChange(value.filter((id) => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  }

  function assign(userId: string) {
    if (!value.includes(userId)) onChange([...value, userId]);
  }

  async function handleLookup() {
    const email = input.trim();
    if (!email || looking) return;

    setLooking(true);
    setError(null);
    try {
      const { findUserByEmail } = await import('../../lib/supabase');
      const found = await findUserByEmail(email);
      setResult(found);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed');
      setResult(null);
      setSearched(true);
    } finally {
      setLooking(false);
    }
  }

  async function addResult(profile: UserProfileResult) {
    const created = await addCollaborator({
      user_id: profile.id,
      display_name: profile.display_name,
      email: profile.email,
    });
    if (created) assign(created.user_id);
    setInput('');
    setResult(null);
    setSearched(false);
  }

  // Manual fallback (local mode / no cloud): add a raw User ID.
  async function handleManualAdd() {
    const userId = input.trim();
    if (!userId) return;
    const created = await addCollaborator({ user_id: userId });
    if (created) assign(created.user_id);
    setInput('');
  }

  function submitInput() {
    void (canInvite ? handleLookup() : handleManualAdd());
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-full items-center gap-2 rounded-[14px] border border-borderSoft/40 bg-panel2/60 px-3 text-left text-sm text-text-secondary outline-none transition-colors hover:border-accent/40 focus:border-accent/40"
      >
        <Users className="h-4 w-4 shrink-0 text-text-muted" />
        {value.length === 0 ? (
          <span className="text-text-muted">Assign collaborators…</span>
        ) : (
          <span className="truncate text-text-primary">
            {selectedLabels.map((s) => s.label).join(', ')}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-text-muted">
          {value.length > 0 ? `${value.length}` : ''}
        </span>
      </button>

      {!compact && value.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedLabels.map((s) => (
            <Badge key={s.id} tone="accent" className="gap-1 normal-case tracking-normal">
              {s.label}
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="text-accent/70 hover:text-accent"
                aria-label={`Remove ${s.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="absolute z-50 mt-2 w-full min-w-[280px] overflow-hidden rounded-[18px] border border-borderSoft/40 bg-panel shadow-xl">
          {/* Invite by exact email (cloud) or add by User ID (offline).
              NOTE: this is a <div>, not a <form> — AssigneeSelect is rendered
              inside other <form>s and nested forms are invalid HTML. */}
          <div className="flex items-center gap-1.5 border-b border-borderSoft/30 p-1.5">
            <span className="pl-1.5 text-text-muted">
              {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </span>
            <input
              autoFocus
              type={canInvite ? 'email' : 'text'}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitInput();
                }
              }}
              placeholder={canInvite ? 'Invite by email (e.g. name@company.com)' : 'Add by User ID'}
              className="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
            {input.trim() ? (
              <button
                type="button"
                onClick={submitInput}
                disabled={looking}
                className="flex h-7 shrink-0 items-center gap-1 rounded-[10px] bg-accent/15 px-2 text-xs font-medium text-accent disabled:opacity-40"
              >
                {canInvite ? 'Find' : <Plus className="h-4 w-4" />}
              </button>
            ) : null}
          </div>

          <div className="max-h-60 overflow-y-auto p-1.5">
            {/* Email lookup result */}
            {canInvite && searched ? (
              error ? (
                <p className="px-3 py-3 text-center text-xs text-warning">{error}</p>
              ) : result ? (
                <button
                  type="button"
                  onClick={() => void addResult(result)}
                  className="flex w-full items-center gap-2.5 rounded-[12px] border border-accent/30 bg-accent/[0.06] px-2.5 py-2 text-left text-sm hover:bg-accent/10"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-text-primary">
                      {result.display_name || result.email}
                    </span>
                    {result.email ? (
                      <span className="block truncate text-[10px] text-text-muted">{result.email}</span>
                    ) : null}
                  </span>
                </button>
              ) : (
                <p className="px-3 py-3 text-center text-xs text-text-muted">
                  No user found with that email.
                </p>
              )
            ) : collaborators.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-text-muted">
                {canInvite
                  ? 'Invite a teammate by their exact email above.'
                  : 'No collaborators yet. Add one by User ID above.'}
              </p>
            ) : (
              collaborators.map((collaborator) => {
                const checked = value.includes(collaborator.user_id);
                return (
                  <button
                    key={collaborator.id}
                    type="button"
                    onClick={() => toggle(collaborator.user_id)}
                    className="flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-sm hover:bg-panel2/60"
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        checked ? 'border-accent bg-accent text-white' : 'border-borderSoft/50',
                      )}
                    >
                      {checked ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-text-primary">
                        {collaboratorLabel(collaborator)}
                      </span>
                      {collaborator.email || collaborator.display_name ? (
                        <span className="block truncate text-[10px] text-text-muted">
                          {collaborator.email || shortUserId(collaborator.user_id)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
