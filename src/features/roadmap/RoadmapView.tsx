import { useState } from 'react';
import { cn } from '../../lib/cn';
import type { Mission } from '../missions/mission-types';
import type { Task } from '../tasks/task-types';

type ViewMode = 'gantt' | 'vertical' | 'grid';

interface RoadmapViewProps {
  missions: Mission[];
  allTasks: Task[];
}

export function RoadmapView({ missions, allTasks }: RoadmapViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const activeMissions = missions.filter((m) => m.status === 'active');
  const completedMissions = missions.filter((m) => m.status === 'completed');

  // Helper to get tasks for a mission
  const getTasksForMission = (missionId: string) => {
    return allTasks.filter((t) => t.mission_id === missionId && !t.parent_task_id);
  };

  // Helper to calculate mission progress
  const getMissionProgress = (missionId: string) => {
    const tasks = getTasksForMission(missionId);
    if (tasks.length === 0) return 0;
    const done = tasks.filter((t) => t.lane === 'done').length;
    return Math.round((done / tasks.length) * 100);
  };

  // Helper to get color for a mission
  const getMissionColor = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      red: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-500/40' },
      orange: { bg: 'bg-orange-900/30', text: 'text-orange-400', border: 'border-orange-500/40' },
      yellow: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-500/40' },
      green: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-500/40' },
      teal: { bg: 'bg-teal-900/30', text: 'text-teal-400', border: 'border-teal-500/40' },
      blue: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-500/40' },
      purple: { bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-500/40' },
      pink: { bg: 'bg-pink-900/30', text: 'text-pink-400', border: 'border-pink-500/40' },
      gray: { bg: 'bg-gray-700/30', text: 'text-gray-400', border: 'border-gray-500/40' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-xl font-semibold text-text-primary">Roadmap</h2>
        <div className="flex gap-2">
          {(['grid', 'vertical', 'gantt'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors capitalize',
                viewMode === mode
                  ? 'border-accent/40 bg-accent/12 text-accent'
                  : 'border-borderSoft/40 text-text-muted hover:border-borderStrong/40',
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {activeMissions.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-text-muted">No active missions. Create one to get started!</p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' && <GridView missions={activeMissions} getMissionProgress={getMissionProgress} getTasksForMission={getTasksForMission} getMissionColor={getMissionColor} />}
            {viewMode === 'vertical' && <VerticalView missions={activeMissions} getTasksForMission={getTasksForMission} getMissionColor={getMissionColor} />}
            {viewMode === 'gantt' && <GanttView missions={activeMissions} getTasksForMission={getTasksForMission} getMissionColor={getMissionColor} />}
          </>
        )}
      </div>

      {/* Completed missions section */}
      {completedMissions.length > 0 ? (
        <div className="border-t border-borderSoft/24 px-6 py-4">
          <h3 className="mb-3 text-sm font-medium text-text-muted">Completed missions</h3>
          <div className="flex flex-wrap gap-2">
            {completedMissions.map((mission) => (
              <div key={mission.id} className="flex items-center gap-2 rounded-full border border-success/40 bg-success/8 px-3 py-1.5">
                <span className="text-lg">{mission.emoji}</span>
                <span className="text-sm text-success">{mission.title}</span>
                <span className="text-xs text-success/60">✓</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────
// View Components
// ──────────────────────────────────────────

function GridView({
  missions,
  getMissionProgress,
  getTasksForMission,
  getMissionColor,
}: {
  missions: Mission[];
  getMissionProgress: (id: string) => number;
  getTasksForMission: (id: string) => Task[];
  getMissionColor: (color: string) => { bg: string; text: string; border: string };
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {missions.map((mission) => {
        const progress = getMissionProgress(mission.id);
        const tasks = getTasksForMission(mission.id);
        const colors = getMissionColor(mission.color);

        return (
          <div
            key={mission.id}
            className={cn(
              'rounded-[20px] border p-5 backdrop-blur-sm transition-all hover:border-opacity-100',
              colors.bg,
              colors.border,
            )}
          >
            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{mission.emoji}</span>
                <div>
                  <h3 className="font-semibold text-text-primary">{mission.title}</h3>
                  <p className="mt-1 text-[11px] text-text-muted">{tasks.length} tasks</p>
                </div>
              </div>
            </div>

            {/* Progress ring */}
            <div className="mb-4 flex items-center gap-3">
              <div className="relative h-16 w-16">
                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-borderSoft/30"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${progress * 2.83} 283`}
                    className={colors.text}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn('text-sm font-bold', colors.text)}>{progress}%</span>
                </div>
              </div>

              <div className="flex-1">
                <p className={cn('text-xs font-medium', colors.text)}>
                  {tasks.filter((t) => t.lane === 'done').length} of {tasks.length} done
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-borderSoft/20">
                  <div
                    className={cn('h-full transition-all', colors.bg)}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Objective */}
            {mission.objective ? (
              <p className="mb-4 text-[13px] text-text-muted line-clamp-2">{mission.objective}</p>
            ) : null}

            {/* Task summary */}
            {tasks.length > 0 ? (
              <div className="space-y-1 rounded-lg border border-borderSoft/20 bg-black/20 p-2">
                {tasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 text-[11px] text-text-muted">
                    <span className={task.lane === 'done' ? 'text-success' : 'text-text-muted'}>
                      {task.lane === 'done' ? '✓' : '○'}
                    </span>
                    <span className={task.lane === 'done' ? 'line-through text-text-muted/50' : ''}>
                      {task.title}
                    </span>
                  </div>
                ))}
                {tasks.length > 3 ? (
                  <p className="text-[10px] text-text-muted/60 pt-1">+{tasks.length - 3} more</p>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function VerticalView({
  missions,
  getTasksForMission,
  getMissionColor,
}: {
  missions: Mission[];
  getTasksForMission: (id: string) => Task[];
  getMissionColor: (color: string) => { bg: string; text: string; border: string };
}) {
  return (
    <div className="space-y-6">
      {missions.map((mission, idx) => {
        const tasks = getTasksForMission(mission.id);
        const colors = getMissionColor(mission.color);
        const completedTasks = tasks.filter((t) => t.lane === 'done');

        return (
          <div key={mission.id} className="space-y-3">
            {/* Timeline connector */}
            {idx < missions.length - 1 ? (
              <div className="relative h-8 pl-6">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-accent/50 to-accent/10" />
              </div>
            ) : null}

            {/* Mission card */}
            <div className={cn('rounded-[16px] border p-4', colors.border, colors.bg)}>
              <div className="flex gap-4">
                {/* Timeline dot */}
                <div className="relative flex flex-col items-center pt-1">
                  <div className={cn('h-3 w-3 rounded-full border-2', colors.border, colors.bg)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold text-text-primary">
                        <span className="text-2xl">{mission.emoji}</span>
                        {mission.title}
                      </h3>
                      {mission.objective ? (
                        <p className="mt-1 text-[13px] text-text-muted">{mission.objective}</p>
                      ) : null}
                    </div>
                    <span className={cn('text-xs font-medium', colors.text)}>
                      {completedTasks.length}/{tasks.length}
                    </span>
                  </div>

                  {/* Task list */}
                  {tasks.length > 0 ? (
                    <div className="mt-3 space-y-1.5">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2.5 rounded-lg border border-borderSoft/20 bg-black/20 p-2.5 text-[12px]"
                        >
                          <span className={cn('text-sm font-semibold', task.lane === 'done' ? 'text-success' : colors.text)}>
                            {task.lane === 'done' ? '✓' : '→'}
                          </span>
                          <span className={task.lane === 'done' ? 'line-through text-text-muted/50 flex-1' : 'text-text-primary flex-1'}>
                            {task.title}
                          </span>
                          {task.estimated_minutes ? (
                            <span className="text-text-muted/60">{task.estimated_minutes}m</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GanttView({
  missions,
  getTasksForMission,
  getMissionColor,
}: {
  missions: Mission[];
  getTasksForMission: (id: string) => Task[];
  getMissionColor: (color: string) => { bg: string; text: string; border: string };
}) {
  // Calculate date range
  const now = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 3); // Show 3 months ahead

  const weeks = Math.ceil((endDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 2;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* Gantt header with week markers */}
        <div className="mb-4 flex gap-4">
          <div className="w-40 shrink-0" />
          <div className="flex gap-1">
            {Array.from({ length: weeks }).map((_, idx) => {
              const weekDate = new Date(now);
              weekDate.setDate(weekDate.getDate() + idx * 7);
              return (
                <div
                  key={idx}
                  className="flex w-12 flex-col items-center gap-1 text-[10px] text-text-muted"
                >
                  <span>{weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gantt bars */}
        {missions.map((mission) => {
          const tasks = getTasksForMission(mission.id);
          const colors = getMissionColor(mission.color);
          const completedTasks = tasks.filter((t) => t.lane === 'done');

          return (
            <div key={mission.id} className="mb-3 flex gap-4">
              {/* Mission label */}
              <div className="w-40 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{mission.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-semibold text-text-primary">{mission.title}</h4>
                    <p className="text-[10px] text-text-muted">{completedTasks.length}/{tasks.length}</p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex flex-1 gap-1">
                {Array.from({ length: weeks }).map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'w-12 h-6 rounded-sm border border-borderSoft/30 transition-colors',
                      idx < 2 ? colors.bg : 'bg-borderSoft/10',
                    )}
                  />
                ))}
              </div>

              {/* Progress percentage */}
              <div className="w-12 shrink-0 text-right">
                <span className={cn('text-sm font-semibold', colors.text)}>
                  {completedTasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
