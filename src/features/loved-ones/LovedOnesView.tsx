import { useEffect, useMemo, useState } from 'react';
import { Cake, Edit2, Gift, Heart, Mail, MessageCircle, Plus, Trash2, UserRound, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, Textarea } from '../../components/ui/input';
import { confirmDialog } from '../../components/ui/native-dialog';
import { useLovedOnesStore, type LovedOne } from './loved-ones-store';

function splitLines(value: string) { return value.split('\n').map((item) => item.trim()).filter(Boolean); }

function ageOnBirthday(birthday: string) {
  const birth = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function nextBirthday(birthday: string) {
  const birth = new Date(`${birthday}T00:00:00`);
  const now = new Date();
  const next = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  next.setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (next < today) next.setFullYear(next.getFullYear() + 1);
  return { date: next, days: Math.round((next.getTime() - today.getTime()) / 86400000) };
}

function birthdayLabel(person: LovedOne) {
  const next = nextBirthday(person.birthday);
  if (next.days === 0) return 'Birthday today';
  if (next.days === 1) return 'Tomorrow';
  return `${next.days} days away`;
}

export function LovedOnesView() {
  const people = useLovedOnesStore((state) => state.people);
  const hydrate = useLovedOnesStore((state) => state.hydrate);
  const savePersonToStore = useLovedOnesStore((state) => state.savePerson);
  const deletePersonFromStore = useLovedOnesStore((state) => state.deletePerson);
  useEffect(() => { void hydrate(); }, [hydrate]);

  const [editing, setEditing] = useState<LovedOne | null | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [observation, setObservation] = useState('');

  const ordered = useMemo(() => [...people].sort((a, b) => nextBirthday(a.birthday).days - nextBirthday(b.birthday).days), [people]);
  const selected = people.find((person) => person.id === selectedId) ?? null;

  function savePerson(person: LovedOne) {
    void savePersonToStore(person);
    setEditing(undefined);
  }
  function addObservation() {
    if (!selected || !observation.trim()) return;
    const updated = { ...selected, observations: [{ id: crypto.randomUUID(), text: observation.trim(), createdAt: new Date().toISOString() }, ...selected.observations] };
    void savePersonToStore(updated);
    setObservation('');
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1480px] space-y-4 sm:space-y-5">
      <Card className="relative overflow-hidden rounded-[26px] border-borderSoft/40 bg-panel/88 p-4 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-rose-500/20 bg-rose-500/10 text-rose-500"><Heart className="h-5 w-5 fill-current" /></span>
            <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-500">People who matter</p><h2 className="mt-1 text-xl font-semibold text-text-primary">Loved Ones</h2><p className="mt-1 text-sm text-text-secondary">Remember the details that make someone feel known.</p></div>
          </div>
          <Button className="w-full shrink-0 sm:w-auto" onClick={() => setEditing(null)} type="button"><Plus className="h-4 w-4" /> Add someone</Button>
        </div>
      </Card>

      {ordered.length ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
          {ordered.map((person) => {
            const age = ageOnBirthday(person.birthday);
            const next = nextBirthday(person.birthday);
            return (
              <Card key={person.id} className="group flex min-w-0 min-h-[280px] flex-col rounded-[24px] border-borderSoft/40 bg-panel/86 p-4 sm:p-5 transition hover:-translate-y-0.5 hover:border-rose-500/30 hover:shadow-[0_14px_34px_rgb(var(--shadow-color)/0.12)]">
                <div className="flex items-start gap-3">
                  <button onClick={() => setSelectedId(person.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-rose-500/10 text-rose-500" type="button"><UserRound className="h-5 w-5" /></button>
                  <button onClick={() => setSelectedId(person.id)} className="min-w-0 flex-1 text-left" type="button"><h3 className="truncate text-base font-semibold text-text-primary">{person.name}</h3><p className="mt-0.5 text-xs text-text-secondary [overflow-wrap:anywhere]">{person.relationship}</p></button>
                  <button aria-label={`Edit ${person.name}`} onClick={() => setEditing(person)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg p-2 text-text-muted opacity-60 hover:bg-panel2 hover:text-text-primary group-hover:opacity-100" type="button"><Edit2 className="h-3.5 w-3.5" /></button>
                </div>

                <button onClick={() => setSelectedId(person.id)} className="mt-4 flex items-center gap-3 rounded-[15px] border border-rose-500/15 bg-rose-500/6 p-3 text-left" type="button">
                  <Cake className="h-4 w-4 shrink-0 text-rose-500" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-text-primary">{new Date(`${person.birthday}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</span><span className="mt-0.5 block text-[10px] text-text-secondary">{birthdayLabel(person)} · age {age ?? '—'}</span></span><span className="text-lg font-semibold text-rose-500">{next.days}</span>
                </button>

                <div className="mt-4 flex-1"><p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-text-muted"><Heart className="h-3 w-3" /> Things they love</p><div className="mt-2 flex flex-wrap gap-1.5">{person.loves.slice(0, 5).map((love) => <span key={love} className="max-w-full [overflow-wrap:anywhere] rounded-full border border-borderSoft/35 bg-panel2/55 px-2.5 py-1 text-[11px] text-text-secondary">{love}</span>)}{!person.loves.length ? <span className="text-xs text-text-muted">Notice something and add it.</span> : null}</div></div>
                <button onClick={() => setSelectedId(person.id)} className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-borderSoft/20 pt-3 text-xs font-medium text-text-secondary hover:text-rose-500" type="button"><span>{person.giftIdeas.length} thoughtful ideas · {person.observations.length} notes</span><span>Open →</span></button>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-[26px] border-dashed px-4 py-8 text-center sm:p-12"><Heart className="mx-auto h-9 w-9 text-rose-500/60" /><h3 className="mt-4 text-lg font-semibold text-text-primary">Remember someone beautifully</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">Save a birthday, the little things they love, and thoughtful ideas that do not need to cost much.</p><Button className="mt-5 w-full sm:w-auto" onClick={() => setEditing(null)} type="button"><Plus className="h-4 w-4" /> Add your first person</Button></Card>
      )}

      {editing !== undefined ? <PersonEditor person={editing} onClose={() => setEditing(undefined)} onSave={savePerson} /> : null}
      {selected ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-end bg-black/45 backdrop-blur-[2px]" onClick={() => setSelectedId(null)}>
          <aside className="flex h-[92dvh] w-full min-w-0 max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-borderSoft/40 bg-panel shadow-2xl sm:h-[100dvh] sm:rounded-none" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3 shrink-0 border-b border-borderSoft/25 p-4 sm:p-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-rose-500/10 text-rose-500"><Heart className="h-5 w-5 fill-current" /></span><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-text-primary [overflow-wrap:anywhere]">{selected.name}</h2><p className="text-xs text-text-secondary [overflow-wrap:anywhere]">{selected.relationship} · age {ageOnBirthday(selected.birthday)}</p></div><Button className="h-11 w-11 shrink-0 rounded-full p-0" onClick={() => setSelectedId(null)} size="sm" variant="ghost"><X className="h-4 w-4" /></Button></div>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <section><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted"><Heart className="h-3.5 w-3.5 text-rose-500" /> Things they love</p><div className="mt-3 flex flex-wrap gap-2">{selected.loves.map((item) => <span key={item} className="max-w-full [overflow-wrap:anywhere] rounded-full border border-rose-500/18 bg-rose-500/8 px-3 py-1.5 text-xs text-text-primary">{item}</span>)}</div></section>
              <section><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted"><Gift className="h-3.5 w-3.5 text-amber-500" /> Thoughtful ideas</p><div className="mt-3 space-y-2">{selected.giftIdeas.map((idea) => <div key={idea} className="flex gap-3 rounded-[14px] border border-borderSoft/25 bg-panel2/40 p-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><p className="min-w-0 text-sm text-text-primary [overflow-wrap:anywhere]">{idea}</p></div>)}</div></section>
              <section><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted"><MessageCircle className="h-3.5 w-3.5 text-violet-500" /> Things I noticed</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input className="min-w-0 text-base sm:text-sm" value={observation} onChange={(event) => setObservation(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addObservation(); }} placeholder="They smiled when…" /><Button onClick={addObservation} disabled={!observation.trim()} type="button">Add</Button></div><div className="mt-3 space-y-2">{selected.observations.map((note) => <div key={note.id} className="rounded-[14px] border border-borderSoft/25 bg-panel2/35 p-3"><p className="text-sm leading-6 text-text-primary [overflow-wrap:anywhere]">{note.text}</p><p className="mt-1 text-[10px] text-text-muted">{new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p></div>)}</div></section>
            </div>
            <div className="flex shrink-0 gap-2 border-t border-borderSoft/25 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><Button className="flex-1" onClick={() => { setEditing(selected); setSelectedId(null); }} variant="secondary"><Edit2 className="h-4 w-4" /> Edit</Button><Button onClick={() => void confirmDialog(`Remove ${selected.name}?`, { title: 'Remove loved one?', confirmLabel: 'Remove', danger: true }).then((ok) => { if (ok) { void deletePersonFromStore(selected.id); setSelectedId(null); } })} variant="ghost"><Trash2 className="h-4 w-4 text-danger" /></Button></div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function PersonEditor({ person, onClose, onSave }: { person: LovedOne | null; onClose: () => void; onSave: (person: LovedOne) => void }) {
  const [name, setName] = useState(person?.name ?? '');
  const [relationship, setRelationship] = useState(person?.relationship ?? '');
  const [birthday, setBirthday] = useState(person?.birthday ?? '');
  const [loves, setLoves] = useState(person?.loves.join('\n') ?? '');
  const [ideas, setIdeas] = useState(person?.giftIdeas.join('\n') ?? '');
  const valid = name.trim() && relationship.trim() && birthday;
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-5" onClick={onClose}><div className="max-h-[92dvh] w-full min-w-0 max-w-xl overflow-y-auto rounded-t-[28px] border border-borderSoft/40 bg-panel p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[28px] sm:p-6" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-500">Loved Ones</p><h2 className="mt-1 text-lg font-semibold text-text-primary">{person ? 'Edit person' : 'Add someone'}</h2></div><Button className="h-11 w-11 shrink-0 rounded-full p-0" onClick={onClose} size="sm" variant="ghost"><X className="h-4 w-4" /></Button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="min-w-0 space-y-1.5"><span className="text-xs font-medium text-text-secondary">Name</span><Input className="min-w-0 max-w-full text-base sm:text-sm" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Their name" /></label><label className="min-w-0 space-y-1.5"><span className="text-xs font-medium text-text-secondary">Relationship</span><Input className="min-w-0 max-w-full text-base sm:text-sm" value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Friend, mother, partner…" /></label><label className="min-w-0 space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-text-secondary">Birthday</span><Input className="min-w-0 max-w-full text-base sm:text-sm" value={birthday} onChange={(event) => setBirthday(event.target.value)} type="date" /></label><label className="min-w-0 space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-text-secondary">Things they love</span><Textarea className="min-h-28 text-base sm:text-sm" value={loves} onChange={(event) => setLoves(event.target.value)} placeholder={'One per line\nStrong coffee\nHandwritten notes\nQuiet walks'} /></label><label className="min-w-0 space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-text-secondary">Thoughtful gift or letter ideas</span><Textarea className="min-h-28 text-base sm:text-sm" value={ideas} onChange={(event) => setIdeas(event.target.value)} placeholder={'One per line\nWrite about our favorite memory\nMake their comfort meal\nA playlist for their commute'} /></label></div><div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end"><Button onClick={onClose} variant="secondary">Cancel</Button><Button disabled={!valid} onClick={() => onSave({ id: person?.id ?? crypto.randomUUID(), name: name.trim(), relationship: relationship.trim(), birthday, loves: splitLines(loves), giftIdeas: splitLines(ideas), observations: person?.observations ?? [] })}>Save person</Button></div></div></div>;
}
