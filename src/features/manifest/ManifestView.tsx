import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Pencil, Plus, Telescope, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input, Textarea } from '../../components/ui/input';
import { confirmDialog } from '../../components/ui/native-dialog';
import { announceLumi } from '../../character/companion-store';
import { showErrorToast, showToast } from '../toasts/toast-store';
import { getLocalDateKey } from '../../lib/date';
import { useManifestStore, type ManifestLogEntry, type Manifestation } from './manifest-store';

type LogKind = 'actions' | 'signs';

const IMAGE_MAX_EDGE = 1600;
// The universe speaks in a different voice: a serif italic, marked in gold.
const SERIF = { fontFamily: '"Cormorant Garamond", Georgia, serif' };
const GOLD = '#B8913A';
/** Feelings a sign can arrive with, and how Lumi answers each one. */
const SIGN_REPLIES: Record<string, string> = {
  Goosebumps: 'Goosebumps do not lie. Hold on to this one.',
  Calm: 'That calm is a quiet yes. Let yourself rest in it.',
  Hopeful: 'Let that hope stay a while. You have earned it.',
  Seen: 'You felt seen today. I am so glad you noticed.',
  Surprised: 'Out of nowhere, right? That is how it talks to you.',
};

/** Downscale to a JPEG data URL so a phone photo syncs as ~200 KB, not 5 MB. */
function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    img.src = url;
  });
}

function formatDate(date: string, withYear = true) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000);
}

function shortStatus(item: Manifestation) {
  if (item.status === 'manifested') return 'Manifested';
  if (item.status === 'released') return 'Let go';
  return `Day ${Math.max(1, daysBetween(item.startedOn, getLocalDateKey(new Date())) + 1)}`;
}

function timeframe(item: Manifestation) {
  const started = `Started ${formatDate(item.startedOn)}`;
  return item.targetDate ? `${started}, hoping by ${formatDate(item.targetDate)}` : started;
}

