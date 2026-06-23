import { useEffect, useRef, useState, useMemo } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { MissionIcon } from '../../components/ui/mission-icon';
import { cn } from '../../lib/cn';
import { useMissionStore } from './mission-store';
import { useTaskStore } from '../tasks/task-store';
import type { Mission, MissionColor } from './mission-types';
import type { Task, TaskLane, TaskPriority } from '../tasks/task-types';
import { 
  Trash2, Plus, Pencil, Pause, Play, CheckCircle, RotateCcw, X, 
  CheckSquare, Square, ChevronRight, Clock, Target, Calendar, Pin, FileText
} from 'lucide-react';
import { useNoteStore } from '../notes/note-store';
import { getCategoryById, NoteCategoryIcon, getNoteColorStyle, getNoteDisplayTitle } from '../notes/note-helpers';
import { NoteEditorModal } from '../notes/NotesView';
import { RichTextContent } from '../../components/ui/rich-text-editor';
import type { Note } from '../notes/note-types';
import { AssigneeSelect } from '../collaborators/AssigneeSelect';

interface MissionDetailPanelProps {
  mission: Mission;
  allTasks: Task[];
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  onEditMission: (mission: Mission) => void;
}

const LANE_OPTIONS: { id: TaskLane; label: string; colorClass: string }[] = [
  { id: 'now', label: 'Active', colorClass: 'bg-accent text-accent' },
  { id: 'next', label: 'Next', colorClass: 'bg-indigo-500 text-indigo-400' },
  { id: 'inbox', label: 'Queue', colorClass: 'bg-warning text-warning' },
  { id: 'later', label: 'Later', colorClass: 'bg-text-muted/40 text-text-muted' },
  { id: 'done', label: 'Completed', colorClass: 'bg-success text-success' },
];

const COLOR_THEMES: Record<MissionColor, { border: string; soft: string; text: string; fill: string }> = {
  red: {
    border: 'border-red-500/26',
    soft: 'bg-red-500/10',
    text: 'text-red-400',
    fill: 'bg-red-500',
  },
  orange: {
    border: 'border-orange-500/26',
    soft: 'bg-orange-500/10',
    text: 'text-orange-400',
    fill: 'bg-orange-500',
  },
  yellow: {
    border: 'border-yellow-500/26',
    soft: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    fill: 'bg-yellow-500',
  },
  green: {
    border: 'border-green-500/26',
    soft: 'bg-green-500/10',
    text: 'text-green-400',
    fill: 'bg-green-500',
  },
  teal: {
    border: 'border-teal-500/26',
    soft: 'bg-teal-500/10',
    text: 'text-teal-400',
    fill: 'bg-teal-500',
  },
  blue: {
    border: 'border-blue-500/26',
    soft: 'bg-blue-500/10',
    text: 'text-blue-400',
    fill: 'bg-blue-500',
  },
  purple: {
    border: 'border-purple-500/26',
    soft: 'bg-purple-500/10',
    text: 'text-purple-400',
    fill: 'bg-purple-500',
  },
  pink: {
    border: 'border-pink-500/26',
    soft: 'bg-pink-500/10',
    text: 'text-pink-400',
    fill: 'bg-pink-500',
  },
  gray: {
    border: 'border-slate-500/26',
    soft: 'bg-slate-500/10',
    text: 'text-slate-400',
    fill: 'bg-slate-500',
  },
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">{children}</p>
  );
}

