import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  Plus,
  ArrowRight,
  Activity,
  Dumbbell,
  Tag,
  Compass,
  Layers,
  Search,
  AlertOctagon,
  CalendarDays,
  Pin,
  FolderPlus,
  FolderKanban,
  CheckSquare,
  Handshake,
  Crown,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTeamStore } from './team-store';
import { UnifiedMissionHub } from './UnifiedMissionHub';
import type { TeamMissionItem } from './team-types';
import { getActiveTeamRoom, useTeamRoomStore } from './team-room-store';

type StatusFilter = 'all' | TeamMissionItem['status'];

const STATUS_COPY: Record<TeamMissionItem['status'], string> = {
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
};

const STATUS_PILL: Record<TeamMissionItem['status'], string> = {
  active: 'border-success/30 bg-success/12 text-success',
  on_hold: 'border-warning/30 bg-warning/12 text-warning',
  completed: 'border-borderSoft/50 bg-panel2 text-text-secondary',
};

const formatDueDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export function TeamHubView() {
  const teamMissions = useTeamStore((s) => s.teamMissions);
  const addTeamMission = useTeamStore((s) => s.addTeamMission);
  const roomState = useTeamRoomStore();
  const activeRoom = getActiveTeamRoom(roomState);
  const isRoomAdmin = activeRoom?.role === 'owner' || activeRoom?.role === 'admin';
  const leads = useTeamStore((s) => s.leads);
  const teamTasks = useTeamStore((s) => s.teamTasks);
  const problems = useTeamStore((s) => s.problems);

  const [activeVentureDetail, setActiveVentureDetail] = useState<TeamMissionItem | null>(null);
  const [openDetailInChat, setOpenDetailInChat] = useState(false);

  useEffect(() => {
    const openMissionChat = (missionId: string) => {
      const mission = useTeamStore.getState().teamMissions.find((item) => item.id === missionId);
      if (!mission) return;
      setOpenDetailInChat(true);
      setActiveVentureDetail(mission);
    };

    const pendingMissionId = sessionStorage.getItem('missioncontrol:open-chat-mission');
    if (pendingMissionId) {
      sessionStorage.removeItem('missioncontrol:open-chat-mission');
      openMissionChat(pendingMissionId);
    }

    const handleOpenChat = (event: Event) => {
      sessionStorage.removeItem('missioncontrol:open-chat-mission');
      openMissionChat((event as CustomEvent<string>).detail);
    };
    window.addEventListener('missioncontrol:open-project-chat', handleOpenChat);
    return () => window.removeEventListener('missioncontrol:open-project-chat', handleOpenChat);
  }, []);
  const [isCreatingVenture, setIsCreatingVenture] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // New Venture Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [newColor] = useState('emerald');

  const handleCreateVenture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created = addTeamMission({
      title: newTitle.trim(),
      description: newDescription.trim(),
      iconName: 'Target',
      color: newColor,
      objective: newObjective.trim(),
      why_it_matters: '',
      definition_of_success: '',
      customer_segment: '',
      revenue_model: '',
      status: 'active',
      is_pinned: false,
      target_date: newTargetDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tags: ['Venture', 'Team-Priority'],
    });

    setNewTitle('');
    setNewDescription('');
    setNewObjective('');
    setNewTargetDate('');
    setIsCreatingVenture(false);
    setActiveVentureDetail(created);
  };

  const getVentureIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('turf')) return <Activity className="h-5 w-5 text-emerald-400" />;
    if (t.includes('gym')) return <Dumbbell className="h-5 w-5 text-blue-400" />;
    if (t.includes('deal') || t.includes('flash')) return <Tag className="h-5 w-5 text-amber-400" />;
    if (t.includes('popup') || t.includes('radar')) return <Compass className="h-5 w-5 text-purple-400" />;
    return <Layers className="h-5 w-5 text-cyan-400" />;
  };

  const statusCounts = useMemo(() => ({
    all: teamMissions.length,
    active: teamMissions.filter((mission) => mission.status === 'active').length,
    on_hold: teamMissions.filter((mission) => mission.status === 'on_hold').length,
    completed: teamMissions.filter((mission) => mission.status === 'completed').length,
  }), [teamMissions]);

  // Pinned projects lead, so the room's current focus is the first thing read.
  const visibleMissions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return teamMissions
      .filter((mission) => statusFilter === 'all' || mission.status === statusFilter)
      .filter((mission) => !needle || [mission.title, mission.description, mission.objective, ...mission.tags]
        .some((field) => field?.toLowerCase().includes(needle)))
      .slice()
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned));
  }, [query, statusFilter, teamMissions]);

  // A zero reads as "nothing to look at", so only live counts carry their tone.
  const stats: Array<{ label: string; value: number; icon: LucideIcon; tone: string }> = [
    { label: 'Active projects', value: statusCounts.active, icon: FolderKanban, tone: 'border-accent/25 bg-accent/10 text-accent' },
    { label: 'Open tasks', value: teamTasks.filter((task) => task.status !== 'done').length, icon: CheckSquare, tone: 'border-warning/25 bg-warning/10 text-warning' },
    { label: 'Active clients', value: leads.filter((lead) => lead.status === 'active_pilot').length, icon: Handshake, tone: 'border-success/25 bg-success/10 text-success' },
    { label: 'Open issues', value: problems.filter((problem) => problem.status !== 'solved').length, icon: AlertOctagon, tone: 'border-danger/25 bg-danger/10 text-danger' },
  ];

  // If viewing a single venture's deep Unified Hub
  if (activeVentureDetail) {
    const currentMission = teamMissions.find((mission) => mission.id === activeVentureDetail.id) ?? activeVentureDetail;
    return (
      <UnifiedMissionHub
        mission={currentMission}
        initialTab={openDetailInChat ? 'chat' : 'overview'}
        onBack={() => { setActiveVentureDetail(null); setOpenDetailInChat(false); }}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* One wrapping row: identity, room totals, actions. The totals sit inline
          once there is room for them and drop to their own line below that. */}
      <section className="rounded-2xl border border-borderSoft/40 bg-panel/65 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="order-1 flex min-w-0 flex-1 items-center gap-3 xl:flex-none">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-base font-semibold tracking-tight text-text-primary sm:text-lg">Projects</h1>
                <span className="shrink-0 rounded-full bg-panel2 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-secondary">
                  {teamMissions.length}
                </span>
              </div>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-text-secondary sm:text-sm">
                <span className="truncate">{activeRoom?.name || 'Team room'}</span>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  isRoomAdmin ? 'border-accent/30 bg-accent/10 text-accent' : 'border-borderSoft/45 bg-panel2 text-text-muted'
                }`}>
                  {isRoomAdmin ? <Crown className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                  {activeRoom?.role || 'member'}
                </span>
              </p>
            </div>
          </div>

          <div className="order-2 flex shrink-0 items-center gap-2 xl:order-3">
            {teamMissions.length > 1 && (
              <div className="relative hidden sm:block sm:w-48 lg:w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search projects"
                  aria-label="Search projects"
                  className="h-10 w-full rounded-xl border border-borderSoft/50 bg-panel2 pl-9 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent/70 focus:ring-2 focus:ring-accent/15"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsCreatingVenture(true)}
              className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-accent px-3 text-sm font-bold text-[rgb(var(--accent-contrast))] shadow-glow transition-colors hover:bg-accentSoft sm:px-4"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New project</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>

          {/* Room totals: two-up on phones, a four-up strip from sm, and inline
              beside the title once the row is wide enough to hold them. */}
          <div className="order-3 grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:order-2 xl:flex xl:w-auto xl:flex-1 xl:justify-end">
            {stats.map(({ label, value, icon: Icon, tone }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-xl border border-borderSoft/30 bg-panel2/45 px-3 py-2 xl:min-w-[9.5rem]"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                  value > 0 ? tone : 'border-borderSoft/45 bg-panel2 text-text-muted'
                }`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className={`text-base font-semibold leading-tight tabular-nums ${value > 0 ? 'text-text-primary' : 'text-text-muted'}`}>{value}</div>
                  <div className="truncate text-[11px] font-medium leading-tight text-text-secondary">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {teamMissions.length > 1 && (
          <div className="relative mt-3 sm:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="h-10 w-full rounded-xl border border-borderSoft/50 bg-panel2 pl-9 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent/70 focus:ring-2 focus:ring-accent/15"
            />
          </div>
        )}
      </section>

      {teamMissions.length > 0 && (
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-none sm:flex-wrap sm:overflow-visible">
          {(['all', 'active', 'on_hold', 'completed'] as StatusFilter[]).map((key) => {
            const count = statusCounts[key];
            if (key !== 'all' && count === 0) return null;
            const isActive = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                aria-pressed={isActive}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? 'border-accent/40 bg-accent/12 font-semibold text-accent'
                    : 'border-borderSoft/40 font-medium text-text-secondary hover:bg-panel2 hover:text-text-primary'
                }`}
              >
                {key === 'all' ? 'All' : STATUS_COPY[key]}
                <span className={`tabular-nums ${isActive ? 'text-accent/70' : 'text-text-muted'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Ventures Cards Grid */}
      {visibleMissions.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleMissions.map((mission) => {
            const missionTasks = teamTasks.filter((t) => t.missionId === mission.id);
            const missionLeads = leads.filter((l) => l.missionId === mission.id);
            const missionProblems = problems.filter((p) => p.missionId === mission.id);
            const completedTasks = missionTasks.filter((t) => t.status === 'done').length;
            const taskProgress = missionTasks.length > 0 ? Math.round((completedTasks / missionTasks.length) * 100) : 0;
            const dueDate = formatDueDate(mission.target_date);

            return (
              <button
                key={mission.id}
                type="button"
                onClick={() => setActiveVentureDetail(mission)}
                className="group flex flex-col rounded-2xl border border-borderSoft/40 bg-panel/65 p-4 text-left transition-colors hover:border-accent/45 hover:bg-panel focus-visible:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-borderSoft/40 bg-panel2">
                      {getVentureIcon(mission.title)}
                    </span>
                    <div className="min-w-0">
                      <h4 className="flex items-center gap-1.5 truncate text-sm font-semibold text-text-primary">
                        {mission.is_pinned && <Pin className="h-3 w-3 shrink-0 text-accent" aria-label="Pinned" />}
                        <span className="truncate">{mission.title}</span>
                      </h4>
                      <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{mission.description}</p>
                    </div>
                  </div>

                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors group-hover:bg-accent/12 group-hover:text-accent">
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>

                {mission.objective && (
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                    <span className="text-text-muted">Objective · </span>
                    {mission.objective}
                  </p>
                )}

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium">
                    <span className="text-text-muted">
                      {missionTasks.length > 0 ? `${completedTasks} of ${missionTasks.length} tasks done` : 'No tasks yet'}
                    </span>
                    <span className="tabular-nums text-text-secondary">{taskProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel2">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${taskProgress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-borderSoft/30 pt-3 text-[11px] text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-text-muted" />
                    {missionLeads.length} leads
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertOctagon className="h-3.5 w-3.5 text-text-muted" />
                    {missionProblems.length} issues
                  </span>
                  {dueDate && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5 text-text-muted" />
                      {dueDate}
                    </span>
                  )}
                  <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_PILL[mission.status]}`}>
                    {STATUS_COPY[mission.status]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-borderSoft/50 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-borderSoft/40 bg-panel2 text-text-muted">
            {teamMissions.length === 0 ? <FolderPlus className="h-6 w-6" /> : <Search className="h-6 w-6" />}
          </span>
          <p className="mt-3 text-sm font-semibold text-text-primary">
            {teamMissions.length === 0 ? 'No projects in this room yet' : 'No projects match'}
          </p>
          <p className="mt-1 max-w-sm text-xs text-text-secondary">
            {teamMissions.length === 0
              ? 'Create the first project so tasks, clients, issues, and chat all have a home.'
              : 'Try a different search term or clear the status filter.'}
          </p>
          {teamMissions.length === 0 ? (
            <button
              type="button"
              onClick={() => setIsCreatingVenture(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-[rgb(var(--accent-contrast))] hover:bg-accentSoft"
            >
              <Plus className="h-4 w-4" />
              New project
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setQuery(''); setStatusFilter('all'); }}
              className="mt-4 rounded-xl border border-borderSoft/40 px-3.5 py-2 text-xs font-bold text-text-secondary hover:bg-panel2 hover:text-text-primary"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* New Venture Form */}
      {isCreatingVenture && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[3px] sm:items-center"
          onMouseDown={() => setIsCreatingVenture(false)}
        >
          <form
            onSubmit={handleCreateVenture}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => { if (event.key === 'Escape') setIsCreatingVenture(false); }}
            aria-labelledby="new-project-title"
            className="my-auto w-full max-w-2xl space-y-5 rounded-3xl border border-borderSoft/45 bg-panel p-5 shadow-2xl animate-in fade-in sm:p-7"
          >
            <div className="border-b border-borderSoft/35 pb-4">
              <h2 id="new-project-title" className="text-xl font-bold text-text-primary">Create a new project</h2>
              <p className="mt-1 text-sm text-text-secondary">Add the basics now. You can add tasks, clients, files, and notes afterward.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
              <div className="space-y-2">
                <label htmlFor="team-project-name" className="block text-sm font-semibold text-text-primary">Project name <span className="text-danger">*</span></label>
                <input
                  id="team-project-name"
                  type="text"
                  required
                  autoFocus
                  placeholder="Example: Website redesign"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-12 w-full rounded-xl border border-borderSoft/70 bg-panel2 px-4 text-base text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="team-project-date" className="block text-sm font-semibold text-text-primary">Due date <span className="font-normal text-text-muted">(optional)</span></label>
                <input
                  id="team-project-date"
                  type="date"
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="h-12 w-full rounded-xl border border-borderSoft/70 bg-panel2 px-4 text-base text-text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="team-project-summary" className="block text-sm font-semibold text-text-primary">Short description <span className="text-danger">*</span></label>
              <input
                id="team-project-summary"
                type="text"
                required
                placeholder="What are you delivering for the client?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="h-12 w-full rounded-xl border border-borderSoft/70 bg-panel2 px-4 text-base text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
              <p className="text-xs text-text-muted">Keep it to one clear sentence.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="team-project-goal" className="block text-sm font-semibold text-text-primary">Project goal <span className="font-normal text-text-muted">(optional)</span></label>
              <textarea
                id="team-project-goal"
                rows={3}
                placeholder="What should be true when this project is finished?"
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                className="w-full resize-y rounded-xl border border-borderSoft/70 bg-panel2 px-4 py-3 text-base leading-relaxed text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-borderSoft/35 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsCreatingVenture(false)}
                className="h-11 rounded-xl px-5 text-sm font-semibold text-text-secondary transition-colors hover:bg-panel2 hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim() || !newDescription.trim()}
                className="h-11 rounded-xl bg-accent px-6 text-sm font-bold text-[rgb(var(--accent-contrast))] shadow-glow transition-colors hover:bg-accentSoft disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
              >
                Create project
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </div>
  );
}