export function ManifestView() {
  const manifestations = useManifestStore((state) => state.manifestations);
  const hydrate = useManifestStore((state) => state.hydrate);
  const saveToStore = useManifestStore((state) => state.saveManifestation);
  const deleteFromStore = useManifestStore((state) => state.deleteManifestation);
  useEffect(() => { void hydrate(); }, [hydrate]);

  const [editing, setEditing] = useState<Manifestation | null | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Open intentions first, then the ones that arrived, then the ones let go.
  const ordered = useMemo(() => {
    const rank = { manifesting: 0, manifested: 1, released: 2 } as const;
    return [...manifestations].sort((a, b) => rank[a.status] - rank[b.status] || b.startedOn.localeCompare(a.startedOn));
  }, [manifestations]);
  const selected = manifestations.find((item) => item.id === selectedId) ?? ordered[0] ?? null;

  function saveManifestation(item: Manifestation) {
    void saveToStore(item);
    setSelectedId(item.id);
    setEditing(undefined);
  }

  function addLogEntry(item: Manifestation, kind: LogKind, entry: ManifestLogEntry) {
    void saveToStore({ ...item, [kind]: [...item[kind], entry] });
    const line = kind === 'signs'
      ? { text: SIGN_REPLIES[entry.feeling ?? ''] ?? 'You noticed. That is half the magic, and I kept it safe for you.', detail: entry.text }
      : { text: 'That step counts. You are meeting it halfway.', detail: entry.text };
    announceLumi(kind === 'signs' ? 'celebrate' : 'smile', line, () => showToast({ title: line.text, description: entry.text, tone: 'success' }));
  }

  function setStatus(item: Manifestation, status: Manifestation['status']) {
    void saveToStore({ ...item, status, manifestedOn: status === 'manifested' ? getLocalDateKey(new Date()) : null });
    if (status === 'manifested') {
      announceLumi('celebrate', { text: 'You manifested it! I knew you would.', detail: item.title }, () => showToast({ title: 'You manifested it!', description: item.title, tone: 'success' }));
    }
  }

  if (!ordered.length) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-start justify-center px-1">
        <Telescope className="h-7 w-7 text-text-muted" />
        <h2 className="mt-5 text-[2.6rem] leading-[1.05] text-text-primary" style={SERIF}>What do you want to call in?</h2>
        <p className="mt-3 max-w-md text-[15px] leading-7 text-text-secondary">Write it down, then keep a record of the steps you take and the signs that come back.</p>
        <Button className="mt-7" onClick={() => setEditing(null)} type="button"><Plus className="h-4 w-4" /> New manifestation</Button>
        {editing !== undefined ? <ManifestEditor manifestation={editing} onClose={() => setEditing(undefined)} onSave={saveManifestation} /> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1180px] flex-col gap-6 md:flex-row md:gap-10">
      <nav aria-label="Manifestations" className="flex shrink-0 gap-2 overflow-x-auto pb-1 md:sticky md:top-4 md:w-60 md:flex-col md:self-start md:overflow-visible md:pb-0">
        {ordered.map((item) => {
          const active = item.id === selected?.id;
          return (
            <button key={item.id} onClick={() => setSelectedId(item.id)} aria-current={active ? 'true' : undefined} className={`flex min-w-[180px] items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:min-w-0 ${active ? 'bg-panel2' : 'hover:bg-panel2/50'}`} type="button">
              {item.image
                ? <img src={item.image} alt="" className={`h-10 w-10 shrink-0 rounded-lg object-cover ${item.status === 'released' ? 'grayscale' : ''}`} />
                : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel2 text-text-muted"><Telescope className="h-4 w-4" /></span>}
              <span className="min-w-0">
                <span className={`block truncate text-sm ${active ? 'font-medium text-text-primary' : 'text-text-secondary'}`}>{item.title}</span>
                <span className="block text-xs text-text-muted">{shortStatus(item)}</span>
              </span>
            </button>
          );
        })}
        <button onClick={() => setEditing(null)} className="flex min-w-[140px] items-center gap-3 rounded-xl px-2.5 py-2 text-sm text-text-muted transition-colors hover:bg-panel2/50 hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:min-w-0" type="button">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-borderSoft"><Plus className="h-4 w-4" /></span>
          New
        </button>
      </nav>

      {selected ? (
        <article key={selected.id} className="min-w-0 flex-1 md:max-w-[720px]">
          <VisionImagePicker image={selected.image} onChange={(image) => void saveToStore({ ...selected, image })} />

          <header className="mt-7">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-text-primary [overflow-wrap:anywhere] sm:text-4xl">{selected.title}</h2>
              <div className="flex shrink-0 gap-1">
                <Button aria-label="Edit" className="h-9 w-9 p-0" onClick={() => setEditing(selected)} size="sm" type="button" variant="ghost"><Pencil className="h-4 w-4" /></Button>
                <Button aria-label="Delete" className="h-9 w-9 p-0" onClick={() => void confirmDialog(`Delete "${selected.title}" and everything logged for it?`, { title: 'Delete manifestation?', confirmLabel: 'Delete', danger: true }).then((ok) => { if (ok) { void deleteFromStore(selected.id); setSelectedId(null); } })} size="sm" type="button" variant="ghost"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            {selected.intention ? <p className="mt-3 text-2xl leading-snug text-text-secondary [overflow-wrap:anywhere]" style={{ ...SERIF, fontStyle: 'italic' }}>{selected.intention}</p> : null}
            <p className="mt-4 text-xs text-text-muted">{timeframe(selected)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {selected.status === 'manifesting' ? (
                <>
                  <Button onClick={() => setStatus(selected, 'manifested')} size="sm" type="button">It manifested</Button>
                  <Button onClick={() => setStatus(selected, 'released')} size="sm" type="button" variant="secondary">Let it go</Button>
                </>
              ) : (
                <Button onClick={() => setStatus(selected, 'manifesting')} size="sm" type="button" variant="secondary">Keep manifesting</Button>
              )}
            </div>
          </header>

          <Dialogue item={selected} onRemove={(kind, id) => void saveToStore({ ...selected, [kind]: selected[kind].filter((entry) => entry.id !== id) })} />
          {selected.status === 'manifesting' ? <Composer onAdd={(kind, entry) => addLogEntry(selected, kind, entry)} /> : null}
        </article>
      ) : null}

      {editing !== undefined ? <ManifestEditor manifestation={editing} onClose={() => setEditing(undefined)} onSave={saveManifestation} /> : null}
    </div>
  );
}

/**
 * The thread: your steps sit left of the line, the universe's signs answer on
 * the right in its own voice. On phones both hang off a single line.
 */
function Dialogue({ item, onRemove }: { item: Manifestation; onRemove: (kind: LogKind, id: string) => void }) {
  const days = useMemo(() => {
    const entries = [
      ...item.actions.map((entry) => ({ ...entry, kind: 'actions' as const })),
      ...item.signs.map((entry) => ({ ...entry, kind: 'signs' as const })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const grouped = new Map<string, typeof entries>();
    entries.forEach((entry) => grouped.set(entry.date, [...(grouped.get(entry.date) ?? []), entry]));
    return [...grouped.entries()];
  }, [item.actions, item.signs]);

  if (!days.length) {
    return <p className="mt-12 border-t border-borderSoft/40 pt-8 text-sm text-text-muted">Nothing logged yet. Add the first step you take, or the first sign you notice.</p>;
  }

  return (
    <ol className="relative mt-12 space-y-6 border-t border-borderSoft/40 pt-8">
      <span aria-hidden className="absolute bottom-0 left-[7px] top-8 w-px bg-borderSoft md:left-1/2" />
      {days.map(([date, entries]) => (
        <Fragment key={date}>
          <li className="relative grid grid-cols-[15px_1fr] gap-4 md:grid-cols-[1fr_15px_1fr]">
            <span aria-hidden className="col-start-1 mt-1.5 h-[7px] w-[7px] justify-self-center rounded-full bg-text-muted md:col-start-2" />
            <time className="col-start-2 text-xs text-text-muted md:col-start-3" dateTime={date}>{formatDate(date)}</time>
          </li>
          {entries.map((entry) => (
            <li key={entry.id} className="group relative grid grid-cols-[15px_1fr] gap-4 md:grid-cols-[1fr_15px_1fr]">
              {entry.kind === 'actions' ? (
                <>
                  <span aria-hidden className="col-start-1 row-start-1 mt-[7px] h-2.5 w-2.5 justify-self-center rounded-full bg-accent md:col-start-2" />
                  <p className="col-start-2 row-start-1 text-[15px] leading-6 text-text-primary [overflow-wrap:anywhere] md:col-start-1 md:text-right">{entry.text}</p>
                </>
              ) : (
                <>
                  <span aria-hidden className="col-start-1 row-start-1 mt-[8px] h-2.5 w-2.5 rotate-45 justify-self-center md:col-start-2" style={{ background: GOLD }} />
                  <div className="col-start-2 row-start-1 md:col-start-3"><p className="text-xl leading-6 text-text-primary [overflow-wrap:anywhere]" style={{ ...SERIF, fontStyle: 'italic' }}>{entry.text}</p>{entry.feeling ? <p className="mt-1 text-xs text-text-muted">felt {entry.feeling.toLowerCase()}</p> : null}</div>
                </>
              )}
              <button aria-label={`Remove "${entry.text}"`} onClick={() => onRemove(entry.kind, entry.id)} className={`absolute top-0 rounded-md p-1 text-text-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 ${entry.kind === 'actions' ? 'right-0 md:left-0 md:right-auto' : 'right-0'}`} type="button"><X className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </Fragment>
      ))}
    </ol>
  );
}

function Composer({ onAdd }: { onAdd: (kind: LogKind, entry: ManifestLogEntry) => void }) {
  const [kind, setKind] = useState<LogKind>('actions');
  const [text, setText] = useState('');
  const [date, setDate] = useState(() => getLocalDateKey(new Date()));
  const [feeling, setFeeling] = useState<string | null>(null);

  function add() {
    if (!text.trim() || !date) return;
    onAdd(kind, { id: crypto.randomUUID(), date, text: text.trim(), ...(kind === 'signs' && feeling ? { feeling } : {}) });
    setText('');
    setFeeling(null);
  }

  return (
    <div className="mt-10 rounded-2xl border border-borderSoft/60 bg-panel/60 p-3">
      <div role="radiogroup" aria-label="What are you logging?" className="flex gap-1">
        {([['actions', 'I took a step'], ['signs', 'I saw a sign']] as const).map(([value, label]) => (
          <button key={value} role="radio" aria-checked={kind === value} onClick={() => setKind(value)} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${kind === value ? 'bg-panel2 text-text-primary' : 'text-text-muted hover:text-text-primary'}`} type="button">
            {value === 'actions' ? <span aria-hidden className="h-2 w-2 rounded-full bg-accent" /> : <span aria-hidden className="h-2 w-2 rotate-45" style={{ background: GOLD }} />}
            {label}
          </button>
        ))}
      </div>
      {kind === 'signs' ? <p className="mt-3 px-1 text-lg leading-snug text-text-secondary" style={{ ...SERIF, fontStyle: 'italic' }}>Did the universe answer you? Tell me what you noticed.</p> : null}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input aria-label={kind === 'actions' ? 'The step you took' : 'The sign you noticed'} className="min-w-0 flex-1 text-base sm:text-sm" style={kind === 'signs' ? { ...SERIF, fontStyle: 'italic', fontSize: '1.15rem' } : undefined} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add(); }} placeholder={kind === 'actions' ? 'Booked a Japanese class' : 'A friend mentioned Kyoto out of nowhere'} />
        <Input aria-label="Date" className="text-base sm:w-40 sm:text-sm" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Button onClick={add} disabled={!text.trim() || !date} type="button">{kind === 'signs' ? 'Keep it' : 'Add'}</Button>
      </div>
      {kind === 'signs' ? (
        <div role="radiogroup" aria-label="How did it feel?" className="mt-3 flex flex-wrap items-center gap-1.5 px-1">
          <span className="mr-1 text-xs text-text-muted">How did it feel?</span>
          {Object.keys(SIGN_REPLIES).map((value) => (
            <button key={value} role="radio" aria-checked={feeling === value} onClick={() => setFeeling(feeling === value ? null : value)} className={`rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${feeling === value ? 'border-transparent text-text-primary' : 'border-borderSoft/60 text-text-muted hover:text-text-primary'}`} style={feeling === value ? { background: `${GOLD}33` } : undefined} type="button">{value}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VisionImagePicker({ image, onChange }: { image: string | null | undefined; onChange: (image: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function choose(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { showErrorToast('Not an image', 'Pick a photo or screenshot.'); return; }
    downscaleImage(file).then(onChange).catch((error: unknown) => showErrorToast('Image upload failed', error instanceof Error ? error.message : undefined));
  }

  return (
    <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files[0]); }} className={`group/vision relative overflow-hidden rounded-2xl ${dragging ? 'ring-2 ring-accent' : ''}`}>
      {image ? (
        <>
          <img src={image} alt="" className="aspect-[21/9] w-full object-cover" />
          <div className="absolute right-3 top-3 flex gap-2 transition-opacity md:opacity-0 md:focus-within:opacity-100 md:group-hover/vision:opacity-100">
            <Button onClick={() => inputRef.current?.click()} size="sm" type="button" variant="secondary">Change image</Button>
            <Button aria-label="Remove image" className="w-9 p-0" onClick={() => onChange(null)} size="sm" type="button" variant="secondary"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </>
      ) : (
        <button onClick={() => inputRef.current?.click()} className="flex h-28 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-borderSoft text-sm text-text-muted transition-colors hover:border-borderStrong hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" type="button">
          <ImagePlus className="h-4 w-4" /> Add an image you can picture yourself in
        </button>
      )}
      <input ref={inputRef} className="sr-only" type="file" accept="image/*" onChange={(event) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
    </div>
  );
}

function ManifestEditor({ manifestation, onClose, onSave }: { manifestation: Manifestation | null; onClose: () => void; onSave: (item: Manifestation) => void }) {
  const [title, setTitle] = useState(manifestation?.title ?? '');
  const [intention, setIntention] = useState(manifestation?.intention ?? '');
  const [startedOn, setStartedOn] = useState(manifestation?.startedOn ?? getLocalDateKey(new Date()));
  const [targetDate, setTargetDate] = useState(manifestation?.targetDate ?? '');
  const [image, setImage] = useState(manifestation?.image ?? null);
  const valid = title.trim() && startedOn;
  return createPortal(<div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-5" onClick={onClose}><div className="max-h-[92dvh] w-full min-w-0 max-w-xl overflow-y-auto rounded-t-[28px] border border-borderSoft/40 bg-panel p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[28px] sm:p-6" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-text-primary">{manifestation ? 'Edit manifestation' : 'New manifestation'}</h2><Button aria-label="Close" className="h-10 w-10 shrink-0 rounded-full p-0" onClick={onClose} size="sm" variant="ghost"><X className="h-4 w-4" /></Button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><VisionImagePicker image={image} onChange={setImage} /></div><label className="min-w-0 space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-text-secondary">What you want</span><Input className="min-w-0 max-w-full text-base sm:text-sm" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A trip to Japan" /></label><label className="min-w-0 space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-text-secondary">Say it as if it is already true</span><Textarea className="min-h-24 text-lg" style={{ ...SERIF, fontStyle: 'italic' }} value={intention} onChange={(event) => setIntention(event.target.value)} placeholder="I am walking through Kyoto in spring." /></label><label className="min-w-0 space-y-1.5"><span className="text-xs font-medium text-text-secondary">Started</span><Input className="min-w-0 max-w-full text-base sm:text-sm" value={startedOn} onChange={(event) => setStartedOn(event.target.value)} type="date" /></label><label className="min-w-0 space-y-1.5"><span className="text-xs font-medium text-text-secondary">Hoping by (optional)</span><Input className="min-w-0 max-w-full text-base sm:text-sm" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} type="date" /></label></div><div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end"><Button onClick={onClose} variant="secondary">Cancel</Button><Button disabled={!valid} onClick={() => onSave({ id: manifestation?.id ?? crypto.randomUUID(), title: title.trim(), intention: intention.trim(), startedOn, targetDate: targetDate || null, status: manifestation?.status ?? 'manifesting', manifestedOn: manifestation?.manifestedOn ?? null, image, actions: manifestation?.actions ?? [], signs: manifestation?.signs ?? [] })}>{manifestation ? 'Save changes' : 'Create'}</Button></div></div></div>, document.body);
}
