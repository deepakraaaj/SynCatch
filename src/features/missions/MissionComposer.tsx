import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Input, Textarea } from '../../components/ui/input';
import { MissionIcon, ICON_PRESETS } from '../../components/ui/mission-icon';
import { cn } from '../../lib/cn';
import { MISSION_COLORS, type Mission, type MissionColor, type MissionDraft } from './mission-types';

interface MissionComposerProps {
  initial?: Mission;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit: (draft: MissionDraft) => void | Promise<void>;
}

const COLOR_LABELS: Record<MissionColor, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  teal: '#14b8a6',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
  gray: '#6b7280',
};

interface ComposerState {
  title: string;
  emoji: string;
  color: MissionColor;
  objective: string;
  notes: string;
  showEmojiPicker: boolean;
}

export function MissionComposer({ initial, submitLabel = 'Create mission', onCancel, onSubmit }: MissionComposerProps) {
  const composerId = useId();
  const titleId = `${composerId}-title`;
  const objectiveId = `${composerId}-objective`;
  const notesId = `${composerId}-notes`;
  const titleRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<ComposerState>({
    title: initial?.title ?? '',
    emoji: initial?.emoji ?? 'Target',
    color: initial?.color ?? 'blue',
    objective: initial?.objective ?? '',
    notes: initial?.notes ?? '',
    showEmojiPicker: false,
  });
  const [saving, setSaving] = useState(false);

  const canSave = state.title.trim().length > 0;

  function update<K extends keyof ComposerState>(field: K, value: ComposerState[K]) {
    setState((s) => ({ ...s, [field]: value }));
  }

  useEffect(() => {
    if (!state.showEmojiPicker) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (emojiPickerRef.current?.contains(target)) {
        return;
      }

      update('showEmojiPicker', false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        update('showEmojiPicker', false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.showEmojiPicker]);

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        title: state.title.trim(),
        emoji: state.emoji,
        color: state.color,
        objective: state.objective.trim(),
        notes: state.notes.trim(),
        status: initial?.status ?? 'active',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      {/* Emoji + Title row */}
      <div ref={emojiPickerRef} className="space-y-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-expanded={state.showEmojiPicker}
            onClick={() => update('showEmojiPicker', !state.showEmojiPicker)}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border border-borderSoft/40 bg-panel/40 text-text-primary transition-colors hover:bg-panel/60"
          >
            <MissionIcon icon={state.emoji} className="h-6 w-6" />
          </button>

          <div className="flex-1 space-y-1">
            <label className="block text-[11px] uppercase tracking-[0.28em] text-text-muted" htmlFor={titleId}>
              Mission name
            </label>
            <Input
              ref={titleRef}
              id={titleId}
              value={state.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder='e.g. "Launch v2 beta"'
              className="h-12"
              autoFocus
            />
          </div>
        </div>

        {state.showEmojiPicker ? (
          <div className="rounded-[18px] border border-borderSoft/40 bg-panel/72 p-3 shadow-xl">
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {ICON_PRESETS.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => {
                    update('emoji', iconName);
                    update('showEmojiPicker', false);
                  }}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-[12px] text-text-primary transition-colors hover:bg-panel2/60',
                    state.emoji === iconName ? 'bg-panel2/80 ring-1 ring-accent/35 text-accent' : 'bg-panel/20 text-text-secondary',
                  )}
                >
                  <MissionIcon icon={iconName} className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Color picker */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.28em] text-text-muted">Color</p>
        <div className="flex flex-wrap gap-2">
          {MISSION_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => update('color', color)}
              title={color}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition-transform',
                state.color === color ? 'scale-110 border-white/80' : 'border-transparent hover:scale-105',
              )}
              style={{ backgroundColor: COLOR_LABELS[color] }}
            />
          ))}
        </div>
      </div>

      {/* Objective */}
      <div className="space-y-2">
        <label className="block text-[11px] uppercase tracking-[0.28em] text-text-muted" htmlFor={objectiveId}>
          Objective <span className="text-text-muted/60 normal-case tracking-normal">(optional)</span>
        </label>
        <Textarea
          id={objectiveId}
          value={state.objective}
          onChange={(e) => update('objective', e.target.value)}
          placeholder="What will be true when this mission is complete?"
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="block text-[11px] uppercase tracking-[0.28em] text-text-muted" htmlFor={notesId}>
          Notes <span className="text-text-muted/60 normal-case tracking-normal">(optional)</span>
        </label>
        <Textarea
          id={notesId}
          value={state.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Links, context, anything else."
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-borderSoft/24 pt-4">
        <Button disabled={!canSave || saving} size="md" type="submit">
          {saving ? 'Saving…' : submitLabel}
        </Button>
        {onCancel ? (
          <Button onClick={onCancel} size="md" type="button" variant="ghost">
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
