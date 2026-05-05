// Four views: Grid, Vertical, Kanban, Gantt

// ── shared task row ──────────────────────────────────────────────────────────
function TaskRow({ task, accent, dense, showDate = true }) {
  const overdue = task.overdue;
  const stateColor = {
    now:   accentVar(accent),
    next:  'oklch(0.55 0.01 80)',
    queue: 'oklch(0.7 0.005 80)',
    done:  'oklch(0.6 0.08 150)',
  }[task.state];
  const strike = task.state === 'done';
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '14px 1fr auto auto auto',
      alignItems: 'center', gap: 12,
      padding: dense ? '6px 0' : '9px 0',
      borderBottom: '0.5px dashed oklch(0.92 0.005 80)',
      fontSize: 13,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {task.state === 'done'
          ? <span style={{
              width: 12, height: 12, borderRadius: 999,
              background: stateColor, color: 'white',
              fontSize: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>✓</span>
          : <span style={{
              width: 11, height: 11, borderRadius: 999,
              border: `1.25px solid ${stateColor}`,
              background: task.state === 'now' ? stateColor : 'transparent',
              boxShadow: task.state === 'now' ? `0 0 0 3px ${accentTint(accent)}` : 'none',
            }} />}
      </span>
      <span style={{
        color: strike ? 'oklch(0.55 0.01 80)' : 'oklch(0.22 0.01 80)',
        textDecoration: strike ? 'line-through' : 'none',
        textDecorationColor: 'oklch(0.7 0.005 80)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{task.title}</span>
      <Avatar initials={task.owner} size={20} accent={accent} />
      <span style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        color: 'oklch(0.5 0.01 80)', fontVariantNumeric: 'tabular-nums',
        minWidth: 50, textAlign: 'right',
      }}>{task.load}</span>
      {showDate && (
        <span style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
          color: overdue ? 'oklch(0.5 0.15 25)' : 'oklch(0.55 0.01 80)',
          background: overdue ? 'oklch(0.96 0.02 25)' : 'transparent',
          padding: overdue ? '2px 6px' : 0,
          borderRadius: 999, letterSpacing: '.04em',
          minWidth: 60, textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}>{overdue ? '⚠ ' : ''}{task.due}</span>
      )}
    </div>
  );
}

function AddTaskRow({ accent }) {
  return (
    <button style={{
      appearance: 'none', border: 0, background: 'transparent',
      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      padding: '8px 0', cursor: 'default',
      color: 'oklch(0.55 0.01 80)', fontSize: 12.5,
      fontFamily: 'inherit', textAlign: 'left',
      transition: 'color .2s',
    }}
    onMouseEnter={e => e.currentTarget.style.color = accentInk(accent)}
    onMouseLeave={e => e.currentTarget.style.color = 'oklch(0.55 0.01 80)'}>
      <span style={{
        width: 14, height: 14, borderRadius: 999,
        border: '1px dashed oklch(0.75 0.005 80)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, lineHeight: 1, color: 'inherit',
      }}>+</span>
      <span>Add task</span>
    </button>
  );
}