export function MissionDetailPanel({
  mission,
  allTasks,
  onClose,
  onOpenTask,
  onEditMission,
}: MissionDetailPanelProps) {
  const setMissionStatus = useMissionStore((s) => s.setMissionStatus);
  const deleteMission = useMissionStore((s) => s.deleteMission);

  const createTask = useTaskStore((s) => s.createTask);
  const moveTaskToLane = useTaskStore((s) => s.moveTaskToLane);
  const markDone = useTaskStore((s) => s.markDone);
  const deleteTask = useTaskStore((s) => s.deleteTask);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [addingTask, setAddingTask] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMetadata, setShowMetadata] = useState(true);

  // Notes integration hooks and state
  const notes = useNoteStore((s) => s.notes);
  const categories = useNoteStore((s) => s.categories);
  const hydrateNotes = useNoteStore((s) => s.hydrate);
  const createNote = useNoteStore((s) => s.createNote);
  const updateNote = useNoteStore((s) => s.updateNote);
  const deleteNote = useNoteStore((s) => s.deleteNote);
  const togglePin = useNoteStore((s) => s.togglePin);
  const missions = useMissionStore((s) => s.missions);

  const [noteEditorState, setNoteEditorState] = useState<{ mode: 'create' | 'edit'; note?: Note } | null>(null);

  useEffect(() => {
    void hydrateNotes();
  }, [hydrateNotes]);

  const missionNotes = useMemo(() => {
    return notes.filter((n: Note) => n.mission_id === mission.id);
  }, [notes, mission.id]);

  // Filter tasks associated with this mission
  const missionTasks = useMemo(() => {
    return allTasks.filter((t: Task) => t.mission_id === mission.id && t.parent_task_id === null);
  }, [allTasks, mission.id]);

  const stats = useMemo(() => {
    const total = missionTasks.length;
    const done = missionTasks.filter((t: Task) => t.lane === 'done').length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, progress };
  }, [missionTasks]);

  const theme = COLOR_THEMES[mission.color] || COLOR_THEMES.blue;

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title || addingTask) return;

    setAddingTask(true);
    try {
      await createTask({
        title,
        mission_id: mission.id,
        lane: 'inbox',
        status: 'captured',
        priority: 'normal',
        energy: 'shallow',
        assignee_ids: newTaskAssignees,
      });
      setNewTaskTitle('');
      setNewTaskAssignees([]);
    } finally {
      setAddingTask(false);
    }
  }

  async function handleDeleteMission() {
    if (confirmDelete) {
      await deleteMission(mission.id);
      onClose();
    } else {
      setConfirmDelete(true);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-panel">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-borderSoft/24 px-5 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border text-xl', theme.border, theme.soft)}
          >
            <MissionIcon icon={mission.emoji} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Mission Details</p>
            <h3 className="truncate text-base font-semibold text-text-primary">
              {mission.title}
            </h3>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-borderSoft/40 text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 min-h-0 space-y-5 overflow-y-auto px-5 py-4">
        {/* Mission Stats / Progress */}
        <div className="space-y-2 rounded-2xl border border-borderSoft/30 bg-panel/30 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-text-secondary">Mission Progress</span>
            <span className="font-semibold text-text-primary">{stats.done}/{stats.total} Tasks Completed</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-panel2/60">
            <div
              className={cn('h-full rounded-full transition-all duration-300', theme.fill)}
              style={{ width: `${stats.progress}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-text-muted">
            <Badge tone={mission.status === 'active' ? 'accent' : mission.status === 'completed' ? 'success' : 'neutral'}>
              {mission.status === 'on_hold' ? 'On hold' : mission.status.charAt(0).toUpperCase() + mission.status.slice(1)}
            </Badge>
            {mission.target_date ? (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Target: {new Date(mission.target_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            ) : null}
          </div>
        </div>

        {/* Objective & Metadata accordion */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FieldLabel>Clarity & Context</FieldLabel>
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="text-xs text-accent hover:underline"
            >
              {showMetadata ? 'Hide details' : 'Show details'}
            </button>
          </div>

          {showMetadata && (
            <div className="space-y-4 rounded-2xl border border-borderSoft/30 bg-panel/20 p-4 text-sm">
              {mission.objective ? (
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-text-muted">Objective</p>
                  <p className="text-text-primary leading-relaxed">{mission.objective}</p>
                </div>
              ) : null}

              {mission.description ? (
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-text-muted">Description</p>
                  <p className="text-text-secondary leading-relaxed">{mission.description}</p>
                </div>
              ) : null}

              {mission.notes ? (
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-text-muted">Notes</p>
                  <p className="text-text-secondary whitespace-pre-line leading-relaxed">{mission.notes}</p>
                </div>
              ) : null}

              {!mission.objective && !mission.description && !mission.notes ? (
                <p className="text-text-muted italic text-center py-2">No clarity notes set for this mission yet.</p>
              ) : null}

              {mission.estimated_hours ? (
                <div className="flex items-center gap-2 border-t border-borderSoft/20 pt-3 text-xs text-text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Estimated: <strong className="text-text-secondary">{mission.estimated_hours} hours</strong> of effort</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Task list section */}
        <div className="space-y-3">
          <FieldLabel>Tasks in Mission ({stats.total})</FieldLabel>

          {/* Quick task addition */}
          <form onSubmit={(e) => void handleAddTask(e)} className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add new task to this mission..."
                className="h-9 flex-1 text-sm rounded-[14px]"
              />
              <Button size="sm" type="submit" disabled={!newTaskTitle.trim() || addingTask} className="rounded-[14px]">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <AssigneeSelect value={newTaskAssignees} onChange={setNewTaskAssignees} />
          </form>

          {/* Grouped tasks */}
          <div className="space-y-4 pt-1">
            {LANE_OPTIONS.map((lane) => {
              const laneTasks = missionTasks.filter((t: Task) => {
                if (lane.id === 'done') return t.lane === 'done' || t.status === 'done';
                return t.lane === lane.id && t.status !== 'done';
              });

              if (laneTasks.length === 0) return null;

              return (
                <div key={lane.id} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className={cn('h-1.5 w-1.5 rounded-full', lane.id === 'done' ? 'bg-success' : lane.id === 'now' ? 'bg-accent' : lane.id === 'next' ? 'bg-indigo-500' : lane.id === 'inbox' ? 'bg-warning' : 'bg-text-muted')} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      {lane.label} ({laneTasks.length})
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {laneTasks.map((task: Task) => {
                      const isCompleted = task.lane === 'done' || task.status === 'done';

                      return (
                        <div
                          key={task.id}
                          className="group flex items-center justify-between gap-3 rounded-[16px] border border-borderSoft/30 bg-panel/30 px-3 py-2.5 hover:bg-panel2/40 transition-colors cursor-pointer"
                          onClick={() => onOpenTask(task.id)}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isCompleted) {
                                  void moveTaskToLane(task.id, 'inbox');
                                } else {
                                  void markDone(task.id);
                                }
                              }}
                              className="text-text-muted hover:text-accent shrink-0 transition-colors"
                            >
                              {isCompleted ? (
                                <CheckSquare className="h-4.5 w-4.5 text-success" />
                              ) : (
                                <Square className="h-4.5 w-4.5" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <span className={cn('block text-sm truncate', isCompleted ? 'text-text-muted line-through' : 'text-text-primary font-medium')}>
                                {task.title}
                              </span>
                              {task.due_date && !isCompleted && (
                                <span className="text-[10px] text-warning flex items-center gap-1 mt-0.5">
                                  <Calendar className="h-3 w-3" /> Due {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {/* Lane selector dropdown */}
                            <select
                              value={task.lane}
                              onChange={(e) => void moveTaskToLane(task.id, e.target.value as TaskLane)}
                              className="bg-panel border border-borderSoft/32 text-[10px] font-medium text-text-secondary rounded-lg px-1.5 py-0.5 outline-none hover:border-accent/40"
                            >
                              {LANE_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Delete task "${task.title}"?`)) {
                                  void deleteTask(task.id);
                                }
                              }}
                              className="rounded p-1 text-text-muted hover:bg-warning/10 hover:text-warning"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {missionTasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-borderSoft/40 p-6 text-center">
                <Target className="mx-auto h-8 w-8 text-text-muted/65" />
                <p className="mt-2 text-sm font-semibold text-text-primary">No tasks in this mission yet</p>
                <p className="mt-1 text-xs text-text-muted">Create a task above to start making progress.</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Associated Notes Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <FieldLabel>Notes in Mission ({missionNotes.length})</FieldLabel>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNoteEditorState({ mode: 'create' })}
              className="h-7 text-xs text-accent rounded-[12px] px-2 hover:bg-accent/10"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
            </Button>
          </div>

          <div className="space-y-3">
            {missionNotes.map((note) => {
              const category = getCategoryById(note.category_id, categories);
              const noteStyle = getNoteColorStyle(category.color);
              const noteTitle = getNoteDisplayTitle(note);

              return (
                <div
                  key={note.id}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border bg-panel/35 p-4 hover:bg-panel2/40 transition-colors cursor-pointer',
                    noteStyle.border
                  )}
                  onClick={() => setNoteEditorState({ mode: 'edit', note })}
                >
                  <div className={cn('absolute inset-x-0 top-0 h-1', noteStyle.solid)} />
                  <div className="flex items-start justify-between gap-2 mb-2 pt-1">
                    <Badge tone="neutral" className={cn('gap-1 text-[9px] font-medium px-2 py-0.5 normal-case border', noteStyle.bg, noteStyle.border, noteStyle.text)}>
                      <NoteCategoryIcon icon={category.icon} className="h-2.5 w-2.5" />
                      {category.label}
                    </Badge>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => void togglePin(note.id)}
                        className={cn('p-1 text-text-muted hover:text-accent rounded hover:bg-panel2/50 transition-colors', note.pinned && 'text-accent')}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('Delete this note?')) {
                            void deleteNote(note.id);
                          }
                        }}
                        className="p-1 text-text-muted hover:text-warning rounded hover:bg-panel2/50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-semibold text-text-primary mb-1">
                    {noteTitle}
                  </h4>

                  {note.content.trim() ? (
                    <RichTextContent
                      content={note.content}
                      className="text-[13px] text-text-secondary line-clamp-3 leading-relaxed"
                    />
                  ) : (
                    <p className="text-xs text-text-muted italic">Empty note</p>
                  )}
                </div>
              );
            })}

            {missionNotes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-borderSoft/40 p-6 text-center">
                <FileText className="mx-auto h-7 w-7 text-text-muted/65" />
                <p className="mt-2 text-xs font-semibold text-text-primary">No notes linked to this mission</p>
                <p className="mt-1 text-[11px] text-text-muted">Create a note to capture logs, context, or links.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Footer / Mission Actions */}
      <div className="flex items-center justify-between border-t border-borderSoft/24 px-5 py-3.5 bg-panel2/10">
        <div className="flex items-center gap-2">
          {mission.status === 'active' ? (
            <Button
              size="sm"
              variant="secondary"
              className="text-xs h-8"
              onClick={() => void setMissionStatus(mission.id, 'on_hold')}
            >
              <Pause className="h-3.5 w-3.5 mr-1" /> Pause
            </Button>
          ) : mission.status === 'on_hold' ? (
            <Button
              size="sm"
              variant="secondary"
              className="text-xs h-8"
              onClick={() => void setMissionStatus(mission.id, 'active')}
            >
              <Play className="h-3.5 w-3.5 mr-1 text-accent" /> Resume
            </Button>
          ) : null}

          {mission.status !== 'completed' ? (
            <Button
              size="sm"
              variant="secondary"
              className="text-xs h-8 text-success hover:bg-success/10 hover:text-success"
              onClick={() => void setMissionStatus(mission.id, 'completed')}
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Complete
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="text-xs h-8 text-accent"
              onClick={() => void setMissionStatus(mission.id, 'active')}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Re-open
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEditMission(mission)}
            className="text-xs h-8 text-text-secondary hover:text-text-primary"
          >
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void handleDeleteMission()}
            className={cn(
              'text-xs h-8 text-text-muted hover:text-warning',
              confirmDelete ? 'bg-warning/10 text-warning' : ''
            )}
          >
            <Trash2 size={14} className="mr-1" />
            {confirmDelete ? 'Confirm?' : 'Delete'}
          </Button>

          {confirmDelete && (
            <button 
              className="text-[11px] text-text-muted hover:text-text-primary underline"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {noteEditorState && (
        <NoteEditorModal
          mode={noteEditorState.mode}
          note={noteEditorState.note}
          categories={categories}
          missions={missions}
          onClose={() => setNoteEditorState(null)}
          onSubmit={async (draft) => {
            if (noteEditorState.mode === 'create') {
              await createNote({ ...draft, mission_id: mission.id });
            } else if (noteEditorState.note) {
              await updateNote({ ...noteEditorState.note, ...draft });
            }
          }}
        />
      )}
    </div>
  );
}
