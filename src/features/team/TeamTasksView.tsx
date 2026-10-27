import { useState, useMemo, useEffect, type DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckSquare, 
  Plus, 
  Calendar as CalendarIcon, 
  CalendarDays,
  Trash2, 
  UserCheck,
  GripVertical,
  KanbanSquare,
  List,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Clock,
  ArrowUpDown,
  Layers,
  AlertCircle,
  X,
  Eye,
  Check,
  Share2,
  ExternalLink,
  MessageSquare,
  Flag,
  Briefcase
} from 'lucide-react';
import { useTeamStore } from './team-store';
import { DiscussButton } from './DiscussButton';
import type { TeamRole, TeamTask } from './team-types';
import { confirmDialog } from '../../components/ui/native-dialog';
import { cn } from '../../lib/cn';

interface TeamTasksViewProps {
  filterMissionId?: string;
}

type TaskViewMode = 'board' | 'list' | 'calendar';
type SortOption = 'dueDate' | 'priority' | 'status' | 'title';

export function TeamTasksView({ filterMissionId }: TeamTasksViewProps) {
  const teamTasks = useTeamStore((s) => s.teamTasks);
  const teamMissions = useTeamStore((s) => s.teamMissions);
  const addTeamTask = useTeamStore((s) => s.addTeamTask);
  const updateTeamTask = useTeamStore((s) => s.updateTeamTask);
  const toggleTeamTaskDone = useTeamStore((s) => s.toggleTeamTaskDone);
  const deleteTeamTask = useTeamStore((s) => s.deleteTeamTask);
  const activePersona = useTeamStore((s) => s.activePersona);

  // View state
  const [viewMode, setViewMode] = useState<TaskViewMode>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMissionFilter, setSelectedMissionFilter] = useState<string>(
    filterMissionId || 'all'
  );
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('dueDate');
  const [groupByStatus, setGroupByStatus] = useState<boolean>(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Active task for detail modal
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  // Drag & drop state for board
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TeamTask['status'] | null>(null);

  // Calendar specific state
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Form creation state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOutcome, setNewOutcome] = useState('');
  const [newMissionId, setNewMissionId] = useState(filterMissionId || teamMissions[0]?.id || '');
  const [newRole, setNewRole] = useState<TeamRole>(activePersona.role);
  const [newPriority, setNewPriority] = useState<TeamTask['priority']>('high');
  const [newDueDate, setNewDueDate] = useState('');
  const hasProjects = teamMissions.length > 0;

  const priorityWeight: Record<TeamTask['priority'], number> = {
    critical: 4,
    high: 3,
    normal: 2,
    low: 1,
  };

  const statusWeight: Record<TeamTask['status'], number> = {
    in_progress: 4,
    backlog: 3,
    review: 2,
    done: 1,
  };

  // Find currently open task in detail view
  const activeDetailTask = useMemo(() => {
    return teamTasks.find((t) => t.id === detailTaskId) || null;
  }, [teamTasks, detailTaskId]);

  // Filtered & sorted tasks
  const filteredTasks = useMemo(() => {
    return teamTasks
      .filter((task) => {
        const matchesMission =
          filterMissionId ? task.missionId === filterMissionId : selectedMissionFilter === 'all' || task.missionId === selectedMissionFilter;
        const matchesRole = roleFilter === 'all' || task.assigneeRole === roleFilter;
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
        const matchesSearch =
          !searchQuery.trim() ||
          task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (task.outcome && task.outcome.toLowerCase().includes(searchQuery.toLowerCase())) ||
          task.assigneeRole.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesMission && matchesRole && matchesStatus && matchesPriority && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          return priorityWeight[b.priority] - priorityWeight[a.priority];
        }
        if (sortBy === 'status') {
          return statusWeight[b.status] - statusWeight[a.status];
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        // default: dueDate
        const aDate = a.dueDate || '9999-12-31';
        const bDate = b.dueDate || '9999-12-31';
        return aDate.localeCompare(bDate);
      });
  }, [
    teamTasks,
    filterMissionId,
    selectedMissionFilter,
    roleFilter,
    statusFilter,
    priorityFilter,
    searchQuery,
    sortBy,
  ]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMissionId) return;

    addTeamTask({
      missionId: newMissionId,
      title: newTitle.trim(),
      outcome: newOutcome.trim(),
      status: 'backlog',
      priority: newPriority,
      assigneeRole: newRole,
      dueDate: newDueDate || undefined,
    });

    setNewTitle('');
    setNewOutcome('');
    setNewDueDate('');
    setIsAdding(false);
  };

  const openAddForDate = (dateStr: string) => {
    setNewDueDate(dateStr);
    if (!newMissionId && teamMissions[0]?.id) {
      setNewMissionId(teamMissions[0].id);
    }
    setIsAdding(true);
  };

  const getMissionName = (mId: string) => {
    return teamMissions.find((m) => m.id === mId)?.title || 'Project';
  };

  const getPriorityBadge = (priority: TeamTask['priority']) => {
    switch (priority) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'high':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'normal':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getStatusBadge = (status: TeamTask['status']) => {
    switch (status) {
      case 'in_progress':
        return 'bg-accent/15 text-accent border-accent/30';
      case 'review':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'done':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const columns: Array<{ status: TeamTask['status']; label: string; tone: string }> = [
    { status: 'backlog', label: 'Backlog', tone: 'bg-slate-400' },
    { status: 'in_progress', label: 'In progress', tone: 'bg-accent' },
    { status: 'review', label: 'Review', tone: 'bg-warning' },
    { status: 'done', label: 'Done', tone: 'bg-success' },
  ];

  const handleDragStart = (event: DragEvent<HTMLDivElement>, taskId: string) => {
    setDraggedTaskId(taskId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', taskId);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, status: TeamTask['status']) => {
    event.preventDefault();
    const taskId = draggedTaskId || event.dataTransfer.getData('text/plain');
    if (taskId) {
      updateTeamTask(taskId, {
        status,
        completedAt: status === 'done' ? new Date().toISOString() : undefined,
      });
    }
    setDraggedTaskId(null);
    setDragOverStatus(null);
  };

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Calendar calculations
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString('default', { month: 'long' });
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  const jumpToday = () => {
    const now = new Date();
    setCalendarDate(now);
    setSelectedDateStr(now.toISOString().split('T')[0]);
  };

  const calendarDays = useMemo(() => {
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];
    const prevMonthDays = new Date(year, month, 0).getDate();

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: true });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const m = month === 11 ? 1 : month + 2;
      const y = month === 11 ? year + 1 : year;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dateStr, dayNum: i, isCurrentMonth: false });
    }

    return days;
  }, [year, month, firstDayIndex, daysInMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TeamTask[]>();
    filteredTasks.forEach((t) => {
      if (t.dueDate) {
        const existing = map.get(t.dueDate) || [];
        existing.push(t);
        map.set(t.dueDate, existing);
      }
    });
    return map;
  }, [filteredTasks]);

  const tasksForSelectedDate = useMemo(() => {
    return filteredTasks.filter((t) => t.dueDate === selectedDateStr);
  }, [filteredTasks, selectedDateStr]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {/* Top Header & Actions Bar */}
      <div className="space-y-3 rounded-2xl border border-borderSoft/30 bg-panel/45 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary">
                Tasks
                <span className="rounded-full bg-panel2/60 px-2 py-0.5 font-mono text-xs text-text-muted">
                  {filteredTasks.length} {filteredTasks.length === 1 ? 'Task' : 'Tasks'}
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-text-muted">
                Assign, track, and complete work with your team.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center rounded-xl border border-borderSoft/35 bg-panel2/55 p-1">
              <button
                type="button"
                onClick={() => setViewMode('board')}
                title="Board View (Kanban)"
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer',
                  viewMode === 'board'
                    ? 'bg-accent/15 text-accent shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <KanbanSquare className="w-3.5 h-3.5" />
                <span>Board</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="List View"
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer',
                  viewMode === 'list'
                    ? 'bg-accent/15 text-accent shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                title="Calendar View"
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer',
                  viewMode === 'calendar'
                    ? 'bg-accent/15 text-accent shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Calendar</span>
              </button>
            </div>

            <button
              type="button"
              disabled={!hasProjects}
              onClick={() => setIsAdding(!isAdding)}
              title={hasProjects ? 'Create task' : 'Create a project first'}
              className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-sm font-bold text-[rgb(var(--accent-contrast))] shadow-glow transition-all hover:bg-accentSoft cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New task</span>
            </button>
          </div>
        </div>

        {/* Filters & Search Row */}
        <div className="flex flex-wrap items-center gap-2 border-t border-borderSoft/25 pt-2.5">
          {/* Search Box */}
          <div className="flex items-center gap-2 rounded-xl border border-borderSoft/35 bg-panel2/55 px-2.5 py-1.5 min-w-[140px] flex-1 sm:flex-initial focus-within:border-accent">
            <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none w-full min-w-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[10px] text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            )}
          </div>

          {!filterMissionId && (
            <select
              value={selectedMissionFilter}
              onChange={(e) => setSelectedMissionFilter(e.target.value)}
              className="rounded-xl border border-borderSoft/35 bg-panel2/55 px-2.5 py-1.5 text-xs font-medium text-text-primary focus:border-accent focus:outline-none cursor-pointer"
            >
              <option value="all">All projects</option>
              {teamMissions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          )}

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-borderSoft/35 bg-panel2/55 px-2.5 py-1.5 text-xs font-medium text-text-primary focus:border-accent focus:outline-none cursor-pointer"
          >
            <option value="all">All Partner Roles</option>
            <option value="Tech Lead">Tech Lead</option>
            <option value="BizDev Partner">BizDev Partner</option>
            <option value="Operations Partner">Operations Partner</option>
            <option value="General Member">General Member</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-xl border border-borderSoft/35 bg-panel2/55 px-2.5 py-1.5 text-xs font-medium text-text-primary focus:border-accent focus:outline-none cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          {viewMode !== 'board' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-borderSoft/35 bg-panel2/55 px-2.5 py-1.5 text-xs font-medium text-text-primary focus:border-accent focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="backlog">Backlog</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          )}

          {viewMode === 'list' && (
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => setGroupByStatus(!groupByStatus)}
                className={cn(
                  'flex items-center gap-1 rounded-xl border border-borderSoft/35 px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  groupByStatus ? 'bg-panel2 text-accent' : 'bg-panel2/55 text-text-secondary hover:text-text-primary'
                )}
                title="Toggle grouping by status"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Group Status</span>
              </button>

              <div className="flex items-center gap-1 rounded-xl border border-borderSoft/35 bg-panel2/55 px-2 py-1 text-xs">
                <ArrowUpDown className="w-3 h-3 text-text-muted" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-xs text-text-primary focus:outline-none cursor-pointer"
                >
                  <option value="dueDate">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                  <option value="title">Title</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Creation Form */}
      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-2xl border border-accent/35 bg-panel/60 p-4 animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <div className="font-mono text-sm font-bold uppercase tracking-wider text-amber-400">
              Create Team Sprint Task
            </div>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Task Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Deploy 2x acrylic QR stands to Indiranagar Arena"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-accent focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Concrete Outcome (Done Definition)</label>
              <input
                type="text"
                placeholder="e.g. Owner verified live QR scanner on desk"
                value={newOutcome}
                onChange={(e) => setNewOutcome(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Project</label>
              <select
                value={newMissionId}
                onChange={(e) => setNewMissionId(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none"
              >
                <option value="" disabled>Select a project</option>
                {teamMissions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Assignee Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as TeamRole)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none"
              >
                <option value="Tech Lead">Tech Lead</option>
                <option value="BizDev Partner">BizDev Partner</option>
                <option value="Operations Partner">Operations Partner</option>
                <option value="General Member">General Member</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TeamTask['priority'])}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Due Date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-accent hover:bg-accentSoft text-[rgb(var(--accent-contrast))] font-bold text-xs rounded-xl shadow-glow transition-all cursor-pointer"
            >
              Save Team Task
            </button>
          </div>
        </form>
      )}

      {/* Empty State */}
      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-borderSoft/30 bg-panel/30 p-12 text-center">
          <CheckSquare className="w-10 h-10 text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-text-primary">No Team Tasks Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Try adjusting your filters or search query.'
              : 'Create a task and assign it to the right team member.'}
          </p>
          {hasProjects && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="mt-4 flex items-center gap-1.5 rounded-xl bg-accent/20 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
          )}
        </div>
      ) : viewMode === 'board' ? (
        /* 1. KANBAN BOARD VIEW */
        <div>
          <p className="mb-2 px-1 text-xs text-text-muted xl:hidden">
            Swipe between columns · click any card to view details
          </p>
          <div className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto pb-3 scrollbar-none xl:grid xl:grid-cols-4 xl:overflow-visible xl:pb-0">
            {columns.map((column) => {
              const columnTasks = filteredTasks.filter((task) => task.status === column.status);
              const isDropTarget = dragOverStatus === column.status;
              return (
                <div
                  key={column.status}
                  onDragEnter={() => setDragOverStatus(column.status)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverStatus(null);
                  }}
                  onDrop={(event) => handleDrop(event, column.status)}
                  className={`min-h-[calc(100dvh-18rem)] w-[calc(100vw-3rem)] max-w-[380px] shrink-0 snap-start rounded-2xl border p-2.5 transition-colors sm:w-[380px] xl:min-h-[360px] xl:w-auto xl:max-w-none ${
                    isDropTarget
                      ? 'border-accent/55 bg-accent/8'
                      : 'border-borderSoft/30 bg-panel/25'
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${column.tone}`} />
                      <h4 className="text-sm font-semibold text-text-primary">{column.label}</h4>
                    </div>
                    <span className="rounded-full bg-panel2/60 px-2 py-0.5 text-xs text-text-muted">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {columnTasks.map((task) => {
                      const isDone = task.status === 'done';
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(event) => handleDragStart(event, task.id)}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDragOverStatus(null);
                          }}
                          onClick={() => setDetailTaskId(task.id)}
                          className={`group rounded-xl border border-borderSoft/35 bg-panel p-4 shadow-sm transition-all hover:border-accent/50 hover:shadow-md cursor-pointer ${
                            draggedTaskId === task.id ? 'opacity-40' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="mt-0.5 hidden h-4 w-4 shrink-0 cursor-grab text-text-muted/55 active:cursor-grabbing xl:block" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm font-semibold leading-snug group-hover:text-accent transition-colors ${isDone ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                                  {task.title}
                                </p>
                                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => setDetailTaskId(task.id)}
                                    className="p-1 rounded-md text-text-muted opacity-100 xl:opacity-0 xl:group-hover:opacity-100 hover:text-accent hover:bg-accent/10 transition"
                                    title="View task details"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <DiscussButton
                                    className="p-1 opacity-100 xl:opacity-0 xl:group-hover:opacity-100"
                                    item={{ kind: 'task', id: task.id, label: task.title, detail: task.status }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void confirmDialog(`Delete task “${task.title}”?`, { title: 'Delete task', confirmLabel: 'Delete', danger: true }).then((ok) => {
                                        if (ok) deleteTeamTask(task.id);
                                      });
                                    }}
                                    className="shrink-0 rounded-md p-1 text-text-muted opacity-100 transition hover:bg-rose-500/10 hover:text-rose-500 xl:opacity-0 xl:group-hover:opacity-100"
                                    title="Delete task"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${getPriorityBadge(task.priority)}`}>
                                  {task.priority}
                                </span>
                                {!filterMissionId && (
                                  <span className="max-w-full truncate rounded-full bg-panel2/60 px-2 py-0.5 text-[11px] text-text-secondary">
                                    {getMissionName(task.missionId)}
                                  </span>
                                )}
                              </div>

                              {task.outcome && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">{task.outcome}</p>}

                              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borderSoft/20 pt-2.5 text-[11px] text-text-muted">
                                <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" />{task.assigneeRole}</span>
                                {task.dueDate && (
                                  <span className={cn(
                                    'flex items-center gap-1',
                                    task.dueDate < todayStr && !isDone ? 'text-rose-400 font-semibold' : ''
                                  )}>
                                    <CalendarIcon className="h-3 w-3" />{task.dueDate}
                                  </span>
                                )}
                                <div className="mt-1 grid w-full grid-cols-2 gap-2 xl:hidden" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    disabled={column.status === columns[0].status}
                                    onClick={() => {
                                      const index = columns.findIndex((item) => item.status === column.status);
                                      const status = columns[index - 1]?.status;
                                      if (status) updateTeamTask(task.id, { status, completedAt: undefined });
                                    }}
                                    className="rounded-lg border border-borderSoft/35 bg-panel2/45 px-2 py-2 text-xs font-medium text-text-secondary disabled:cursor-not-allowed disabled:opacity-35"
                                  >
                                    ← Previous
                                  </button>
                                  <button
                                    type="button"
                                    disabled={column.status === columns[columns.length - 1].status}
                                    onClick={() => {
                                      const index = columns.findIndex((item) => item.status === column.status);
                                      const status = columns[index + 1]?.status;
                                      if (status) updateTeamTask(task.id, {
                                        status,
                                        completedAt: status === 'done' ? new Date().toISOString() : undefined,
                                      });
                                    }}
                                    className="rounded-lg border border-borderSoft/35 bg-panel2/45 px-2 py-2 text-xs font-medium text-text-secondary disabled:cursor-not-allowed disabled:opacity-35"
                                  >
                                    Next →
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleTeamTaskDone(task.id);
                                  }}
                                  className="ml-auto text-emerald-500 hover:text-emerald-400 font-medium cursor-pointer"
                                >
                                  {isDone ? 'Reopen' : 'Done'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {columnTasks.length === 0 && (
                      <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-borderSoft/30 text-xs text-text-muted">
                        Drop tasks here
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* 2. STRUCTURED LIST VIEW */
        <div className="space-y-4">
          {groupByStatus ? (
            columns.map((col) => {
              const groupTasks = filteredTasks.filter((t) => t.status === col.status);
              const isCollapsed = collapsedGroups[col.status];

              return (
                <div
                  key={col.status}
                  className="rounded-2xl border border-borderSoft/35 bg-panel/35 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(col.status)}
                    className="flex w-full items-center justify-between bg-panel2/40 px-4 py-3 text-left transition-colors hover:bg-panel2/60 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${col.tone}`} />
                      <span className="text-sm font-bold text-text-primary">{col.label}</span>
                      <span className="rounded-full bg-panel/80 px-2 py-0.5 font-mono text-xs text-text-muted">
                        {groupTasks.length}
                      </span>
                    </div>
                    {isCollapsed ? (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-text-muted" />
                    )}
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y divide-borderSoft/20">
                      {groupTasks.length === 0 ? (
                        <div className="p-4 text-center text-xs text-text-muted">
                          No tasks in {col.label.toLowerCase()}
                        </div>
                      ) : (
                        groupTasks.map((task) => (
                          <TaskListItem
                            key={task.id}
                            task={task}
                            filterMissionId={filterMissionId}
                            getMissionName={getMissionName}
                            getPriorityBadge={getPriorityBadge}
                            getStatusBadge={getStatusBadge}
                            todayStr={todayStr}
                            toggleTeamTaskDone={toggleTeamTaskDone}
                            updateTeamTask={updateTeamTask}
                            deleteTeamTask={deleteTeamTask}
                            onOpenDetail={() => setDetailTaskId(task.id)}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-borderSoft/35 bg-panel/35 overflow-hidden divide-y divide-borderSoft/20">
              {filteredTasks.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  filterMissionId={filterMissionId}
                  getMissionName={getMissionName}
                  getPriorityBadge={getPriorityBadge}
                  getStatusBadge={getStatusBadge}
                  todayStr={todayStr}
                  toggleTeamTaskDone={toggleTeamTaskDone}
                  updateTeamTask={updateTeamTask}
                  deleteTeamTask={deleteTeamTask}
                  onOpenDetail={() => setDetailTaskId(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 3. CALENDAR VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar Grid Matrix */}
          <div className="space-y-3 rounded-2xl border border-borderSoft/30 bg-panel/45 p-4 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-borderSoft/25 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="rounded-xl border border-borderSoft/35 bg-panel2/55 p-1.5 text-text-secondary transition-colors hover:border-borderSoft/60 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h4 className="min-w-[130px] text-center font-mono text-sm font-bold text-text-primary">
                  {monthName} {year}
                </h4>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="rounded-xl border border-borderSoft/35 bg-panel2/55 p-1.5 text-text-secondary transition-colors hover:border-borderSoft/60 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={jumpToday}
                className="rounded-xl bg-panel2/70 px-3 py-1 font-mono text-xs font-semibold text-text-secondary transition-colors hover:bg-panel2 cursor-pointer"
              >
                Today
              </button>
            </div>

            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 border-b border-borderSoft/25 pb-2 text-center font-mono text-[11px] font-bold text-text-muted">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* 42-day Month Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const dayTasks = tasksByDate.get(day.dateStr) || [];
                const isSelected = selectedDateStr === day.dateStr;
                const isToday = day.dateStr === todayStr;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedDateStr(day.dateStr)}
                    className={cn(
                      'flex min-h-[76px] sm:min-h-[88px] flex-col rounded-xl border p-1 text-left transition-all cursor-pointer',
                      day.isCurrentMonth
                        ? 'border-borderSoft/25 bg-panel/30 hover:border-accent/40'
                        : 'border-transparent bg-panel/10 opacity-35 hover:opacity-75',
                      isSelected && 'ring-2 ring-accent border-accent/60 bg-accent/5',
                      isToday && 'border-amber-500/50 bg-amber-500/5'
                    )}
                  >
                    <div className="flex items-center justify-between px-1">
                      <span
                        className={cn(
                          'font-mono text-xs',
                          isToday
                            ? 'font-bold text-amber-400'
                            : day.isCurrentMonth
                            ? 'text-text-primary'
                            : 'text-text-muted'
                        )}
                      >
                        {day.dayNum}
                      </span>
                      {dayTasks.length > 0 && (
                        <span className="rounded-full bg-accent/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-accent">
                          {dayTasks.length}
                        </span>
                      )}
                    </div>

                    {/* Task Pills */}
                    <div className="mt-1 space-y-0.5 overflow-hidden">
                      {dayTasks.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailTaskId(t.id);
                          }}
                          className={cn(
                            'truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight hover:opacity-80 transition',
                            t.status === 'done'
                              ? 'line-through bg-panel2/60 text-text-muted'
                              : t.priority === 'critical'
                              ? 'bg-rose-500/20 text-rose-300'
                              : t.priority === 'high'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-blue-500/20 text-blue-300'
                          )}
                          title={`${t.title} (Click to open details)`}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="text-[9px] font-mono text-text-muted px-1">
                          +{dayTasks.length - 2} more
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day Agenda Panel */}
          <div className="space-y-3 rounded-2xl border border-borderSoft/30 bg-panel/45 p-4 flex flex-col">
            <div className="flex items-center justify-between border-b border-borderSoft/25 pb-3">
              <div>
                <h4 className="text-sm font-bold text-text-primary">
                  {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </h4>
                <p className="text-xs text-text-muted">
                  {tasksForSelectedDate.length} {tasksForSelectedDate.length === 1 ? 'task scheduled' : 'tasks scheduled'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openAddForDate(selectedDateStr)}
                className="flex items-center gap-1 rounded-xl bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/25 transition-colors cursor-pointer"
                title="Add task on this date"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto max-h-[460px] pr-1">
              {tasksForSelectedDate.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
                  <CalendarDays className="w-8 h-8 opacity-40 mb-2" />
                  <p className="text-xs">No tasks due on this date</p>
                  <button
                    type="button"
                    onClick={() => openAddForDate(selectedDateStr)}
                    className="mt-3 text-xs text-accent hover:underline cursor-pointer"
                  >
                    + Schedule a task
                  </button>
                </div>
              ) : (
                tasksForSelectedDate.map((task) => {
                  const isDone = task.status === 'done';
                  return (
                    <div
                      key={task.id}
                      onClick={() => setDetailTaskId(task.id)}
                      className="group rounded-xl border border-borderSoft/35 bg-panel p-3 shadow-sm hover:border-accent/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTeamTaskDone(task.id);
                            }}
                            className="mt-0.5 shrink-0 text-text-muted hover:text-accent cursor-pointer"
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Circle className="w-4 h-4" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                'text-xs font-semibold leading-snug group-hover:text-accent transition-colors',
                                isDone ? 'line-through text-text-muted' : 'text-text-primary'
                              )}
                            >
                              {task.title}
                            </p>
                            {task.outcome && (
                              <p className="mt-1 text-[11px] text-text-muted line-clamp-2">
                                {task.outcome}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setDetailTaskId(task.id)}
                            className="p-1 text-text-muted hover:text-accent transition-colors"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <DiscussButton
                            className="p-1 opacity-100"
                            item={{ kind: 'task', id: task.id, label: task.title, detail: task.status }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void confirmDialog(`Delete task “${task.title}”?`, { title: 'Delete task', confirmLabel: 'Delete', danger: true }).then((ok) => {
                                if (ok) deleteTeamTask(task.id);
                              });
                            }}
                            className="p-1 text-text-muted hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5 border-t border-borderSoft/20 pt-2 text-[10px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`rounded-full border px-1.5 py-0.2 font-mono uppercase font-bold ${getPriorityBadge(task.priority)}`}>
                            {task.priority}
                          </span>
                          <span className={`rounded-full border px-1.5 py-0.2 capitalize font-medium ${getStatusBadge(task.status)}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-text-muted">
                          <UserCheck className="w-3 h-3" />
                          {task.assigneeRole}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {activeDetailTask && (
        <TaskDetailModal
          task={activeDetailTask}
          missions={teamMissions}
          onClose={() => setDetailTaskId(null)}
          onUpdate={(updates) => updateTeamTask(activeDetailTask.id, updates)}
          onDelete={() => {
            void confirmDialog(`Delete task “${activeDetailTask.title}”?`, {
              title: 'Delete Task',
              confirmLabel: 'Delete',
              danger: true,
            }).then((ok) => {
              if (ok) {
                deleteTeamTask(activeDetailTask.id);
                setDetailTaskId(null);
              }
            });
          }}
          onToggleDone={() => toggleTeamTaskDone(activeDetailTask.id)}
          getPriorityBadge={getPriorityBadge}
          getStatusBadge={getStatusBadge}
          getMissionName={getMissionName}
          todayStr={todayStr}
        />
      )}
    </div>
  );
}

/** Individual list item component */
function TaskListItem({
  task,
  filterMissionId,
  getMissionName,
  getPriorityBadge,
  getStatusBadge,
  todayStr,
  toggleTeamTaskDone,
  updateTeamTask,
  deleteTeamTask,
  onOpenDetail,
}: {
  task: TeamTask;
  filterMissionId?: string;
  getMissionName: (id: string) => string;
  getPriorityBadge: (p: TeamTask['priority']) => string;
  getStatusBadge: (s: TeamTask['status']) => string;
  todayStr: string;
  toggleTeamTaskDone: (id: string) => void;
  updateTeamTask: (id: string, updates: Partial<TeamTask>) => void;
  deleteTeamTask: (id: string) => void;
  onOpenDetail: () => void;
}) {
  const isDone = task.status === 'done';
  const isOverdue = task.dueDate && task.dueDate < todayStr && !isDone;

  return (
    <div
      onClick={onOpenDetail}
      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 transition-colors hover:bg-panel2/40 cursor-pointer"
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* Done / Checkbox toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleTeamTaskDone(task.id);
          }}
          className="mt-0.5 shrink-0 text-text-muted transition-transform active:scale-90 hover:text-accent cursor-pointer"
          title={isDone ? 'Mark as incomplete' : 'Mark as done'}
        >
          {isDone ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-sm font-semibold leading-snug group-hover:text-accent transition-colors',
                isDone ? 'line-through text-text-muted' : 'text-text-primary'
              )}
            >
              {task.title}
            </span>
            {!filterMissionId && (
              <span className="truncate rounded-full bg-panel2/80 px-2 py-0.5 font-mono text-[10px] text-text-secondary">
                {getMissionName(task.missionId)}
              </span>
            )}
          </div>

          {task.outcome && (
            <p className="mt-1 text-xs text-text-muted line-clamp-2 leading-relaxed">
              {task.outcome}
            </p>
          )}
        </div>
      </div>

      {/* Meta Pills & Actions */}
      <div
        className="flex flex-wrap items-center gap-2 sm:shrink-0 pt-2 sm:pt-0 border-t border-borderSoft/15 sm:border-t-0 pl-7 sm:pl-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status Dropdown */}
        <select
          value={task.status}
          onChange={(e) => {
            const status = e.target.value as TeamTask['status'];
            updateTeamTask(task.id, {
              status,
              completedAt: status === 'done' ? new Date().toISOString() : undefined,
            });
          }}
          className={cn(
            'rounded-lg border px-2 py-0.5 text-xs font-medium focus:outline-none cursor-pointer',
            getStatusBadge(task.status)
          )}
        >
          <option value="backlog">Backlog</option>
          <option value="in_progress">In progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>

        {/* Priority Badge */}
        <select
          value={task.priority}
          onChange={(e) => updateTeamTask(task.id, { priority: e.target.value as TeamTask['priority'] })}
          className={cn(
            'rounded-lg border px-2 py-0.5 font-mono text-[11px] font-bold uppercase focus:outline-none cursor-pointer',
            getPriorityBadge(task.priority)
          )}
        >
          <option value="critical">CRITICAL</option>
          <option value="high">HIGH</option>
          <option value="normal">NORMAL</option>
          <option value="low">LOW</option>
        </select>

        {/* Assignee */}
        <span className="flex items-center gap-1 rounded-full bg-panel2/60 px-2 py-0.5 text-xs text-text-secondary">
          <UserCheck className="w-3 h-3 text-text-muted" />
          <span>{task.assigneeRole}</span>
        </span>

        {/* Due Date */}
        {task.dueDate ? (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px]',
              isOverdue
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold'
                : 'bg-panel2/60 text-text-muted'
            )}
            title={isOverdue ? 'Task is overdue!' : 'Due date'}
          >
            {isOverdue && <AlertCircle className="w-3 h-3 text-rose-400" />}
            <CalendarIcon className="w-3 h-3" />
            <span>{task.dueDate}</span>
          </span>
        ) : (
          <input
            type="date"
            onChange={(e) => {
              if (e.target.value) updateTeamTask(task.id, { dueDate: e.target.value });
            }}
            className="w-6 h-6 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            title="Set due date"
          />
        )}

        {/* Discuss, View Detail and Delete */}
        <div className="flex items-center gap-1 ml-auto sm:ml-0">
          <button
            type="button"
            onClick={onOpenDetail}
            className="p-1 rounded-md text-text-muted opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-accent hover:bg-accent/10 transition"
            title="View full task details"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <DiscussButton
            className="p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            item={{ kind: 'task', id: task.id, label: task.title, detail: task.status }}
          />
          <button
            type="button"
            onClick={() => {
              void confirmDialog(`Delete task “${task.title}”?`, {
                title: 'Delete task',
                confirmLabel: 'Delete',
                danger: true,
              }).then((ok) => {
                if (ok) deleteTeamTask(task.id);
              });
            }}
            className="rounded-md p-1 text-text-muted opacity-100 transition hover:bg-rose-500/10 hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
            title="Delete task"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Comprehensive Task Detail Modal */
function TaskDetailModal({
  task,
  missions,
  onClose,
  onUpdate,
  onDelete,
  onToggleDone,
  getPriorityBadge,
  getStatusBadge,
  getMissionName,
  todayStr,
}: {
  task: TeamTask;
  missions: Array<{ id: string; title: string }>;
  onClose: () => void;
  onUpdate: (updates: Partial<TeamTask>) => void;
  onDelete: () => void;
  onToggleDone: () => void;
  getPriorityBadge: (p: TeamTask['priority']) => string;
  getStatusBadge: (s: TeamTask['status']) => string;
  getMissionName: (id: string) => string;
  todayStr: string;
}) {
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [outcomeDraft, setOutcomeDraft] = useState(task.outcome || '');
  const [isCopied, setIsCopied] = useState(false);
  const isDone = task.status === 'done';
  const isOverdue = task.dueDate && task.dueDate < todayStr && !isDone;

  useEffect(() => {
    setTitleDraft(task.title);
    setOutcomeDraft(task.outcome || '');
  }, [task]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleTitleBlur = () => {
    if (titleDraft.trim() && titleDraft !== task.title) {
      onUpdate({ title: titleDraft.trim() });
    }
  };

  const handleOutcomeBlur = () => {
    if (outcomeDraft !== (task.outcome || '')) {
      onUpdate({ outcome: outcomeDraft.trim() });
    }
  };

  const handleCopy = () => {
    const text = `Task: ${task.title}\nStatus: ${task.status}\nPriority: ${task.priority}\nAssignee: ${task.assigneeRole}\nOutcome: ${task.outcome || 'None'}\nDue: ${task.dueDate || 'Not set'}`;
    void navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-[3px] animate-in fade-in duration-150"
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-borderSoft/60 bg-panel bg-dots-subtle shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-borderSoft/30 bg-panel/95 backdrop-blur-md px-5 py-3.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="rounded-full bg-accent/15 border border-accent/30 px-2.5 py-0.5 text-xs font-semibold text-accent flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              <span className="max-w-[140px] truncate">{getMissionName(task.missionId)}</span>
            </span>

            <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase', getPriorityBadge(task.priority))}>
              {task.priority}
            </span>

            <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize', getStatusBadge(task.status))}>
              {task.status.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <DiscussButton
              className="p-1.5 text-text-muted hover:text-accent hover:bg-panel2 rounded-lg transition"
              item={{ kind: 'task', id: task.id, label: task.title, detail: task.status }}
            />

            <button
              type="button"
              onClick={handleCopy}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-panel2 rounded-lg transition cursor-pointer"
              title="Copy task summary"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
              title="Delete task"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-borderSoft/40 mx-1" />

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-panel2 rounded-lg transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Main Title & Status Toggle */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onToggleDone}
              className="mt-1 shrink-0 p-1 text-text-muted hover:text-accent transition-transform active:scale-90 cursor-pointer"
              title={isDone ? 'Mark task open' : 'Mark task done'}
            >
              {isDone ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              ) : (
                <Circle className="w-6 h-6 hover:text-accent" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleTitleBlur}
                className={cn(
                  'w-full bg-transparent text-lg sm:text-xl font-bold tracking-tight text-text-primary outline-none focus:ring-2 focus:ring-accent/30 rounded-lg px-1.5 py-0.5',
                  isDone && 'line-through text-text-muted'
                )}
                placeholder="Task title"
              />
            </div>
          </div>

          {/* Concrete Outcome (Done Definition) */}
          <div className="rounded-xl border border-borderSoft/40 bg-panel2/40 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" />
                Concrete Outcome (Done Definition)
              </label>
              <span className="text-[10px] text-text-muted">What specifies when this task is truly complete</span>
            </div>

            <textarea
              rows={2}
              value={outcomeDraft}
              onChange={(e) => setOutcomeDraft(e.target.value)}
              onBlur={handleOutcomeBlur}
              placeholder="e.g. 2 acrylic QR stands placed on Indiranagar desk and verified with 1 real live scan."
              className="w-full bg-panel2/60 border border-borderSoft/30 rounded-lg p-2.5 text-xs sm:text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent resize-none leading-relaxed"
            />
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status Selector */}
            <div className="rounded-xl border border-borderSoft/30 bg-panel2/30 p-3 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Status
              </label>
              <select
                value={task.status}
                onChange={(e) => {
                  const status = e.target.value as TeamTask['status'];
                  onUpdate({
                    status,
                    completedAt: status === 'done' ? new Date().toISOString() : undefined,
                  });
                }}
                className="w-full rounded-lg border border-borderSoft/40 bg-panel px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="backlog">Backlog</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Priority Selector */}
            <div className="rounded-xl border border-borderSoft/30 bg-panel2/30 p-3 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Priority
              </label>
              <select
                value={task.priority}
                onChange={(e) => onUpdate({ priority: e.target.value as TeamTask['priority'] })}
                className="w-full rounded-lg border border-borderSoft/40 bg-panel px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Assignee Role */}
            <div className="rounded-xl border border-borderSoft/30 bg-panel2/30 p-3 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                Assignee Partner Role
              </label>
              <select
                value={task.assigneeRole}
                onChange={(e) => onUpdate({ assigneeRole: e.target.value as TeamRole })}
                className="w-full rounded-lg border border-borderSoft/40 bg-panel px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="Tech Lead">Tech Lead</option>
                <option value="BizDev Partner">BizDev Partner</option>
                <option value="Operations Partner">Operations Partner</option>
                <option value="General Member">General Member</option>
              </select>
            </div>

            {/* Project / Mission */}
            <div className="rounded-xl border border-borderSoft/30 bg-panel2/30 p-3 space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                <Briefcase className="w-3 h-3" />
                Project
              </label>
              <select
                value={task.missionId}
                onChange={(e) => onUpdate({ missionId: e.target.value })}
                className="w-full rounded-lg border border-borderSoft/40 bg-panel px-3 py-2 text-xs font-semibold text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="rounded-xl border border-borderSoft/30 bg-panel2/30 p-3 space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <CalendarIcon className="w-3 h-3" />
                  Due Date
                </label>
                {isOverdue && (
                  <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Overdue
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={task.dueDate || ''}
                  onChange={(e) => onUpdate({ dueDate: e.target.value || undefined })}
                  className="rounded-lg border border-borderSoft/40 bg-panel px-3 py-2 text-xs font-medium text-text-primary outline-none focus:border-accent cursor-pointer flex-1"
                />
                <button
                  type="button"
                  onClick={() => onUpdate({ dueDate: todayStr })}
                  className="rounded-lg border border-borderSoft/40 bg-panel px-2.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    onUpdate({ dueDate: tomorrow.toISOString().split('T')[0] });
                  }}
                  className="rounded-lg border border-borderSoft/40 bg-panel px-2.5 py-2 text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer"
                >
                  Tomorrow
                </button>
                {task.dueDate && (
                  <button
                    type="button"
                    onClick={() => onUpdate({ dueDate: undefined })}
                    className="rounded-lg border border-borderSoft/40 bg-panel px-2.5 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Timestamps & Info Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-borderSoft/25 pt-4 text-[11px] text-text-muted">
            <div className="flex items-center gap-3">
              {task.createdAt && (
                <span>
                  Created: {new Date(task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              {task.completedAt && (
                <span className="text-emerald-400 font-medium">
                  Completed: {new Date(task.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleDone}
                className={cn(
                  'rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer shadow-sm',
                  isDone
                    ? 'bg-panel2 text-text-secondary hover:text-text-primary'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                )}
              >
                {isDone ? 'Reopen Task' : '✓ Mark as Done'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-[rgb(var(--accent-contrast))] hover:bg-accentSoft transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
