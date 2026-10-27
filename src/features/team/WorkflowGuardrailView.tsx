import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Circle, ShieldCheck, Plus, User, Calendar, Target } from 'lucide-react';
import { useTeamStore } from './team-store';

interface WorkflowGuardrailViewProps {
  missionId: string;
}

type Dialog = 'process' | 'step' | null;

export function WorkflowGuardrailView({ missionId }: WorkflowGuardrailViewProps) {
  const workflows = useTeamStore((s) => s.workflows);
  const toggleSOPStep = useTeamStore((s) => s.toggleSOPStep);
  const addWorkflow = useTeamStore((s) => s.addWorkflow);
  const addSOPStep = useTeamStore((s) => s.addSOPStep);
  const missionWorkflows = useMemo(
    () => workflows.filter((w) => w.missionId === missionId),
    [workflows, missionId],
  );

  const [selectedId, setSelectedId] = useState('');
  const activeSOP = missionWorkflows.find((w) => w.id === selectedId) ?? missionWorkflows[0];

  const [dialog, setDialog] = useState<Dialog>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [outcomeDraft, setOutcomeDraft] = useState('');

  const openDialog = (which: Exclude<Dialog, null>) => {
    setTitleDraft('');
    setDescriptionDraft('');
    setOutcomeDraft('');
    setDialog(which);
  };

  const submitDialog = (event: React.FormEvent) => {
    event.preventDefault();
    const title = titleDraft.trim();
    if (!title) return;
    if (dialog === 'process') {
      const created = addWorkflow({
        missionId,
        title,
        description: descriptionDraft.trim(),
        targetOutcome: outcomeDraft.trim(),
        steps: [],
        status: 'draft',
      });
      setSelectedId(created.id);
    } else if (dialog === 'step' && activeSOP) {
      addSOPStep(activeSOP.id, { title, description: descriptionDraft.trim() });
    }
    setDialog(null);
  };

  const completedCount = activeSOP?.steps.filter((s) => s.completed).length ?? 0;
  const progressPercent = activeSOP && activeSOP.steps.length > 0
    ? Math.round((completedCount / activeSOP.steps.length) * 100)
    : 0;

  const dialogNode = dialog && createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[3px] sm:items-center"
      onMouseDown={() => setDialog(null)}
    >
      <form
        onSubmit={submitDialog}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === 'Escape') setDialog(null); }}
        className="my-auto w-full max-w-md rounded-2xl border border-borderSoft/45 bg-panel p-4 shadow-2xl sm:p-5"
      >
        <div className="mb-5">
          <h2 className="text-base font-bold text-text-primary">
            {dialog === 'process' ? 'New process' : 'Add step'}
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            {dialog === 'process'
              ? 'A standard operating procedure your team follows end to end.'
              : `Appended to the end of “${activeSOP?.title}”.`}
          </p>
        </div>

        <label htmlFor="sop-title" className="mb-2 block text-xs font-semibold text-text-secondary">
          {dialog === 'process' ? 'Process name' : 'Step title'}
        </label>
        <input
          id="sop-title"
          autoFocus
          required
          maxLength={100}
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          placeholder={dialog === 'process' ? 'e.g. Turf Venue 14-Day Free Pilot SOP' : 'e.g. Generate Printable QR Table Stand'}
          className="w-full rounded-xl border border-borderSoft/50 bg-panel2 px-3.5 py-3 text-sm text-text-primary outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/15"
        />

        <label htmlFor="sop-description" className="mb-2 mt-4 block text-xs font-semibold text-text-secondary">
          {dialog === 'process' ? 'Description' : 'What has to happen'}
        </label>
        <textarea
          id="sop-description"
          rows={3}
          maxLength={400}
          value={descriptionDraft}
          onChange={(event) => setDescriptionDraft(event.target.value)}
          placeholder={dialog === 'process' ? 'What this protocol guarantees.' : 'Enough detail that anyone on the team can run it.'}
          className="w-full resize-none rounded-xl border border-borderSoft/50 bg-panel2 px-3.5 py-3 text-sm text-text-primary outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/15"
        />

        {dialog === 'process' && (
          <>
            <label htmlFor="sop-outcome" className="mb-2 mt-4 block text-xs font-semibold text-text-secondary">
              Target outcome
            </label>
            <input
              id="sop-outcome"
              maxLength={160}
              value={outcomeDraft}
              onChange={(event) => setOutcomeDraft(event.target.value)}
              placeholder="e.g. 3 live bookings within 72 hours"
              className="w-full rounded-xl border border-borderSoft/50 bg-panel2 px-3.5 py-3 text-sm text-text-primary outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/15"
            />
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDialog(null)}
            className="rounded-xl border border-borderSoft/40 px-4 py-2.5 text-xs font-bold text-text-secondary hover:bg-panel2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!titleDraft.trim()}
            className="rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-[rgb(var(--accent-contrast))] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {dialog === 'process' ? 'Create process' : 'Add step'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );

  if (!activeSOP) {
    return (
      <>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-10 text-center sm:p-12">
          <ShieldCheck className="w-10 h-10 text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No SOP Workflow Configured</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Add a step-by-step execution protocol so your team follows standard operating procedures without drifting.
          </p>
          <button
            type="button"
            onClick={() => openDialog('process')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-bold text-[rgb(var(--accent-contrast))]"
          >
            <Plus className="h-4 w-4" />
            New process
          </button>
        </div>
        {dialogNode}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Process switcher + create */}
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-borderSoft/35 bg-panel/55 p-2">
        {missionWorkflows.length > 1 ? (
          // A scrolling strip beats a <select>: every process is visible and
          // one click away, and the active one is obvious.
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
            {missionWorkflows.map((workflow) => {
              const isActive = workflow.id === activeSOP.id;
              const done = workflow.steps.filter((s) => s.completed).length;
              return (
                <button
                  key={workflow.id}
                  type="button"
                  onClick={() => setSelectedId(workflow.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    isActive
                      ? 'bg-accent/14 font-semibold text-accent'
                      : 'font-medium text-text-secondary hover:bg-panel2 hover:text-text-primary'
                  }`}
                >
                  <span className="max-w-[180px] truncate">{workflow.title}</span>
                  <span className={`tabular-nums ${isActive ? 'text-accent/70' : 'text-text-muted'}`}>
                    {done}/{workflow.steps.length}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="min-w-0 flex-1 px-1 text-xs font-medium text-text-secondary">
            {missionWorkflows.length} process · {activeSOP.steps.length} steps
          </div>
        )}
        <button
          type="button"
          onClick={() => openDialog('process')}
          title="New process"
          aria-label="New process"
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg bg-accent px-2.5 py-2 text-xs font-bold text-[rgb(var(--accent-contrast))]"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden md:inline">New</span>
        </button>
      </div>

      {/* SOP Header & Guardrail Progress */}
      <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {activeSOP.title}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${
                  activeSOP.status === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {activeSOP.status.replace('_', ' ')}
                </span>
              </h3>
              {activeSOP.description && <p className="text-xs text-slate-400 mt-0.5">{activeSOP.description}</p>}
            </div>
          </div>

          <div className="ml-auto text-right">
            <div className="text-sm font-bold font-mono text-emerald-400">{progressPercent}% Completed</div>
            <div className="text-[11px] text-slate-500">{completedCount} of {activeSOP.steps.length} Milestones</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {activeSOP.targetOutcome && (
          <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
            <Target className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="font-semibold text-slate-300">Target Outcome:</span>
            <span>{activeSOP.targetOutcome}</span>
          </div>
        )}
      </div>

      {/* Step Sequence List (Guardrails) */}
      <div className="space-y-2.5">
        {activeSOP.steps.map((step, idx) => {
          const isNextUp = !step.completed && (idx === 0 || activeSOP.steps[idx - 1].completed);

          return (
            <div
              key={step.id}
              onClick={() => toggleSOPStep(activeSOP.id, step.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex items-start gap-3.5 ${
                step.completed
                  ? 'bg-slate-900/40 border-emerald-500/30 text-slate-300 hover:bg-slate-900/60'
                  : isNextUp
                  ? 'bg-slate-900 border-amber-500/50 shadow-glow hover:border-amber-400'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:border-slate-700'
              }`}
            >
              {/* Checkbox Icon */}
              <div className="mt-0.5 flex-shrink-0">
                {step.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Circle className={`w-5 h-5 ${isNextUp ? 'text-amber-400' : 'text-slate-600'}`} />
                )}
              </div>

              {/* Step Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">
                    STEP {step.stepNumber}
                  </span>
                  <h4 className={`text-xs font-semibold ${
                    step.completed
                      ? 'text-slate-300 line-through opacity-80'
                      : isNextUp
                      ? 'text-white'
                      : 'text-slate-400'
                  }`}>
                    {step.title}
                  </h4>
                  {isNextUp && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider animate-pulse">
                      Current Action
                    </span>
                  )}
                </div>

                {step.description && (
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {step.description}
                  </p>
                )}

                {step.completed && step.completedBy && (
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-emerald-400/90 font-mono">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> Completed by {step.completedBy}
                    </span>
                    {step.completedAt && (
                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3 h-3" /> {step.completedAt}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => openDialog('step')}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-borderSoft/50 px-3.5 py-3 text-xs font-semibold text-text-secondary transition-colors hover:border-accent/60 hover:bg-panel2 hover:text-text-primary"
        >
          <Plus className="h-4 w-4" />
          Add step
        </button>
      </div>

      {dialogNode}
    </div>
  );
}
