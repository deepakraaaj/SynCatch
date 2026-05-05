// Mission roadmap fixture data

const MISSIONS = [
  {
    id: 'mc',
    code: 'M-01',
    name: 'Mission Control',
    summary: 'Track tasks, ship the planning surface',
    accent: 'blue',     // oklch hue family
    icon: '◐',
    target: null,
    sparkline: [1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 6],
    tasks: [
      { id: 't1', title: 'Wire Roadmap shell + view switcher', owner: 'AS', state: 'done',  load: '40m', due: 'Apr 28' },
      { id: 't2', title: 'Mission card layout system',          owner: 'PR', state: 'now',  load: '1h 20m', due: 'May 06' },
      { id: 't3', title: 'Flow strip — Now/Next/Queue/Done',    owner: 'AS', state: 'now',  load: '1h',    due: 'May 06' },
      { id: 't4', title: 'Gantt timeline rendering',            owner: 'KV', state: 'next', load: '2h',    due: 'May 09' },
      { id: 't5', title: 'Empty + overdue states',              owner: 'PR', state: 'queue',load: '45m',   due: 'May 12' },
    ],
  },
  {
    id: 'lg',
    code: 'M-02',
    name: 'Logistics Graph',
    summary: 'Real-time consignment & milestone graph',
    accent: 'amber',
    icon: '◇',
    target: 'May 22',
    sparkline: [2, 3, 2, 4, 5, 4, 6, 7, 6, 8, 9, 9],
    tasks: [
      { id: 'l1', title: 'Schema: shipment → leg → milestone',  owner: 'KV', state: 'done',  load: '2h',    due: 'Apr 21' },
      { id: 'l2', title: 'GraphQL resolver — live milestones',  owner: 'IM', state: 'done',  load: '3h 15m',due: 'Apr 25' },
      { id: 'l3', title: 'Map clustering @ scale',              owner: 'KV', state: 'now',   load: '4h',    due: 'May 04', overdue: true },
      { id: 'l4', title: 'Geofence breach alerting',            owner: 'IM', state: 'next',  load: '2h 30m',due: 'May 08' },
      { id: 'l5', title: 'Carrier API: Maersk + MSC',           owner: 'AS', state: 'next',  load: '3h',    due: 'May 11' },
      { id: 'l6', title: 'Replay mode for ops review',          owner: 'KV', state: 'queue', load: '2h',    due: 'May 18' },
      { id: 'l7', title: 'Performance budgets + SLO board',     owner: 'PR', state: 'queue', load: '1h 30m',due: 'May 20' },
    ],
  },
  {
    id: 'cp',
    code: 'M-03',
    name: 'Compliance Pulse',
    summary: 'Customs + audit trail across regions',
    accent: 'violet',
    icon: '◈',
    target: 'Jun 04',
    sparkline: [0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    tasks: [
      { id: 'c1', title: 'IN customs schema mapping',           owner: 'NK', state: 'done',  load: '2h',    due: 'Apr 18' },
      { id: 'c2', title: 'Audit log immutable store',           owner: 'IM', state: 'now',   load: '3h',    due: 'May 07' },
      { id: 'c3', title: 'Doc OCR — Bill of Lading',            owner: 'NK', state: 'next',  load: '4h 30m',due: 'May 14' },
      { id: 'c4', title: 'EU GDPR retention policies',          owner: 'PR', state: 'queue', load: '1h 30m',due: 'May 28' },
      { id: 'c5', title: 'Quarterly export pack',               owner: 'NK', state: 'queue', load: '2h',    due: 'Jun 02' },
    ],
  },
  {
    id: 'fl',
    code: 'M-04',
    name: 'Fleet Insights',
    summary: 'Driver behaviour, route health, fuel',
    accent: 'teal',
    icon: '◉',
    target: 'May 30',
    sparkline: [3, 3, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9],
    tasks: [
      { id: 'f1', title: 'Telematics ingestion v2',             owner: 'KV', state: 'done',  load: '5h',    due: 'Apr 14' },
      { id: 'f2', title: 'Harsh-braking events ML',             owner: 'AS', state: 'done',  load: '4h',    due: 'Apr 26' },
      { id: 'f3', title: 'Fuel anomaly detector',               owner: 'AS', state: 'now',   load: '2h 30m',due: 'May 06' },
      { id: 'f4', title: 'Driver leaderboard UI',               owner: 'PR', state: 'next',  load: '3h',    due: 'May 13' },
      { id: 'f5', title: 'Route health score',                  owner: 'KV', state: 'queue', load: '2h',    due: 'May 24' },
    ],
  },
  {
    id: 'cx',
    code: 'M-05',
    name: 'Customer Console',
    summary: 'Self-serve dashboard for shippers',
    accent: 'rose',
    icon: '◆',
    target: 'Jun 18',
    sparkline: [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4],
    tasks: [
      { id: 'x1', title: 'IA + nav restructure',                owner: 'PR', state: 'done',  load: '1h 45m',due: 'Apr 30' },
      { id: 'x2', title: 'Saved views & filters',               owner: 'PR', state: 'now',   load: '2h',    due: 'May 09' },
      { id: 'x3', title: 'Bulk export — CSV / XLSX',            owner: 'IM', state: 'next',  load: '1h 30m',due: 'May 16' },
      { id: 'x4', title: 'Notification preferences',            owner: 'NK', state: 'queue', load: '1h',    due: 'May 26' },
      { id: 'x5', title: 'Onboarding tour',                     owner: 'AS', state: 'queue', load: '2h',    due: 'Jun 12' },
    ],
  },
];

// Accent palette — same chroma + lightness, varied hue
const ACCENTS = {
  blue:   { hue: 245, label: 'Blue' },
  amber:  { hue: 70,  label: 'Amber' },
  violet: { hue: 300, label: 'Violet' },
  teal:   { hue: 180, label: 'Teal' },
  rose:   { hue: 15,  label: 'Rose' },
};

const accentVar = (key, l = 0.62, c = 0.13) => `oklch(${l} ${c} ${ACCENTS[key].hue})`;
const accentTint = (key) => `oklch(0.965 0.025 ${ACCENTS[key].hue})`;
const accentInk  = (key) => `oklch(0.45 0.10 ${ACCENTS[key].hue})`;

const STATES = ['now', 'next', 'queue', 'done'];
const STATE_LABEL = { now: 'Now', next: 'Next', queue: 'Queue', done: 'Done' };

// helpers
function parseLoad(str) {
  // "2h 20m" → minutes
  let m = 0;
  const h = str.match(/(\d+)h/); if (h) m += parseInt(h[1]) * 60;
  const mm = str.match(/(\d+)m/); if (mm) m += parseInt(mm[1]);
  return m;
}
function fmtLoad(min) {
  const h = Math.floor(min / 60); const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function missionStats(m) {
  const done = m.tasks.filter(t => t.state === 'done').length;
  const total = m.tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const counts = STATES.reduce((a, s) => (a[s] = m.tasks.filter(t => t.state === s).length, a), {});
  const activeMin = m.tasks.filter(t => t.state === 'now').reduce((s, t) => s + parseLoad(t.load), 0);
  const nextMin   = m.tasks.filter(t => t.state === 'next').reduce((s, t) => s + parseLoad(t.load), 0);
  const plannedMin= m.tasks.filter(t => t.state !== 'done').reduce((s, t) => s + parseLoad(t.load), 0);
  const overdue   = m.tasks.filter(t => t.overdue).length;
  return { done, total, pct, counts, activeMin, nextMin, plannedMin, overdue };
}

window.MISSIONS = MISSIONS;
window.ACCENTS = ACCENTS;
window.accentVar = accentVar;
window.accentTint = accentTint;
window.accentInk = accentInk;
window.STATES = STATES;
window.STATE_LABEL = STATE_LABEL;
window.parseLoad = parseLoad;
window.fmtLoad = fmtLoad;
window.missionStats = missionStats;
