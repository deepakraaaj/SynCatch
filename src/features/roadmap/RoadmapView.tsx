import { useMemo, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { cn } from '../../lib/cn';
import { formatMinutes } from '../../lib/date';
import type { Mission } from '../missions/mission-types';
import type { Task } from '../tasks/task-types';

type ViewMode = 'gantt' | 'vertical' | 'grid';

interface RoadmapViewProps {
  missions: Mission[];
  allTasks: Task[];
}

interface MissionTone {
  border: string;
  soft: string;
  text: string;
  fill: string;
  halo: string;
}

interface MissionStats {
  total: number;
  done: number;
  now: number;
  next: number;
  later: number;
  inbox: number;
  estimatedMinutes: number;
}

const VIEW_MODES: ViewMode[] = ['grid', 'vertical', 'gantt'];
const ROADMAP_WEEKS = 8;

const missionToneMap: Record<Mission['color'], MissionTone> = {
  red: {
    border: 'border-red-500/26',
    soft: 'bg-red-500/10',
    text: 'text-red-400',
    fill: 'from-red-500/80 to-red-400/55',
    halo: 'shadow-[0_18px_40px_rgb(239_68_68/0.10)]',
  },
  orange: {
    border: 'border-orange-500/26',
    soft: 'bg-orange-500/10',
    text: 'text-orange-400',
    fill: 'from-orange-500/80 to-orange-400/55',
    halo: 'shadow-[0_18px_40px_rgb(249_115_22/0.10)]',
  },
  yellow: {
    border: 'border-yellow-500/26',
    soft: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    fill: 'from-yellow-500/85 to-yellow-400/55',
    halo: 'shadow-[0_18px_40px_rgb(234_179_8/0.08)]',
  },
  green: {
    border: 'border-green-500/26',
    soft: 'bg-green-500/10',
    text: 'text-green-400',
    fill: 'from-green-500/80 to-green-400/55',
    halo: 'shadow-[0_18px_40px_rgb(34_197_94/0.10)]',
  },
  teal: {
    border: 'border-teal-500/26',
    soft: 'bg-teal-500/10',
    text: 'text-teal-400',
    fill: 'from-teal-500/80 to-teal-400/55',
    halo: 'shadow-[0_18px_40px_rgb(20_184_166/0.10)]',
  },
  blue: {
    border: 'border-blue-500/26',
    soft: 'bg-blue-500/10',
    text: 'text-blue-400',
    fill: 'from-blue-500/80 to-blue-400/55',
    halo: 'shadow-[0_18px_40px_rgb(59_130_246/0.10)]',
  },
  purple: {
    border: 'border-purple-500/26',
    soft: 'bg-purple-500/10',
    text: 'text-purple-400',
    fill: 'from-purple-500/80 to-purple-400/55',
    halo: 'shadow-[0_18px_40px_rgb(168_85_247/0.10)]',
  },
  pink: {
    border: 'border-pink-500/26',
    soft: 'bg-pink-500/10',
    text: 'text-pink-400',
    fill: 'from-pink-500/80 to-pink-400/55',
    halo: 'shadow-[0_18px_40px_rgb(236_72_153/0.10)]',
  },
  gray: {
    border: 'border-slate-500/26',
    soft: 'bg-slate-500/10',
    text: 'text-slate-400',
    fill: 'from-slate-500/80 to-slate-400/55',
    halo: 'shadow-[0_18px_40px_rgb(100_116_139/0.10)]',
  },
};

export function RoadmapView({ missions, allTasks }: RoadmapViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const rootTasks = useMemo(
    () => allTasks.filter((task) => task.parent_task_id === null),
    [allTasks],
  );

  const tasksByMission = useMemo(() => {
    const grouped = new Map<string, Task[]>();

    missions.forEach((mission) => {
      grouped.set(mission.id, []);
    });

    rootTasks.forEach((task) => {
      if (!task.mission_id) {
        return;
      }

      const missionTasks = grouped.get(task.mission_id);
      if (missionTasks) {
        missionTasks.push(task);
      }
    });

    return grouped;
  }, [missions, rootTasks]);

  const activeMissions = missions.filter((mission) => mission.status === 'active');
  const onHoldMissions = missions.filter((mission) => mission.status === 'on_hold');
  const completedMissions = missions.filter((mission) => mission.status === 'completed');

  const activeMissionTasks = activeMissions.flatMap((mission) => tasksByMission.get(mission.id) ?? []);
  const totalDoneTasks = activeMissionTasks.filter(isTaskDone).length;
  const completionRate = activeMissionTasks.length
    ? Math.round((totalDoneTasks / activeMissionTasks.length) * 100)
    : 0;
  const totalEstimatedMinutes = activeMissionTasks.reduce(
    (sum, task) => sum + task.estimated_minutes,
    0,
  );
  const scheduledMissionCount = activeMissions.filter((mission) => mission.target_date).length;

  function getTasksForMission(missionId: string) {
    return tasksByMission.get(missionId) ?? [];
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-accent/75">Mission planning</p>
        <h2 className="text-[clamp(1.55rem,1.8vw,1.95rem)] font-semibold tracking-[-0.04em] text-text-primary">
          Roadmap
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-text-secondary">
          Track mission progress, remaining load, and what is actually moving next.
        </p>
      </div>

      <Card className="rounded-[28px] border-borderSoft/24 bg-panel/86 p-3">
        <div className="scrollbar-hidden overflow-x-auto">
          <div className="flex min-w-max items-stretch gap-2.5">
          <MetricCard
            caption="Missions in play"
            className="w-[180px] shrink-0"
            eyebrow="Active"
            meterPercent={Math.min(100, activeMissions.length * 18)}
            tone="accent"
            value={String(activeMissions.length)}
          />
          <MetricCard
            caption={`${totalDoneTasks} of ${activeMissionTasks.length} tasks complete`}
            className="w-[220px] shrink-0"
            eyebrow="Completion"
            meterPercent={completionRate}
            tone="success"
            value={`${completionRate}%`}
          />
          <MetricCard
            caption={`${activeMissionTasks.length} task${activeMissionTasks.length === 1 ? '' : 's'} planned`}
            className="w-[220px] shrink-0"
            eyebrow="Planned load"
            meterPercent={
              activeMissionTasks.length
                ? Math.min(100, Math.round((totalEstimatedMinutes / (activeMissionTasks.length * 60)) * 100))
                : 0
            }
            tone="warning"
            value={totalEstimatedMinutes ? formatMinutes(totalEstimatedMinutes) : '0m'}
          />
          <MetricCard
            caption={
              scheduledMissionCount
                ? `${scheduledMissionCount} mission${scheduledMissionCount === 1 ? '' : 's'} with a target date`
                : 'No mission dates set'
            }
            className="w-[210px] shrink-0"
            eyebrow="Scheduled"
            meterPercent={
              activeMissions.length
                ? Math.round((scheduledMissionCount / activeMissions.length) * 100)
                : 0
            }
            tone="neutral"
            value={String(scheduledMissionCount)}
          />

          <div className="ml-1 inline-flex h-fit shrink-0 items-center gap-1 self-center rounded-full border border-borderSoft/30 bg-panel2/40 p-1">
            {VIEW_MODES.map((mode) => {
              const active = viewMode === mode;
              return (
                <button
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors',
                    active
                      ? 'border border-accent/30 bg-accent/12 text-accent'
                      : 'text-text-secondary hover:bg-panel/52 hover:text-text-primary',
                  )}
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  type="button"
                >
                  {mode}
                </button>
              );
            })}
          </div>
          </div>
        </div>
      </Card>

      {onHoldMissions.length ? (
        <Card className="rounded-[30px] border-borderSoft/24 bg-panel/88 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">On hold</p>
              <p className="mt-2 text-sm text-text-secondary">
                These missions stay visible so paused work does not disappear from planning.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {onHoldMissions.map((mission) => (
                <span
                  className="inline-flex items-center gap-2 rounded-full border border-borderSoft/35 bg-panel2/56 px-3 py-2 text-sm text-text-secondary"
                  key={mission.id}
                >
                  <span>{mission.emoji}</span>
                  <span className="text-text-primary">{mission.title}</span>
                </span>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {activeMissions.length === 0 ? (
          <Card className="rounded-[34px] p-10 text-center">
            <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Roadmap empty</p>
            <p className="mt-3 text-lg font-semibold text-text-primary">No active missions yet</p>
            <p className="mt-2 text-sm text-text-secondary">
              Create a mission first, then attach tasks to it so the roadmap can show real
              structure.
            </p>
          </Card>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <GridView missions={activeMissions} getTasksForMission={getTasksForMission} />
            ) : null}
            {viewMode === 'vertical' ? (
              <VerticalView missions={activeMissions} getTasksForMission={getTasksForMission} />
            ) : null}
            {viewMode === 'gantt' ? (
              <GanttView missions={activeMissions} getTasksForMission={getTasksForMission} />
            ) : null}
          </>
        )}
      </div>

      {completedMissions.length ? (
        <Card className="rounded-[30px] border-borderSoft/24 bg-panel/88 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Completed missions</p>
              <p className="mt-2 text-sm text-text-secondary">
                Finished mission arcs stay here for quick recall and review.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {completedMissions.map((mission) => (
                <span
                  className="inline-flex items-center gap-2 rounded-full border border-success/28 bg-success/10 px-3 py-2 text-sm text-success"
                  key={mission.id}
                >
                  <span>{mission.emoji}</span>
                  <span>{mission.title}</span>
                  <span className="text-success/70">Done</span>
                </span>
              ))}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function GridView({
  missions,
  getTasksForMission,
}: {
  missions: Mission[];
  getTasksForMission: (id: string) => Task[];
}) {
  const [expandedMissionId, setExpandedMissionId] = useState<string | null>(null);
  const missionRows = missions.map((mission) => {
    const tasks = getTasksForMission(mission.id);
    return {
      mission,
      tasks,
      stats: getMissionStats(tasks),
    };
  });
  const maxEstimatedMinutes = Math.max(
    1,
    ...missionRows.map(({ stats }) => stats.estimatedMinutes),
  );

  return (
    <div className="space-y-3">
      {missionRows.map(({ mission, tasks, stats }) => (
        <MissionGridCard
          expanded={expandedMissionId === mission.id}
          key={mission.id}
          maxEstimatedMinutes={maxEstimatedMinutes}
          mission={mission}
          onToggle={() =>
            setExpandedMissionId((current) => (current === mission.id ? null : mission.id))
          }
          stats={stats}
          tasks={tasks}
        />
      ))}
    </div>
  );
}

function MissionGridCard({
  expanded,
  mission,
  onToggle,
  tasks,
  stats,
  maxEstimatedMinutes,
}: {
  expanded: boolean;
  mission: Mission;
  onToggle: () => void;
  tasks: Task[];
  stats: MissionStats;
  maxEstimatedMinutes: number;
}) {
  const tone = getMissionTone(mission.color);
  const progress = getMissionProgress(stats);
  const loadPercent = stats.estimatedMinutes
    ? Math.max(10, Math.round((stats.estimatedMinutes / maxEstimatedMinutes) * 100))
    : 0;

  return (
    <Card className={cn('relative overflow-hidden rounded-[30px] p-4', tone.halo)}>
      <div className={cn('absolute inset-y-4 left-0 w-1 rounded-r-full bg-gradient-to-b', tone.fill)} />

      <button
        aria-expanded={expanded}
        className="block w-full rounded-[24px] text-left transition-colors hover:bg-panel/16 focus:outline-none focus:ring-2 focus:ring-accent/30"
        onClick={onToggle}
        type="button"
      >
        <div className="grid gap-3 pl-2 pr-1 xl:grid-cols-[minmax(260px,1.55fr)_minmax(120px,.7fr)_minmax(140px,.8fr)_minmax(190px,.95fr)_92px] xl:items-center">
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border text-[1.7rem]', tone.border, tone.soft)}>
                {mission.emoji}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[1.35rem] font-semibold tracking-[-0.05em] text-text-primary">
                    {mission.title}
                  </h3>
                  {mission.is_pinned ? <Badge tone="accent">Pinned</Badge> : null}
                </div>
                <p className="mt-1 truncate text-sm leading-5 text-text-secondary">
                  {mission.objective || mission.description || 'No objective captured yet.'}
                </p>

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <MissionMetaPill label={`${stats.total} task${stats.total === 1 ? '' : 's'}`} tone={tone} />
                  <MissionMetaPill
                    label={mission.target_date ? formatDateLabel(mission.target_date) : 'No target'}
                    tone={tone}
                  />
                </div>
              </div>
            </div>
          </div>

          <RoadmapSummaryStat
            detail={`${stats.done}/${stats.total || 0} done`}
            label="Progress"
            tone={tone}
            value={`${progress}%`}
          />

          <RoadmapSummaryStat
            detail={`${stats.now} active • ${stats.next} next`}
            label="Load"
            tone={tone}
            value={stats.estimatedMinutes ? formatMinutes(stats.estimatedMinutes) : '0m'}
          />

          <RoadmapSummaryFlow stats={stats} />

          <div className="flex items-center justify-end gap-2 xl:justify-center">
            <span className="text-xs font-medium text-text-secondary">
              {expanded ? 'Hide' : 'Open'}
            </span>
            <span
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border border-borderSoft/28 bg-panel2/36 text-lg text-text-primary transition-transform',
                expanded ? 'rotate-45' : null,
              )}
            >
              +
            </span>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="mt-4 border-t border-borderSoft/24 pt-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(170px,.85fr)_minmax(220px,1fr)_minmax(250px,1.1fr)]">
            <RoadmapMetricPanel
              caption={`${stats.now} active • ${stats.next} next • ${stats.inbox + stats.later} waiting`}
              label="Load profile"
              meterPercent={loadPercent}
              tone={tone}
              value={stats.estimatedMinutes ? formatMinutes(stats.estimatedMinutes) : '0m'}
            />

            <FlowInfographic stats={stats} />

            <TaskRailPreview tasks={tasks} tone={tone} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function VerticalView({
  missions,
  getTasksForMission,
}: {
  missions: Mission[];
  getTasksForMission: (id: string) => Task[];
}) {
  return (
    <div className="space-y-3">
      {missions.map((mission, index) => {
        const tasks = getTasksForMission(mission.id);
        const tone = getMissionTone(mission.color);
        const stats = getMissionStats(tasks);
        const progress = getMissionProgress(stats);

        return (
          <div className="grid gap-3 lg:grid-cols-[56px,minmax(0,1fr)]" key={mission.id}>
            <div className="relative hidden lg:block">
              <div className="absolute left-[27px] top-0 bottom-0 w-px bg-gradient-to-b from-accent/55 to-borderSoft/10" />
              <div className={cn('relative z-10 mx-auto mt-4 h-4 w-4 rounded-full border-2', tone.border, tone.soft)} />
              {index === missions.length - 1 ? (
                <div className="absolute left-[27px] bottom-0 h-6 w-px bg-[rgb(var(--surface-2))]" />
              ) : null}
            </div>

            <Card className="rounded-[30px] p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={cn('flex h-10 w-10 items-center justify-center rounded-[14px] border text-xl', tone.border, tone.soft)}>
                      {mission.emoji}
                    </span>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Mission</p>
                      <h3 className="mt-1 text-xl font-semibold text-text-primary">{mission.title}</h3>
                    </div>
                    <MissionMetaPill
                      label={mission.target_date ? `Target ${formatDateLabel(mission.target_date)}` : 'No target'}
                      tone={tone}
                    />
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
                    {mission.objective || mission.description || 'No objective captured yet.'}
                  </p>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3 xl:min-w-[320px] xl:max-w-[390px]">
                  <MissionStatBlock
                    label="Done"
                    value={`${stats.done}/${stats.total}`}
                    detail={`${progress}% complete`}
                    tone={tone}
                  />
                  <MissionStatBlock
                    label="Focus"
                    value={stats.now}
                    detail={`${stats.next} next up`}
                    tone={tone}
                  />
                  <MissionStatBlock
                    label="Load"
                    value={stats.estimatedMinutes ? formatMinutes(stats.estimatedMinutes) : '0m'}
                    detail={`${stats.inbox + stats.later} queued later`}
                    tone={tone}
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Task flow</p>
                  <span className={cn('text-xs font-medium', tone.text)}>{progress}% done</span>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-panel2/70">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r transition-all', tone.fill)}
                    style={{ width: `${Math.max(progress, progress === 0 ? 0 : 8)}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr),240px]">
                <MissionTaskPreview tasks={tasks} tone={tone} />
                <Card className="rounded-[24px] border-borderSoft/20 bg-panel/68 p-3.5 shadow-none">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Snapshot</p>
                  <div className="mt-4 space-y-3">
                    <SnapshotRow label="Active" value={stats.now} />
                    <SnapshotRow label="Queue" value={stats.inbox} />
                    <SnapshotRow label="Later" value={stats.later} />
                    <SnapshotRow label="Minutes" value={stats.estimatedMinutes ? formatMinutes(stats.estimatedMinutes) : '0m'} />
                  </div>
                </Card>
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function GanttView({
  missions,
  getTasksForMission,
}: {
  missions: Mission[];
  getTasksForMission: (id: string) => Task[];
}) {
  const now = new Date();
  const weekLabels = Array.from({ length: ROADMAP_WEEKS }, (_, index) => {
    const weekDate = new Date(now);
    weekDate.setDate(weekDate.getDate() + index * 7);

    return weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  return (
    <Card className="rounded-[30px] p-4">
      <div className="flex flex-col gap-3 border-b border-borderSoft/24 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Timeline</p>
          <h3 className="mt-1 text-base font-semibold text-text-primary">Directional plan</h3>
        </div>
        <span className="inline-flex items-center rounded-full border border-borderSoft/28 bg-panel2/38 px-3 py-1.5 text-xs text-text-secondary">
          Relative spread, not hard scheduling
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[760px] space-y-2">
          <div className="grid grid-cols-[220px,repeat(8,minmax(48px,1fr)),48px] items-center gap-2 px-1">
            <div className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Mission</div>
            {weekLabels.map((label) => (
              <div className="text-center text-[10px] uppercase tracking-[0.18em] text-text-muted" key={label}>
                {label}
              </div>
            ))}
            <div className="text-right text-[10px] uppercase tracking-[0.2em] text-text-muted">Done</div>
          </div>

          {missions.map((mission) => {
            const tasks = getTasksForMission(mission.id);
            const tone = getMissionTone(mission.color);
            const stats = getMissionStats(tasks);
            const progress = getMissionProgress(stats);
            const laneSpan = getTimelineSpan(mission, tasks);
            const completedCells = laneSpan
              ? Math.max(0, Math.round((progress / 100) * laneSpan.length))
              : 0;

            return (
              <div
                className="grid grid-cols-[220px,repeat(8,minmax(48px,1fr)),48px] items-center gap-2 rounded-[20px] border border-borderSoft/24 bg-panel/24 p-1.5"
                key={mission.id}
              >
                <div className="flex min-w-0 items-center gap-3 rounded-[16px] bg-panel2/44 px-3 py-2.5">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border text-lg', tone.border, tone.soft)}>
                    {mission.emoji}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{mission.title}</p>
                    <p className="mt-0.5 text-[11px] text-text-secondary">
                      {stats.done}/{stats.total || 0} done
                    </p>
                  </div>
                </div>

                {weekLabels.map((_, index) => {
                  const isInSpan = laneSpan.includes(index);
                  const isComplete = isInSpan && completedCells > 0 && index < laneSpan[0] + completedCells;
                  const isTarget = mission.target_date ? index === laneSpan[laneSpan.length - 1] : false;

                  return (
                    <div
                      className={cn(
                        'h-7 rounded-[10px] border transition-colors',
                        isComplete
                          ? cn(tone.border, tone.soft)
                          : isInSpan
                            ? 'border-borderSoft/30 bg-panel2/34'
                            : 'border-borderSoft/16 bg-panel/10',
                        isTarget ? 'ring-1 ring-accent/35' : null,
                      )}
                      key={`${mission.id}-${index}`}
                    >
                      {isComplete ? (
                        <div className={cn('h-full w-full rounded-[9px] bg-gradient-to-r', tone.fill)} />
                      ) : null}
                    </div>
                  );
                })}

                <div className={cn('text-right text-sm font-semibold', tone.text)}>{progress}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function RoadmapSummaryStat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: MissionTone;
}) {
  return (
    <div className="rounded-[18px] border border-borderSoft/24 bg-panel/18 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">{label}</p>
      <p className={cn('mt-2 text-lg font-semibold tracking-[-0.04em]', tone.text)}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">{detail}</p>
    </div>
  );
}

function RoadmapSummaryFlow({
  stats,
}: {
  stats: MissionStats;
}) {
  const total = Math.max(stats.total, 1);
  const segments = [
    { key: 'now', count: stats.now, className: 'bg-accent' },
    { key: 'next', count: stats.next, className: 'bg-accent/55' },
    { key: 'inbox', count: stats.inbox, className: 'bg-warning/75' },
    { key: 'later', count: stats.later, className: 'bg-text-muted/55' },
    { key: 'done', count: stats.done, className: 'bg-success/80' },
  ];

  return (
    <div className="rounded-[18px] border border-borderSoft/24 bg-panel/18 px-3 py-3">
      <div className="flex items-end justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Flow</p>
        <span className="text-xs text-text-secondary">{stats.total} total</span>
      </div>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-panel2/72">
        {segments.map((segment) => (
          <div
            className={cn('h-full transition-all', segment.className, segment.count === 0 ? 'opacity-25' : null)}
            key={segment.key}
            style={{ width: `${(segment.count / total) * 100}%` }}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-secondary">
        <span>Now {stats.now}</span>
        <span>Next {stats.next}</span>
        <span>Queue {stats.inbox}</span>
        <span>Done {stats.done}</span>
      </div>
    </div>
  );
}

function RoadmapMetricPanel({
  label,
  value,
  caption,
  meterPercent,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  meterPercent: number;
  tone: MissionTone;
}) {
  return (
    <div className="rounded-[18px] border border-borderSoft/24 bg-panel/22 p-3.5">
      <div className="flex items-end justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">{label}</p>
        <span className={cn('text-lg font-semibold tracking-[-0.04em]', tone.text)}>{value}</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel2/72">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all', tone.fill)}
          style={{ width: `${Math.min(100, Math.max(0, meterPercent))}%` }}
        />
      </div>

      <p className="mt-2 text-xs leading-5 text-text-secondary">{caption}</p>
    </div>
  );
}

function FlowInfographic({
  stats,
}: {
  stats: MissionStats;
}) {
  const total = Math.max(stats.total, 1);
  const segments = [
    { key: 'now', label: 'Now', count: stats.now, barClass: 'bg-accent', textClass: 'text-accent' },
    { key: 'next', label: 'Next', count: stats.next, barClass: 'bg-accent/55', textClass: 'text-text-primary' },
    { key: 'inbox', label: 'Inbox', count: stats.inbox, barClass: 'bg-warning/75', textClass: 'text-warning' },
    { key: 'later', label: 'Later', count: stats.later, barClass: 'bg-text-muted/55', textClass: 'text-text-secondary' },
    { key: 'done', label: 'Done', count: stats.done, barClass: 'bg-success/80', textClass: 'text-success' },
  ];

  return (
    <div className="rounded-[18px] border border-borderSoft/24 bg-panel/22 p-3.5">
      <div className="flex items-end justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Flow</p>
        <span className="text-xs text-text-secondary">{stats.total} total</span>
      </div>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-panel2/72">
        {segments.map((segment) => (
          <div
            className={cn('h-full transition-all', segment.barClass, segment.count === 0 ? 'opacity-25' : null)}
            key={segment.key}
            style={{ width: `${(segment.count / total) * 100}%` }}
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        {segments.map((segment) => (
          <div className="flex items-center justify-between gap-2 text-text-secondary" key={segment.key}>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', segment.barClass)} />
              {segment.label}
            </span>
            <span className={cn('font-medium', segment.textClass)}>{segment.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskRailPreview({
  tasks,
  tone,
}: {
  tasks: Task[];
  tone: MissionTone;
}) {
  const visibleTasks = tasks.slice(0, 3);

  return (
    <div className="rounded-[18px] border border-borderSoft/24 bg-panel/22 p-3.5">
      <div className="flex items-end justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">Tasks</p>
        <span className={cn('text-xs font-medium', tone.text)}>{tasks.length}</span>
      </div>

      <div className="mt-3 space-y-1.5">
        {visibleTasks.length ? (
          visibleTasks.map((task) => {
            const done = isTaskDone(task);

            return (
              <div
                className="flex items-center gap-2.5 rounded-[14px] border border-borderSoft/24 bg-panel2/42 px-3 py-2"
                key={task.id}
              >
                <span
                  className={cn(
                    'h-2.5 w-2.5 shrink-0 rounded-full',
                    done
                      ? 'bg-success'
                      : task.lane === 'now'
                        ? 'bg-accent'
                        : task.lane === 'next'
                          ? 'bg-accent/55'
                          : task.lane === 'later'
                            ? 'bg-text-muted/55'
                            : 'bg-warning/75',
                  )}
                />
                <span className={cn('min-w-0 flex-1 truncate text-sm', done ? 'text-text-muted line-through' : 'text-text-primary')}>
                  {task.title}
                </span>
                <span className="shrink-0 text-[11px] text-text-muted">
                  {formatMinutes(task.estimated_minutes)}
                </span>
              </div>
            );
          })
        ) : (
          <div className="rounded-[14px] border border-dashed border-borderSoft/28 bg-panel/16 px-3 py-4 text-sm text-text-secondary">
            No root tasks linked yet.
          </div>
        )}
      </div>
    </div>
  );
}

function MissionTaskPreview({
  tasks,
  tone,
}: {
  tasks: Task[];
  tone: MissionTone;
}) {
  const visibleTasks = tasks.slice(0, 3);

  return (
    <div className="rounded-[24px] border border-borderSoft/24 bg-panel/24 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-text-muted">Task stack</p>
          <p className="mt-1 text-xs text-text-secondary">
            Root tasks only, so this stays focused on the mission’s real moving pieces.
          </p>
        </div>
        <span className={cn('text-xs font-medium', tone.text)}>{tasks.length}</span>
      </div>

      <div className="mt-3 space-y-2">
        {visibleTasks.length ? (
          visibleTasks.map((task) => {
            const done = isTaskDone(task);

            return (
              <div
                className="flex items-center gap-3 rounded-[16px] border border-borderSoft/24 bg-panel2/40 px-3 py-2.5"
                key={task.id}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    done ? 'border-success/25 bg-success/10 text-success' : cn(tone.border, tone.soft, tone.text),
                  )}
                >
                  {done ? '✓' : task.lane === 'now' ? '!' : '•'}
                </span>

                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-medium', done ? 'text-text-muted line-through' : 'text-text-primary')}>
                    {task.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                    <span>{laneLabel(task.lane)}</span>
                    <span>•</span>
                    <span>{formatMinutes(task.estimated_minutes)}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-[16px] border border-dashed border-borderSoft/28 bg-panel/16 px-4 py-5 text-sm text-text-secondary">
            No root tasks linked yet.
          </div>
        )}
      </div>

      {tasks.length > visibleTasks.length ? (
        <p className="mt-3 text-xs text-text-muted">+{tasks.length - visibleTasks.length} more task{tasks.length - visibleTasks.length === 1 ? '' : 's'}</p>
      ) : null}
    </div>
  );
}

function MetricCard({
  eyebrow,
  value,
  caption,
  meterPercent,
  tone,
  className,
}: {
  eyebrow: string;
  value: string;
  caption: string;
  meterPercent: number;
  tone: 'accent' | 'success' | 'warning' | 'neutral';
  className?: string;
}) {
  const valueTone =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'neutral'
          ? 'text-text-primary'
          : 'text-accent';
  const meterTone =
    tone === 'success'
      ? 'bg-success'
      : tone === 'warning'
        ? 'bg-warning'
        : tone === 'neutral'
          ? 'bg-text-primary/55'
          : 'bg-accent';

  return (
    <div className={cn('rounded-[20px] border border-borderSoft/24 bg-panel2/34 px-4 py-3', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">{eyebrow}</p>
          <p className={cn('mt-2 text-[1.35rem] font-semibold leading-none tracking-[-0.05em]', valueTone)}>
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-text-secondary">{caption}</p>
        </div>

        <div className="mt-1 flex h-10 w-16 shrink-0 items-end rounded-[14px] border border-borderSoft/18 bg-panel/26 px-2 py-2">
          <div className="flex w-full items-end gap-1.5">
            <span className={cn('w-2 rounded-full bg-borderSoft/45', meterPercent >= 25 ? meterTone : 'bg-borderSoft/28')} style={{ height: '35%' }} />
            <span className={cn('w-2 rounded-full bg-borderSoft/45', meterPercent >= 50 ? meterTone : 'bg-borderSoft/28')} style={{ height: '55%' }} />
            <span className={cn('w-2 rounded-full bg-borderSoft/45', meterPercent >= 75 ? meterTone : 'bg-borderSoft/28')} style={{ height: '78%' }} />
            <span className={cn('w-2 rounded-full bg-borderSoft/45', meterPercent >= 100 ? meterTone : 'bg-borderSoft/28')} style={{ height: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MissionStatBlock({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: MissionTone;
}) {
  return (
    <div className="rounded-[20px] border border-borderSoft/24 bg-panel/22 p-3.5">
      <p className="text-[10px] uppercase tracking-[0.24em] text-text-muted">{label}</p>
      <p className={cn('mt-2.5 text-lg font-semibold tracking-[-0.04em]', tone.text)}>{value}</p>
      <p className="mt-1.5 text-xs leading-5 text-text-secondary">{detail}</p>
    </div>
  );
}

function MissionMetaPill({
  label,
  tone,
}: {
  label: string;
  tone: MissionTone;
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.24em]', tone.border, tone.soft, tone.text)}>
      {label}
    </span>
  );
}

function SnapshotRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-borderSoft/24 bg-panel2/38 px-3 py-2.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function getMissionTone(color: Mission['color']) {
  return missionToneMap[color] ?? missionToneMap.blue;
}

function getMissionStats(tasks: Task[]): MissionStats {
  return tasks.reduce<MissionStats>(
    (summary, task) => {
      summary.total += 1;
      summary.estimatedMinutes += task.estimated_minutes;

      if (isTaskDone(task)) {
        summary.done += 1;
      } else if (task.lane === 'now') {
        summary.now += 1;
      } else if (task.lane === 'next') {
        summary.next += 1;
      } else if (task.lane === 'later') {
        summary.later += 1;
      } else {
        summary.inbox += 1;
      }

      return summary;
    },
    {
      total: 0,
      done: 0,
      now: 0,
      next: 0,
      later: 0,
      inbox: 0,
      estimatedMinutes: 0,
    },
  );
}

function getMissionProgress(stats: MissionStats) {
  if (!stats.total) {
    return 0;
  }

  return Math.round((stats.done / stats.total) * 100);
}

function isTaskDone(task: Task) {
  return task.lane === 'done' || task.status === 'done';
}

function laneLabel(lane: Task['lane']) {
  if (lane === 'now') {
    return 'Active';
  }

  if (lane === 'next') {
    return 'Next';
  }

  if (lane === 'later') {
    return 'Later';
  }

  if (lane === 'done') {
    return 'Done';
  }

  return 'Queue';
}

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getTimelineSpan(mission: Mission, tasks: Task[]) {
  const totalWeeks = ROADMAP_WEEKS;
  const defaultLength = Math.min(totalWeeks, Math.max(2, Math.ceil(Math.max(tasks.length, 1) / 2) + 1));

  if (!mission.target_date) {
    return Array.from({ length: defaultLength }, (_, index) => index);
  }

  const today = new Date();
  const target = new Date(`${mission.target_date}T00:00:00`);
  const rawDiff = target.getTime() - today.getTime();
  const weekIndex = Math.min(
    totalWeeks - 1,
    Math.max(1, Math.floor(rawDiff / (7 * 24 * 60 * 60 * 1000))),
  );
  const start = Math.max(0, weekIndex - defaultLength + 1);
  const end = Math.min(totalWeeks - 1, weekIndex);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
