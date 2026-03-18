import type { ActivityLogEntry } from './activity-repository';

export type DistractionCategory =
  | 'message'
  | 'meeting'
  | 'person'
  | 'web'
  | 'tooling'
  | 'internal'
  | 'environment'
  | 'context_switch'
  | 'other';

export interface DistractionCategoryOption {
  value: DistractionCategory;
  label: string;
  avoidanceTip: string;
}

export interface DistractionRecord {
  id: string;
  category: DistractionCategory;
  categoryLabel: string;
  trigger: string;
  note: string;
  taskId: string | null;
  taskTitle: string;
  createdAt: string;
}

export interface DistractionPeriodSummary {
  total: number;
  topCategory: null | {
    value: DistractionCategory;
    label: string;
    count: number;
  };
  topTrigger: null | {
    label: string;
    count: number;
  };
  categories: Array<{
    value: DistractionCategory;
    label: string;
    count: number;
  }>;
  recent: DistractionRecord[];
}

export interface DistractionReport {
  today: DistractionPeriodSummary;
  week: DistractionPeriodSummary;
  month: DistractionPeriodSummary;
  recent: DistractionRecord[];
  avoidanceTip: string;
}

export const distractionCategoryOptions: DistractionCategoryOption[] = [
  {
    value: 'message',
    label: 'Messages',
    avoidanceTip: 'Batch Slack and email checks instead of reacting in real time.',
  },
  {
    value: 'meeting',
    label: 'Meetings',
    avoidanceTip: 'Protect a no-meeting block when you need deep work.',
  },
  {
    value: 'person',
    label: 'People',
    avoidanceTip: 'Use a visible focus signal so teammates know when not to interrupt.',
  },
  {
    value: 'web',
    label: 'Web',
    avoidanceTip: 'Close or block tabs that are not needed for the current task.',
  },
  {
    value: 'tooling',
    label: 'Tooling',
    avoidanceTip: 'Prepare your tools before a focus block so setup friction does not pull you away.',
  },
  {
    value: 'internal',
    label: 'Own thoughts',
    avoidanceTip: 'Capture intrusive thoughts quickly and return to the task instead of context switching.',
  },
  {
    value: 'environment',
    label: 'Environment',
    avoidanceTip: 'Adjust your space, headphones, or notifications before starting a focus block.',
  },
  {
    value: 'context_switch',
    label: 'Context switch',
    avoidanceTip: 'Finish or park the current step before switching so the restart cost stays low.',
  },
  {
    value: 'other',
    label: 'Other',
    avoidanceTip: 'Review the trigger and create one small guardrail for next time.',
  },
];

const categoryByValue = Object.fromEntries(
  distractionCategoryOptions.map((option) => [option.value, option]),
) as Record<DistractionCategory, DistractionCategoryOption>;

function normalizeCategory(value: unknown): DistractionCategory {
  if (typeof value !== 'string') {
    return 'other';
  }

  return value in categoryByValue ? (value as DistractionCategory) : 'other';
}

function normalizeText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function sameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function withinRollingDays(date: Date, now: Date, days: number) {
  return now.getTime() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

export function getDistractionRecords(entries: ActivityLogEntry[]) {
  return entries
    .filter((entry) => entry.action === 'distraction_logged')
    .map<DistractionRecord>((entry) => {
      const category = normalizeCategory(entry.details.category);
      const categoryOption = categoryByValue[category];
      const trigger = normalizeText(entry.details.trigger, 'Unlabeled distraction');

      return {
        id: entry.id,
        category,
        categoryLabel: categoryOption.label,
        trigger,
        note: normalizeText(entry.details.note),
        taskId: entry.task_id,
        taskTitle: normalizeText(entry.details.taskTitle, 'No active task'),
        createdAt: entry.created_at,
      };
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function summarizeDistractions(records: DistractionRecord[]) {
  const categoryCounts = new Map<DistractionCategory, number>();
  const triggerCounts = new Map<string, { label: string; count: number }>();

  records.forEach((record) => {
    categoryCounts.set(record.category, (categoryCounts.get(record.category) ?? 0) + 1);

    const key = record.trigger.toLowerCase();
    const existing = triggerCounts.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    triggerCounts.set(key, {
      label: record.trigger,
      count: 1,
    });
  });

  const categories = [...categoryCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([value, count]) => ({
      value,
      label: categoryByValue[value].label,
      count,
    }));

  const topTrigger =
    [...triggerCounts.values()].sort((left, right) => right.count - left.count)[0] ?? null;

  return {
    total: records.length,
    topCategory: categories[0] ?? null,
    topTrigger,
    categories,
    recent: records.slice(0, 5),
  };
}

export function buildDistractionReport(entries: ActivityLogEntry[], now = new Date()): DistractionReport {
  const records = getDistractionRecords(entries);
  const todayRecords = records.filter((record) => sameLocalDay(new Date(record.createdAt), now));
  const weekRecords = records.filter((record) => withinRollingDays(new Date(record.createdAt), now, 7));
  const monthRecords = records.filter((record) => withinRollingDays(new Date(record.createdAt), now, 30));
  const monthSummary = summarizeDistractions(monthRecords);
  const topCategory = monthSummary.topCategory
    ? categoryByValue[monthSummary.topCategory.value]
    : null;
  const avoidanceTip = topCategory
    ? `${topCategory.label} is the main distraction this month. ${topCategory.avoidanceTip}`
    : 'No distractions logged yet. Use the HUD button when you get pulled away so patterns show up here.';

  return {
    today: summarizeDistractions(todayRecords),
    week: summarizeDistractions(weekRecords),
    month: monthSummary,
    recent: records.slice(0, 5),
    avoidanceTip,
  };
}
