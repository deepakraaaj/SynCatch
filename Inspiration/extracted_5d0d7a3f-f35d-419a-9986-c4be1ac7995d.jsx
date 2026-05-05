// Main App — header, stats, view switcher, controls

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "view": "grid",
  "density": "comfy",
  "showFlow": true,
  "accent": "blue",
  "dark": false
}/*EDITMODE-END*/;

function StatTile({ label, value, suffix, hint, accent, big }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      padding: '14px 16px',
      borderRight: '0.5px solid var(--line)',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
        letterSpacing: '.12em', textTransform: 'uppercase',
        color: 'var(--muted)',
      }}>{label}</div>
      <div style={{
        fontSize: big ? 26 : 22, fontWeight: 500,
        color: accent ? accentInk(accent) : 'var(--ink)',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
        lineHeight: 1.1,
      }}>
        {value}
        {suffix && <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 2 }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>{hint}</div>
    </div>
  );
}

function ViewSwitcher({ view, setView }) {
  const opts = [
    { k: 'grid',     label: 'Grid' },
    { k: 'vertical', label: 'Vertical' },
    { k: 'kanban',   label: 'Kanban' },
    { k: 'gantt',    label: 'Gantt' },
  ];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      padding: 3, background: 'var(--surface)',
      border: '0.5px solid var(--line)', borderRadius: 999,
    }}>
      {opts.map(o => {
        const active = o.k === view;
        return (
          <button key={o.k} onClick={() => setView(o.k)} style={{
            appearance: 'none', border: 0,
            background: active ? 'var(--card)' : 'transparent',
            color: active ? 'var(--ink)' : 'var(--muted)',
            padding: '6px 14px', borderRadius: 999,
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: active ? 600 : 500,
            cursor: 'default',
            boxShadow: active ? '0 1px 2px rgba(0,0,0,.06), 0 0 0 0.5px rgba(0,0,0,.06)' : 'none',
            transition: 'all .15s',
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function FilterBar({ search, setSearch, sort, setSort }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--card)', border: '0.5px solid var(--line)',
        borderRadius: 999, padding: '6px 14px',
        minWidth: 240,
      }}>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>⌕</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search missions, tasks, owners…"
          style={{
            border: 0, outline: 0, background: 'transparent',
            font: 'inherit', fontSize: 12.5, color: 'var(--ink)',
            flex: 1, minWidth: 0,
          }}
        />
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
          color: 'var(--muted)', letterSpacing: '.05em',
          padding: '2px 5px', border: '0.5px solid var(--line)', borderRadius: 4,
        }}>⌘K</span>
      </div>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'var(--card)', border: '0.5px solid var(--line)',
        borderRadius: 999, padding: '4px 6px 4px 12px',
      }}>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
          letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'var(--muted)',
        }}>Sort</span>
        {['progress', 'load', 'due'].map(k => {
          const active = sort === k;
          return (
            <button key={k} onClick={() => setSort(k)} style={{
              appearance: 'none', border: 0,
              background: active ? 'var(--ink)' : 'transparent',
              color: active ? 'var(--bg)' : 'var(--muted)',
              padding: '4px 10px', borderRadius: 999,
              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500,
              cursor: 'default', textTransform: 'capitalize',
            }}>{k}</button>
          );
        })}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState('progress');

  // Filter + sort missions
  const missions = React.useMemo(() => {
    let m = MISSIONS;
    const q = search.trim().toLowerCase();
    if (q) {
      m = m.map(mi => ({
        ...mi,
        tasks: mi.tasks.filter(tk =>
          tk.title.toLowerCase().includes(q) ||
          tk.owner.toLowerCase().includes(q) ||
          mi.name.toLowerCase().includes(q)
        ),
      })).filter(mi => mi.tasks.length > 0 || mi.name.toLowerCase().includes(q));
    }
    const sorted = [...m];
    if (sort === 'progress') sorted.sort((a, b) => missionStats(b).pct - missionStats(a).pct);
    if (sort === 'load')     sorted.sort((a, b) => missionStats(b).plannedMin - missionStats(a).plannedMin);
    if (sort === 'due')      sorted.sort((a, b) => (a.target || 'zzz').localeCompare(b.target || 'zzz'));
    return sorted;
  }, [search, sort]);

  // Top-level stats across ALL missions (not filtered)
  const all = MISSIONS;
  const totalActive   = all.filter(m => m.tasks.some(tk => tk.state === 'now')).length;
  const totalTasks    = all.reduce((s, m) => s + m.tasks.length, 0);
  const totalDone     = all.reduce((s, m) => s + m.tasks.filter(tk => tk.state === 'done').length, 0);
  const totalPct      = Math.round(totalDone / totalTasks * 100);
  const plannedMin    = all.reduce((s, m) => s + missionStats(m).plannedMin, 0);
  const plannedTasks  = all.reduce((s, m) => s + m.tasks.filter(tk => tk.state !== 'done').length, 0);
  const scheduled     = all.filter(m => m.target).length;
  const totalOverdue  = all.reduce((s, m) => s + m.tasks.filter(tk => tk.overdue).length, 0);

  const dense = t.density === 'compact';

  // Apply theme on root
  React.useEffect(() => {
    const r = document.documentElement;
    if (t.dark) {
      r.style.setProperty('--bg',     'oklch(0.18 0.01 80)');
      r.style.setProperty('--card',   'oklch(0.22 0.008 80)');
      r.style.setProperty('--surface','oklch(0.20 0.008 80)');
      r.style.setProperty('--ink',    'oklch(0.94 0.005 80)');
      r.style.setProperty('--muted',  'oklch(0.62 0.01 80)');
      r.style.setProperty('--line',   'oklch(0.30 0.005 80)');
    } else {
      r.style.setProperty('--bg',     'oklch(0.985 0.005 80)');
      r.style.setProperty('--card',   '#fff');
      r.style.setProperty('--surface','oklch(0.975 0.005 80)');
      r.style.setProperty('--ink',    'oklch(0.22 0.01 80)');
      r.style.setProperty('--muted',  'oklch(0.55 0.01 80)');
      r.style.setProperty('--line',   'oklch(0.92 0.005 80)');
    }
  }, [t.dark]);

  let viewEl;
  if (t.view === 'grid')          viewEl = <GridView missions={missions} dense={dense} showFlow={t.showFlow} />;
  else if (t.view === 'vertical') viewEl = <VerticalView missions={missions} dense={dense} showFlow={t.showFlow} />;
  else if (t.view === 'kanban')   viewEl = <KanbanView missions={missions} dense={dense} />;
  else if (t.view === 'gantt')    viewEl = <GanttView missions={missions} dense={dense} />;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{
        maxWidth: 1320, margin: '0 auto',
        padding: '40px 36px 80px',
      }}>
        {/* HEADER */}
        <header style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 24, marginBottom: 28,
        }}>
          <div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
              letterSpacing: '.18em', textTransform: 'uppercase',
              color: 'var(--muted)',
            }}>Mission Planning · Q2</div>
            <h1 style={{
              margin: '6px 0 6px', fontSize: 38, fontWeight: 600,
              letterSpacing: '-0.025em', color: 'var(--ink)',
            }}>Roadmap</h1>
            <p style={{
              margin: 0, fontSize: 14.5, color: 'var(--muted)',
              maxWidth: 540, textWrap: 'pretty',
            }}>Track mission progress, remaining load, and what's actually moving next.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <FilterBar search={search} setSearch={setSearch} sort={sort} setSort={setSort} />
          </div>
        </header>

        {/* STATS STRIP */}
        <div style={{
          background: 'var(--card)', border: '0.5px solid var(--line)',
          borderRadius: 14, marginBottom: 14,
          display: 'flex', alignItems: 'stretch',
          overflow: 'hidden',
        }}>
          <StatTile label="Active" value={totalActive} hint="missions in play" big />
          <StatTile label="Completion" value={totalPct} suffix="%" hint={`${totalDone} of ${totalTasks} tasks done`} accent="blue" big />
          <StatTile label="Planned load" value={fmtLoad(plannedMin)} hint={`${plannedTasks} tasks planned`} accent="amber" big />
          <StatTile label="Scheduled" value={scheduled} hint={`${all.length - scheduled} missions without target`} big />
          <StatTile label="Overdue"
            value={totalOverdue}
            hint={totalOverdue ? 'needs attention' : 'all on track'}
            accent={totalOverdue ? undefined : null} big />
          <div style={{
            display: 'flex', alignItems: 'center', padding: '14px 16px',
            gap: 12,
          }}>
            <ViewSwitcher view={t.view} setView={(v) => setTweak('view', v)} />
          </div>
        </div>

        {/* RESULT META */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 4px 14px', fontSize: 12, color: 'var(--muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.08em',
              textTransform: 'uppercase', fontSize: 10.5,
            }}>Showing</span>
            <span>{missions.length} mission{missions.length === 1 ? '' : 's'}</span>
            {search && <span>· filtered by <span style={{ color: 'var(--ink)' }}>"{search}"</span></span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.08em',
              textTransform: 'uppercase', fontSize: 10.5,
            }}>Updated · Just now</span>
          </div>
        </div>

        {/* MAIN VIEW */}
        {missions.length === 0 ? (
          <div style={{
            border: '0.5px dashed var(--line)', borderRadius: 14,
            padding: '60px 20px', textAlign: 'center', color: 'var(--muted)',
            fontSize: 13.5, background: 'var(--card)',
          }}>
            No missions match "{search}".
          </div>
        ) : viewEl}

        {/* TWEAKS */}
        <TweaksPanel>
          <TweakSection label="View" />
          <TweakSelect
            label="Layout"
            value={t.view}
            options={[
              { value: 'grid',     label: 'Grid' },
              { value: 'vertical', label: 'Vertical' },
              { value: 'kanban',   label: 'Kanban' },
              { value: 'gantt',    label: 'Gantt' },
            ]}
            onChange={v => setTweak('view', v)}
          />
          <TweakRadio
            label="Density"
            value={t.density}
            options={['compact', 'comfy']}
            onChange={v => setTweak('density', v)}
          />
          <TweakToggle
            label="Show flow strip"
            value={t.showFlow}
            onChange={v => setTweak('showFlow', v)}
          />
          <TweakSection label="Theme" />
          <TweakToggle
            label="Dark mode"
            value={t.dark}
            onChange={v => setTweak('dark', v)}
          />
          <TweakRadio
            label="Highlight accent"
            value={t.accent}
            options={['blue', 'amber', 'violet', 'teal', 'rose']}
            onChange={v => setTweak('accent', v)}
          />
        </TweaksPanel>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