// ── GRID VIEW ────────────────────────────────────────────────────────────────
function GridView({ missions, dense, showFlow }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
      gap: 16,
    }}>
      {missions.map(m => {
        const s = missionStats(m);
        const visibleTasks = m.tasks.slice(0, dense ? 3 : 4);
        return (
          <article key={m.id} style={{
            background: 'var(--card)',
            border: '0.5px solid var(--line)',
            borderRadius: 14, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '14px 16px 12px',
              borderBottom: '0.5px solid var(--line)',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <MissionGlyph accent={m.accent} icon={m.icon} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                  letterSpacing: '.1em', color: accentInk(m.accent),
                  textTransform: 'uppercase',
                }}>{m.code}</div>
                <div style={{
                  fontSize: 15.5, fontWeight: 600,
                  color: 'var(--ink)', letterSpacing: '-0.01em',
                  marginTop: 1,
                }}>{m.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{m.summary}</div>
              </div>
              <Sparkline data={m.sparkline} accent={m.accent} w={64} h={20} />
            </div>

            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                    letterSpacing: '.1em', textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}>Progress</div>
                  <div style={{
                    fontSize: 22, fontWeight: 500, color: accentInk(m.accent),
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                    marginTop: 2,
                  }}>{s.pct}<span style={{ fontSize: 14, color: 'var(--muted)' }}>%</span></div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                    letterSpacing: '.1em', textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}>Active load</div>
                  <div style={{
                    fontSize: 22, fontWeight: 500, color: 'var(--ink)',
                    fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                    marginTop: 2,
                  }}>{fmtLoad(s.activeMin) || '—'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                    letterSpacing: '.1em', textTransform: 'uppercase',
                    color: 'var(--muted)',
                  }}>Target</div>
                  <div style={{
                    fontSize: 14.5, fontWeight: 500, color: 'var(--ink)',
                    fontVariantNumeric: 'tabular-nums',
                    marginTop: 6,
                  }}>{m.target || '—'}</div>
                </div>
              </div>
              <ProgressBar pct={s.pct} accent={m.accent} />
              {showFlow && <FlowStrip counts={s.counts} accent={m.accent} compact />}
            </div>

            <div style={{ padding: '4px 16px 12px', borderTop: '0.5px solid var(--line)' }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                letterSpacing: '.1em', textTransform: 'uppercase',
                color: 'var(--muted)', padding: '10px 0 4px',
              }}>Tasks · {s.total}</div>
              {visibleTasks.map(t => <TaskRow key={t.id} task={t} accent={m.accent} dense={dense} />)}
              {m.tasks.length > visibleTasks.length && (
                <div style={{
                  fontSize: 11.5, color: 'var(--muted)',
                  padding: '10px 0 0', textAlign: 'center',
                }}>+ {m.tasks.length - visibleTasks.length} more</div>
              )}
              <AddTaskRow accent={m.accent} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ── VERTICAL TIMELINE ────────────────────────────────────────────────────────
function VerticalView({ missions, dense, showFlow }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {missions.map((m, idx) => {
        const s = missionStats(m);
        return (
          <article key={m.id} style={{
            background: 'var(--card)',
            border: '0.5px solid var(--line)',
            borderRadius: 14,
            display: 'grid',
            gridTemplateColumns: '180px 1fr',
            overflow: 'hidden',
          }}>
            <aside style={{
              padding: '20px 18px',
              borderRight: '0.5px solid var(--line)',
              background: accentTint(m.accent),
              display: 'flex', flexDirection: 'column', gap: 12,
              position: 'relative',
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                letterSpacing: '.12em', color: accentInk(m.accent),
                textTransform: 'uppercase',
              }}>{m.code} · 0{idx + 1}</div>
              <MissionGlyph accent={m.accent} icon={m.icon} size={42} />
              <div>
                <div style={{
                  fontSize: 17, fontWeight: 600, color: 'var(--ink)',
                  letterSpacing: '-0.01em',
                }}>{m.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{m.summary}</div>
              </div>
              <div style={{ marginTop: 'auto' }}>
                <div style={{
                  fontSize: 26, fontWeight: 500, color: accentInk(m.accent),
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                }}>{s.pct}%</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: -2 }}>{s.done} of {s.total} done</div>
              </div>
            </aside>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <ProgressBar pct={s.pct} accent={m.accent} h={6} />
                </div>
                <Chip mono>{fmtLoad(s.plannedMin)} planned</Chip>
                {m.target && <Chip mono tone="accent" accent={m.accent}>{m.target}</Chip>}
                {s.overdue > 0 && <Chip tone="overdue">{s.overdue} overdue</Chip>}
                <AvatarStack owners={m.tasks.map(t => t.owner)} accent={m.accent} size={22} />
              </div>
              {showFlow && <FlowStrip counts={s.counts} accent={m.accent} compact />}
              <div>
                {m.tasks.map(t => <TaskRow key={t.id} task={t} accent={m.accent} dense={dense} />)}
                <AddTaskRow accent={m.accent} />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ── KANBAN ───────────────────────────────────────────────────────────────────
function KanbanView({ missions, dense }) {
  const cols = STATES.map(state => ({
    state,
    tasks: missions.flatMap(m => m.tasks.filter(t => t.state === state).map(t => ({ ...t, missionId: m.id, accent: m.accent, missionName: m.name, missionCode: m.code }))),
  }));

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 14,
      alignItems: 'start',
    }}>
      {cols.map(col => (
        <div key={col.state} style={{
          background: 'var(--card)',
          border: '0.5px solid var(--line)',
          borderRadius: 12,
          padding: '12px 12px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
          minHeight: 400,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingBottom: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StateDot state={col.state} size={7} />
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                letterSpacing: '.12em', textTransform: 'uppercase',
                color: 'var(--ink)', fontWeight: 600,
              }}>{STATE_LABEL[col.state]}</span>
            </div>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
              color: 'var(--muted)', fontVariantNumeric: 'tabular-nums',
            }}>{col.tasks.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {col.tasks.map(t => (
              <div key={t.missionId + t.id} style={{
                background: 'var(--surface)',
                border: '0.5px solid var(--line)',
                borderLeft: `2px solid ${accentVar(t.accent)}`,
                borderRadius: 8,
                padding: dense ? '9px 11px' : '11px 13px',
                display: 'flex', flexDirection: 'column', gap: 7,
              }}>
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                  letterSpacing: '.1em', color: accentInk(t.accent),
                  textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{t.missionCode}</span>
                  <span style={{ color: 'var(--muted)' }}>{t.load}</span>
                </div>
                <div style={{
                  fontSize: 13, color: 'var(--ink)', lineHeight: 1.35,
                  textWrap: 'pretty',
                }}>{t.title}</div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 1,
                }}>
                  <Avatar initials={t.owner} size={18} accent={t.accent} />
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
                    color: t.overdue ? 'oklch(0.5 0.15 25)' : 'var(--muted)',
                    background: t.overdue ? 'oklch(0.96 0.02 25)' : 'transparent',
                    padding: t.overdue ? '1px 5px' : 0,
                    borderRadius: 999,
                  }}>{t.overdue ? '⚠ ' : ''}{t.due}</span>
                </div>
              </div>
            ))}
            {col.tasks.length === 0 && (
              <div style={{
                fontSize: 11.5, color: 'var(--muted)',
                fontStyle: 'italic', padding: '20px 4px', textAlign: 'center',
                border: '0.5px dashed var(--line)', borderRadius: 8,
              }}>Nothing here</div>
            )}
            <button style={{
              appearance: 'none', background: 'transparent',
              border: '0.5px dashed oklch(0.85 0.005 80)', borderRadius: 8,
              padding: '8px', color: 'var(--muted)', fontSize: 11.5,
              fontFamily: 'inherit', cursor: 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── GANTT ────────────────────────────────────────────────────────────────────
function GanttView({ missions, dense }) {
  // Build day grid Apr 14 → Jun 18 (~66 days). We'll render weeks.
  const startDate = new Date(2026, 3, 13); // Apr 13
  const endDate   = new Date(2026, 5, 21); // Jun 21
  const days = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

  const monthMap = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function parseDue(str) {
    // "May 06"
    const [mon, d] = str.split(' ');
    const month = monthMap.indexOf(mon);
    return new Date(2026, month, parseInt(d));
  }
  function dayIndex(date) { return Math.round((date - startDate) / (1000 * 60 * 60 * 24)); }

  // weeks for header
  const weeks = [];
  for (let d = 0; d < days; d += 7) {
    const date = new Date(startDate); date.setDate(date.getDate() + d);
    weeks.push({ idx: d, label: `${monthMap[date.getMonth()]} ${date.getDate()}` });
  }

  // months
  const months = [];
  let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cur < endDate) {
    const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const startD = Math.max(0, dayIndex(cur));
    const endD = Math.min(days, dayIndex(next));
    months.push({ label: monthMap[cur.getMonth()], startD, endD });
    cur = next;
  }

  const today = new Date(2026, 4, 5);  // May 5
  const todayD = dayIndex(today);

  const colWidth = 18; // px per day
  const totalWidth = days * colWidth;
  const labelWidth = 220;

  return (
    <div style={{
      background: 'var(--card)',
      border: '0.5px solid var(--line)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: labelWidth + totalWidth }}>
          {/* months header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${labelWidth}px ${totalWidth}px`,
            borderBottom: '0.5px solid var(--line)',
            background: 'var(--surface)',
          }}>
            <div />
            <div style={{ position: 'relative', height: 28 }}>
              {months.map((mo, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: mo.startD * colWidth,
                  width: (mo.endD - mo.startD) * colWidth,
                  top: 0, bottom: 0,
                  borderLeft: i ? '0.5px solid var(--line)' : 'none',
                  display: 'flex', alignItems: 'center',
                  paddingLeft: 8,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                  letterSpacing: '.12em', textTransform: 'uppercase',
                  color: 'var(--ink)', fontWeight: 600,
                }}>{mo.label}</div>
              ))}
            </div>
          </div>

          {/* weeks header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${labelWidth}px ${totalWidth}px`,
            borderBottom: '0.5px solid var(--line)',
          }}>
            <div style={{
              padding: '8px 14px',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
              letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--muted)',
            }}>Mission</div>
            <div style={{ position: 'relative', height: 28 }}>
              {weeks.map((w, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: w.idx * colWidth,
                  height: '100%',
                  borderLeft: '0.5px solid var(--line)',
                  paddingLeft: 5,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                  color: 'var(--muted)',
                  display: 'flex', alignItems: 'center',
                }}>{w.label}</div>
              ))}
            </div>
          </div>

          {/* mission rows */}
          {missions.map(m => {
            const s = missionStats(m);
            return (
              <div key={m.id} style={{
                display: 'grid',
                gridTemplateColumns: `${labelWidth}px ${totalWidth}px`,
                borderBottom: '0.5px solid var(--line)',
              }}>
                <div style={{
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  borderRight: '0.5px solid var(--line)',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: accentVar(m.accent),
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                      letterSpacing: '.1em', color: accentInk(m.accent),
                      textTransform: 'uppercase',
                    }}>{m.code}</div>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{m.name}</div>
                  </div>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5,
                    color: accentInk(m.accent),
                  }}>{s.pct}%</span>
                </div>
                <div style={{ position: 'relative', height: dense ? 38 + m.tasks.length * 14 : 28 + m.tasks.length * 18 }}>
                  {/* week gridlines */}
                  {weeks.map((w, i) => (
                    <div key={i} style={{
                      position: 'absolute', left: w.idx * colWidth,
                      top: 0, bottom: 0, width: 1,
                      background: 'oklch(0.96 0.005 80)',
                    }} />
                  ))}
                  {/* today line */}
                  <div style={{
                    position: 'absolute', left: todayD * colWidth - 0.5,
                    top: 0, bottom: 0, width: 1.5,
                    background: 'oklch(0.5 0.15 25)', opacity: .7,
                  }} />

                  {/* tasks */}
                  {m.tasks.map((t, i) => {
                    const due = parseDue(t.due);
                    const dueD = dayIndex(due);
                    // Estimate duration from load (~2h per day cadence)
                    const durDays = Math.max(2, Math.round(parseLoad(t.load) / 60 * 0.7));
                    const startD = Math.max(0, dueD - durDays);
                    const left = startD * colWidth;
                    const width = (dueD - startD) * colWidth;
                    const y = (dense ? 8 : 12) + i * (dense ? 14 : 18);
                    const isDone = t.state === 'done';
                    const isNow = t.state === 'now';
                    return (
                      <div key={t.id} title={t.title} style={{
                        position: 'absolute',
                        left, top: y, width, height: dense ? 11 : 14,
                        background: isDone ? accentTint(m.accent) : isNow ? accentVar(m.accent) : 'transparent',
                        border: `1px solid ${accentVar(m.accent)}`,
                        borderStyle: t.state === 'queue' ? 'dashed' : 'solid',
                        borderRadius: 4,
                        display: 'flex', alignItems: 'center', paddingLeft: 6,
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5,
                        color: isNow ? 'white' : accentInk(m.accent),
                        whiteSpace: 'nowrap', overflow: 'hidden',
                      }}>
                        {width > 80 ? t.title : ''}
                        {t.overdue && (
                          <span style={{
                            position: 'absolute', right: -8, top: '50%',
                            transform: 'translateY(-50%)',
                            width: 10, height: 10, borderRadius: 999,
                            background: 'oklch(0.6 0.18 25)',
                            border: '1.5px solid var(--card)',
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* legend */}
          <div style={{
            display: 'flex', gap: 16, padding: '10px 16px',
            borderTop: '0.5px solid var(--line)',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
            letterSpacing: '.06em', color: 'var(--muted)',
            background: 'var(--surface)',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 8, background: 'oklch(0.62 0.13 245)', borderRadius: 2 }} />
              NOW
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 8, border: '1px solid oklch(0.62 0.13 245)', borderRadius: 2 }} />
              NEXT
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 8, border: '1px dashed oklch(0.62 0.13 245)', borderRadius: 2 }} />
              QUEUE
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 18, height: 8, background: 'oklch(0.92 0.04 245)', borderRadius: 2 }} />
              DONE
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 1.5, height: 12, background: 'oklch(0.5 0.15 25)' }} />
              TODAY · MAY 05
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TaskRow, AddTaskRow, GridView, VerticalView, KanbanView, GanttView });
