// Shared atoms

function Avatar({ initials, size = 22, accent }) {
  const bg = accent ? accentTint(accent) : 'oklch(0.94 0.005 80)';
  const fg = accent ? accentInk(accent)  : 'oklch(0.35 0.01 80)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: 999,
      background: bg, color: fg,
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: size * 0.42, fontWeight: 600, letterSpacing: '.02em',
      flex: '0 0 auto',
      border: '0.5px solid rgba(0,0,0,.05)',
    }}>{initials}</span>
  );
}

function AvatarStack({ owners, accent, size = 20 }) {
  const seen = []; owners.forEach(o => { if (!seen.includes(o)) seen.push(o); });
  return (
    <span style={{ display: 'inline-flex', paddingLeft: 6 }}>
      {seen.slice(0, 4).map((o, i) => (
        <span key={o} style={{ marginLeft: -6, position: 'relative', zIndex: 10 - i }}>
          <Avatar initials={o} size={size} accent={accent} />
        </span>
      ))}
      {seen.length > 4 && (
        <span style={{
          marginLeft: -6, width: size, height: size, borderRadius: 999,
          background: 'oklch(0.94 0.005 80)', color: 'oklch(0.4 0.01 80)',
          fontFamily: 'JetBrains Mono, monospace', fontSize: size * 0.4,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: '0.5px solid rgba(0,0,0,.05)',
        }}>+{seen.length - 4}</span>
      )}
    </span>
  );
}

function Sparkline({ data, accent, w = 84, h = 22 }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const stepX = w / (data.length - 1);
  const pts = data.map((v, i) => [i * stepX, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = d + ` L${w},${h} L0,${h} Z`;
  const stroke = accentVar(accent);
  const fill = accentTint(accent);
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <path d={area} fill={fill} opacity={0.7} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2} fill={stroke} />
    </svg>
  );
}

function StateDot({ state, size = 6 }) {
  const map = {
    now:   'oklch(0.62 0.13 245)',
    next:  'oklch(0.7 0.1 70)',
    queue: 'oklch(0.78 0.01 80)',
    done:  'oklch(0.6 0.1 150)',
  };
  return <span style={{
    display: 'inline-block', width: size, height: size, borderRadius: 999,
    background: map[state], flex: '0 0 auto',
  }} />;
}

function Chip({ children, tone = 'neutral', accent, mono = true, sm = false }) {
  let bg, fg, bd;
  if (tone === 'accent' && accent) {
    bg = accentTint(accent); fg = accentInk(accent); bd = `0.5px solid ${accentVar(accent, 0.85, 0.04)}`;
  } else if (tone === 'overdue') {
    bg = 'oklch(0.96 0.02 25)'; fg = 'oklch(0.5 0.15 25)'; bd = '0.5px solid oklch(0.88 0.05 25)';
  } else {
    bg = 'oklch(0.97 0.003 80)'; fg = 'oklch(0.45 0.01 80)'; bd = '0.5px solid oklch(0.9 0.005 80)';
  }
  return <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: sm ? '1px 6px' : '2px 7px',
    borderRadius: 999, background: bg, color: fg, border: bd,
    fontFamily: mono ? 'JetBrains Mono, ui-monospace, monospace' : 'inherit',
    fontSize: sm ? 9.5 : 10.5, fontWeight: 500, letterSpacing: '.04em',
    textTransform: mono ? 'uppercase' : 'none',
    whiteSpace: 'nowrap',
  }}>{children}</span>;
}

function ProgressBar({ pct, accent, h = 4 }) {
  return (
    <div style={{
      height: h, background: 'oklch(0.94 0.005 80)', borderRadius: 999, overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: accentVar(accent), borderRadius: 999, transition: 'width .4s ease',
      }} />
    </div>
  );
}

function FlowStrip({ counts, accent, compact = false }) {
  const total = STATES.reduce((s, k) => s + counts[k], 0) || 1;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      gap: compact ? 4 : 6,
    }}>
      {STATES.map(s => {
        const isActive = s === 'now';
        return (
          <div key={s} style={{
            padding: compact ? '7px 9px' : '10px 12px',
            background: isActive ? accentTint(accent) : 'oklch(0.985 0.003 80)',
            border: `0.5px solid ${isActive ? accentVar(accent, 0.88, 0.04) : 'oklch(0.93 0.005 80)'}`,
            borderRadius: 8,
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
              letterSpacing: '.08em', textTransform: 'uppercase',
              color: isActive ? accentInk(accent) : 'oklch(0.55 0.01 80)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>{STATE_LABEL[s]}</span>
              <span style={{ opacity: .55 }}>{Math.round(counts[s] / total * 100)}%</span>
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: compact ? 16 : 19,
              fontWeight: 500, color: isActive ? accentInk(accent) : 'oklch(0.25 0.01 80)',
              fontVariantNumeric: 'tabular-nums',
            }}>{String(counts[s]).padStart(2, '0')}</div>
          </div>
        );
      })}
    </div>
  );
}

function MissionGlyph({ accent, icon = '◐', size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: accentTint(accent),
      border: `0.5px solid ${accentVar(accent, 0.88, 0.04)}`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: accentInk(accent),
      fontSize: size * 0.5, lineHeight: 1, flex: '0 0 auto',
    }}>{icon}</div>
  );
}

function MissionHeader({ mission, stats, dense, children }) {
  const owners = mission.tasks.map(t => t.owner);
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: dense ? '14px 16px' : '18px 20px',
    }}>
      <MissionGlyph accent={mission.accent} icon={mission.icon} size={dense ? 32 : 38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
            letterSpacing: '.1em', color: accentInk(mission.accent),
            textTransform: 'uppercase',
          }}>{mission.code}</span>
          <h3 style={{
            margin: 0, fontSize: dense ? 16 : 18, fontWeight: 600,
            letterSpacing: '-0.01em', color: 'oklch(0.22 0.01 80)',
          }}>{mission.name}</h3>
          <span style={{
            color: 'oklch(0.55 0.01 80)', fontSize: 13,
          }}>{mission.summary}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Chip mono>{stats.total} tasks</Chip>
          {mission.target
            ? <Chip mono tone="accent" accent={mission.accent}>Target {mission.target}</Chip>
            : <Chip mono>No target</Chip>}
          {stats.overdue > 0 && <Chip tone="overdue">{stats.overdue} overdue</Chip>}
          <span style={{ flex: 1 }} />
          <AvatarStack owners={owners} accent={mission.accent} />
          <Sparkline data={mission.sparkline} accent={mission.accent} />
        </div>
      </div>
      {children}
    </div>
  );
}

Object.assign(window, {
  Avatar, AvatarStack, Sparkline, StateDot, Chip, ProgressBar,
  FlowStrip, MissionGlyph, MissionHeader,
});
