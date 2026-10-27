import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive, BadgeCheck, Bike, CalendarClock, Camera, CarFront, Check, ChevronRight,
  CircleDollarSign, FileText, Fuel, Gamepad2, Gauge, Headphones, IdCard,
  Laptop, PackageCheck, Pencil, Plus, Refrigerator, ScanText, Search,
  ShieldCheck, Smartphone, Tag, Trash2, Upload, Watch, Wrench, X,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, Textarea } from '../../components/ui/input';
import { confirmDialog } from '../../components/ui/native-dialog';
import { cn } from '../../lib/cn';
import { OfflineOcrScanner, type OcrSuggestions } from './OfflineOcrScanner';

type ItemKind = 'product' | 'motor';
type Product = {
  id: string; kind: ItemKind; name: string; brand: string; model: string;
  serialNumber: string; category: string; purchaseDate: string; price: number;
  retailer: string; paymentMethod: string; warrantyEnds: string;
  warrantyProvider: string; policyNumber: string; returnEnds: string;
  nextService: string; subscriptionRenews: string; status: string;
  condition: string; location: string; notes: string; tags: string;
  invoiceName: string; invoiceType: string; createdAt: string;
  registrationNumber: string; chassisNumber: string; engineNumber: string;
  vehicleType: string; fuelType: string; odometer: number; modelYear: string;
  insuranceProvider: string; insurancePolicy: string; insuranceEnds: string;
  pucEnds: string; registrationEnds: string; nextServiceKm: number;
  tyreChangedAtKm: number; loanProvider: string; loanEnds: string;
};

const STORAGE_KEY = 'missioncontrol-products-v1';
const productCategories = ['Phone', 'Computer', 'Appliance', 'Audio', 'Camera', 'Gaming', 'Wearable', 'Furniture', 'Other'];
const motorCategories = ['Car', 'Motorcycle', 'Scooter', 'Bicycle', 'Commercial vehicle', 'Other motor'];
const empty: Omit<Product, 'id' | 'createdAt'> = {
  kind: 'product', name: '', brand: '', model: '', serialNumber: '', category: 'Phone',
  purchaseDate: '', price: 0, retailer: '', paymentMethod: '', warrantyEnds: '',
  warrantyProvider: '', policyNumber: '', returnEnds: '', nextService: '',
  subscriptionRenews: '', status: 'Active', condition: 'New', location: '',
  notes: '', tags: '', invoiceName: '', invoiceType: '', registrationNumber: '',
  chassisNumber: '', engineNumber: '', vehicleType: 'Car', fuelType: 'Petrol',
  odometer: 0, modelYear: '', insuranceProvider: '', insurancePolicy: '',
  insuranceEnds: '', pucEnds: '', registrationEnds: '', nextServiceKm: 0,
  tyreChangedAtKm: 0, loanProvider: '', loanEnds: '',
};

const day = 86_400_000;
const daysTo = (value: string) => value ? Math.ceil((new Date(`${value}T23:59:59`).getTime() - Date.now()) / day) : 99_999;
const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
/** The dates worth surfacing for an item, labelled by what happens on them. */
const deadlinesOf = (item: Product) => (item.kind === 'motor'
  ? [['insurance ends', item.insuranceEnds], ['PUC ends', item.pucEnds], ['registration ends', item.registrationEnds], ['service', item.nextService], ['warranty ends', item.warrantyEnds]]
  : [['warranty ends', item.warrantyEnds], ['return window ends', item.returnEnds], ['service', item.nextService], ['subscription renews', item.subscriptionRenews]]
).filter(([, date]) => date).map(([what, date]) => ({ what, date }));
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const inDays = (days: number) => days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
const formatDate = (value: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`)) : '—';
const readProducts = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Partial<Product>[];
    return Array.isArray(parsed) ? parsed.map((item) => ({ ...empty, ...item, kind: item.kind ?? (motorCategories.includes(item.category ?? '') ? 'motor' : 'product') })) as Product[] : [];
  } catch { return []; }
};

function openFiles() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('missioncontrol-product-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('invoices');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function fileAction(id: string, action: 'get' | 'delete', file?: File) {
  const db = await openFiles();
  const result = await new Promise<File | undefined>((resolve, reject) => {
    const store = db.transaction('invoices', action === 'get' ? 'readonly' : 'readwrite').objectStore('invoices');
    const request = action === 'get' ? store.get(id) : file ? store.put(file, id) : store.delete(id);
    request.onsuccess = () => resolve(request.result as File | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export function ProductsView() {
  const [items, setItems] = useState<Product[]>(readProducts);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'all' | ItemKind>('all');
  const [editor, setEditor] = useState<{ item?: Product; kind: ItemKind }>();
  const [selected, setSelected] = useState<Product>();
  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(items)), [items]);

  const shown = useMemo(() => items.filter((item) =>
    (scope === 'all' || item.kind === scope) &&
    `${item.name} ${item.brand} ${item.model} ${item.serialNumber} ${item.registrationNumber} ${item.tags}`.toLowerCase().includes(query.toLowerCase())), [items, query, scope]);
  const motors = items.filter((item) => item.kind === 'motor');
  const total = items.reduce((sum, item) => sum + item.price, 0);
  // Every upcoming date across the vault, soonest first: what the stat cards are about.
  const upcoming = items.flatMap((item) => deadlinesOf(item).map((deadline) => ({ item, ...deadline, days: daysTo(deadline.date) })))
    .filter((entry) => entry.days >= 0).sort((a, b) => a.days - b.days);
  const next = upcoming[0];
  const attention = [
    ...upcoming.filter((entry) => entry.days <= 60),
    ...items.filter((item) => item.nextServiceKm > 0 && item.odometer >= item.nextServiceKm).map((item) => ({ item, what: 'service by km', days: 0 })),
  ];

  async function remove(item: Product) {
    const ok = await confirmDialog(`Delete “${item.name}” and its stored documents?`, { title: 'Delete record', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await fileAction(item.id, 'delete').catch(() => undefined);
    setItems((current) => current.filter((value) => value.id !== item.id));
    setSelected(undefined);
  }

  return <div className="space-y-5">
    <section
      className="relative flex min-h-[220px] items-center overflow-hidden rounded-[30px] border border-borderSoft/35 bg-panel2/60 p-6 shadow-panel sm:min-h-[240px] sm:p-8"
      style={{ backgroundImage: 'radial-gradient(circle at 78% 30%, rgb(var(--accent) / 0.16), transparent 55%)' }}
    >
      <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(var(--text-primary) / 0.10) 1px, transparent 0)', backgroundSize: '22px 22px' }} />
      <IconCloud />
      <div className="relative z-10 max-w-[620px]">
        <h2 className="text-3xl font-semibold tracking-[-.04em] text-text-primary sm:text-4xl">Your stuff has a story.<br/><span className="font-normal text-accent">Keep every chapter handy.</span></h2>
        <div className="mt-6 flex flex-wrap gap-2"><Button onClick={() => setEditor({ kind: 'product' })}><Plus className="h-4 w-4"/>Add product</Button><Button variant="secondary" onClick={() => setEditor({ kind: 'motor' })}><CarFront className="h-4 w-4"/>Add motor</Button></div>
      </div>
    </section>

    {items.length ? <section className="grid gap-3 md:grid-cols-3">
      <Metric icon={CalendarClock} label="Next up" value={next ? inDays(next.days) : 'All clear'} note={next ? `${next.item.name} · ${next.what}` : 'No upcoming dates'} tone="amber" />
      <Metric icon={ShieldCheck} label="Needs attention" value={attention.length ? `${attention.length} due` : 'Nothing due'} note={attention.length ? attention.slice(0, 2).map((entry) => `${entry.item.name} ${entry.what}`).join(', ') : 'Nothing in the next 60 days'} tone="rose" />
      <Metric icon={PackageCheck} label="Your vault" value={money(total)} note={`${plural(items.length - motors.length, 'product')} · ${plural(motors.length, 'motor')}`} tone="cyan" />
    </section> : null}

    <section className="flex flex-col gap-3 rounded-[22px] border border-borderSoft/30 bg-panel/55 p-3 lg:flex-row lg:items-center">
      <label className="flex min-w-0 flex-1 items-center rounded-xl bg-panel2/65 px-3"><Search className="h-4 w-4 text-text-muted"/><input className="w-full bg-transparent px-2.5 py-2.5 text-sm text-text-primary outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, registration, serial, VIN or tags"/></label>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-panel2/65 p-1">{([['all','Everything'],['product','Products'],['motor','Motors']] as const).map(([value,label]) => <button key={value} onClick={() => setScope(value)} className={cn('rounded-lg px-4 py-2 text-xs font-semibold transition', scope === value ? 'bg-panel text-text-primary shadow-sm' : 'text-text-muted hover:text-text-secondary')}>{label}</button>)}</div>
    </section>

    {shown.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shown.map((item) => <ItemCard item={item} key={item.id} onClick={() => setSelected(item)} />)}</div> : <Card className="relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-[30px] border-dashed p-8 text-center"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(16,185,129,.13),transparent_55%)]"/><div className="relative grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/12 text-emerald-500"><Archive className="h-8 w-8"/></div><h3 className="relative mt-4 text-xl font-semibold text-text-primary">{items.length ? 'Nothing matches that search' : 'Start your ownership vault'}</h3><p className="relative mt-2 max-w-md text-sm leading-6 text-text-secondary">{items.length ? 'Search another model, registration or serial number.' : 'Add a product or motor. Important dates will surface automatically.'}</p>{!items.length ? <div className="relative mt-5 flex gap-2"><Button onClick={() => setEditor({ kind: 'product' })}>Add product</Button><Button variant="secondary" onClick={() => setEditor({ kind: 'motor' })}>Add motor</Button></div> : null}</Card>}

    {editor ? <Editor initial={editor.item} kind={editor.kind} onClose={() => setEditor(undefined)} onSave={async (item, file) => { if (file) await saveFile(item.id, file); setItems((current) => current.some((value) => value.id === item.id) ? current.map((value) => value.id === item.id ? item : value) : [item, ...current]); setEditor(undefined); setSelected(item); }} /> : null}
    {selected ? <Details item={selected} onClose={() => setSelected(undefined)} onEdit={() => { setEditor({ item: selected, kind: selected.kind }); setSelected(undefined); }} onDelete={() => void remove(selected)} /> : null}
  </div>;
}

function IconCloud() {
  const icons = [
    { Icon: Smartphone, pos: 'right-[31%] top-8', color: 'bg-violet-500', tilt: '-rotate-6' },
    { Icon: Camera, pos: 'right-[24%] top-6', color: 'bg-rose-500', tilt: 'rotate-6' },
    { Icon: CarFront, pos: 'right-[7%] top-7', color: 'bg-orange-500', tilt: 'rotate-3' },
    { Icon: Laptop, pos: 'right-[29%] bottom-7', color: 'bg-cyan-500', tilt: 'rotate-6' },
    { Icon: Bike, pos: 'right-[12%] bottom-8', color: 'bg-emerald-500', tilt: '-rotate-6' },
    { Icon: Headphones, pos: 'right-[2%] bottom-[14%]', color: 'bg-fuchsia-500', tilt: 'rotate-6' },
    { Icon: Gamepad2, pos: 'right-[41%] bottom-10', color: 'bg-indigo-500', tilt: '-rotate-3' },
    { Icon: Watch, pos: 'right-[43%] top-12', color: 'bg-amber-500', tilt: 'rotate-6' },
    { Icon: Refrigerator, pos: 'right-[19%] bottom-[38%]', color: 'bg-sky-500', tilt: '-rotate-3' },
    { Icon: Wrench, pos: 'right-[4%] top-[43%]', color: 'bg-teal-500', tilt: '-rotate-6' },
  ];
  return <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
    <div className="absolute -right-12 -top-20 h-80 w-[54%] rotate-[-5deg] rounded-[80px] bg-text-primary/[0.04] blur-[1px]" />
    {icons.map(({ Icon, pos, color, tilt }, index) => <div key={index} className={cn('absolute grid h-12 w-12 place-items-center rounded-2xl border border-white/25 text-white shadow-[0_12px_30px_rgb(var(--shadow-color)/0.25)]', pos, color, tilt)}><Icon className="h-5 w-5"/><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-lime-300"/></div>)}
    <div className="absolute right-[7%] top-[40%] h-28 w-28 rounded-full border border-orange-300/50" />
    <div className="absolute right-[25%] bottom-3 h-16 w-16 rounded-full border border-cyan-300/60" />
  </div>;
}

function Metric({ icon: Icon, label, value, note, tone }: { icon: typeof Archive; label: string; value: string; note: string; tone: string }) {
  const colors: Record<string,string> = { cyan: 'from-cyan-500 to-blue-600', violet: 'from-violet-500 to-fuchsia-600', amber: 'from-amber-400 to-orange-600', rose: 'from-rose-500 to-pink-600' };
  return <Card className="relative overflow-hidden rounded-[22px] border-borderSoft/30 bg-panel/70 p-5"><div className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r', colors[tone])}/><div className="flex items-center justify-between"><span className="text-xs text-text-secondary">{label}</span><span className={cn('grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br text-white shadow-lg', colors[tone])}><Icon className="h-4 w-4"/></span></div><p className="mt-4 truncate text-2xl font-semibold tracking-tight text-text-primary">{value}</p><p className="mt-1 text-[11px] text-text-muted">{note}</p></Card>;
}

function ItemCard({ item, onClick }: { item: Product; onClick: () => void }) {
  const isMotor = item.kind === 'motor';
  const urgent = isMotor ? Math.min(daysTo(item.insuranceEnds), daysTo(item.pucEnds), daysTo(item.nextService)) : daysTo(item.warrantyEnds);
  return <button onClick={onClick} className="group relative overflow-hidden rounded-[24px] border border-borderSoft/30 bg-panel/72 p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-emerald-500/25 hover:shadow-[0_18px_40px_rgba(0,0,0,.12)]"><div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', isMotor ? 'from-orange-500 via-rose-500 to-fuchsia-500' : 'from-emerald-400 via-cyan-500 to-blue-500')}/><div className="flex items-start justify-between"><span className={cn('grid h-11 w-11 place-items-center rounded-2xl', isMotor ? 'bg-orange-500/12 text-orange-500' : 'bg-cyan-500/12 text-cyan-500')}>{isMotor ? item.category === 'Motorcycle' || item.category === 'Scooter' ? <Bike className="h-5 w-5"/> : <CarFront className="h-5 w-5"/> : <Laptop className="h-5 w-5"/>}</span><ChevronRight className="h-4 w-4 text-text-muted transition group-hover:translate-x-1"/></div><div className="mt-4"><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-text-muted">{item.category}</span><h3 className="mt-1 text-lg font-semibold text-text-primary">{item.name}</h3><p className="mt-1 truncate text-xs text-text-secondary">{isMotor ? [item.registrationNumber, item.modelYear, item.fuelType].filter(Boolean).join(' · ') : [item.brand, item.model].filter(Boolean).join(' · ') || 'No model details'}</p></div>{isMotor ? <div className="mt-5 grid grid-cols-2 gap-2"><Mini icon={Gauge} label="Odometer" value={`${(item.odometer || 0).toLocaleString('en-IN')} km`}/><Mini icon={Fuel} label="Fuel" value={item.fuelType || '—'}/></div> : null}<div className="mt-5 flex items-end justify-between border-t border-borderSoft/25 pt-4"><div><p className="text-[10px] uppercase tracking-wide text-text-muted">{isMotor ? 'Next deadline' : 'Warranty'}</p><p className={cn('mt-1 text-xs font-medium', urgent < 0 ? 'text-danger' : urgent <= 60 ? 'text-warning' : 'text-text-secondary')}>{urgent === 99_999 ? 'Not recorded' : urgent < 0 ? 'Overdue' : `${urgent} days`}</p></div><strong className="text-sm text-text-primary">{money(item.price)}</strong></div></button>;
}
function Mini({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) { return <div className="rounded-xl bg-panel2/55 p-2.5"><div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-text-muted"><Icon className="h-3 w-3"/>{label}</div><p className="mt-1 truncate text-xs font-semibold text-text-primary">{value}</p></div>; }

async function saveFile(id: string, file: File) { const db = await openFiles(); await new Promise<void>((resolve, reject) => { const request = db.transaction('invoices', 'readwrite').objectStore('invoices').put(file, id); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); db.close(); }

function Editor({ initial, kind, onClose, onSave }: { initial?: Product; kind: ItemKind; onClose: () => void; onSave: (item: Product, file?: File) => Promise<void> }) {
  const [draft, setDraft] = useState<Product>({ ...empty, kind, category: kind === 'motor' ? 'Car' : 'Phone', ...initial, id: initial?.id ?? crypto.randomUUID(), createdAt: initial?.createdAt ?? new Date().toISOString() });
  const [file, setFile] = useState<File>(); const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const set = (key: keyof Product, value: string | number) => setDraft((current) => ({ ...current, [key]: value }));
  const fieldClass = 'h-11 w-full rounded-xl border border-borderSoft/40 bg-panel2/60 px-3 text-sm text-text-primary outline-none focus:border-emerald-500/45';
  const fields = kind === 'motor' ? motorCategories : productCategories;
  async function submit() { if (!draft.name.trim() || !draft.purchaseDate) return; setSaving(true); await onSave({ ...draft, invoiceName: file?.name ?? draft.invoiceName, invoiceType: file?.type ?? draft.invoiceType }, file); }
  function applyScan(values: OcrSuggestions) {
    setDraft((current) => {
      const next = { ...current };
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined || value === '') continue;
        const field = key as keyof Product;
        if (field === 'notes') next.notes = current.notes ? `${current.notes}\n\n${value}` : String(value);
        else if (!current[field] || current[field] === 0) (next as unknown as Record<string, string | number>)[field] = value;
      }
      return next;
    });
  }
  const steps = [{ label: 'Identity', Icon: IdCard }, { label: 'Ownership', Icon: CircleDollarSign }, { label: 'Care', Icon: ShieldCheck }];
  return createPortal(<div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/65 backdrop-blur-sm sm:items-center sm:p-5" onClick={onClose}><div className="relative max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-t-[30px] border border-borderSoft/40 bg-panel p-4 shadow-2xl sm:rounded-[30px] sm:p-5" onClick={(event) => event.stopPropagation()}><header className={cn('relative overflow-hidden rounded-[24px] border p-5 sm:p-6', kind === 'motor' ? 'border-orange-200 bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50' : 'border-cyan-200 bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50')}><div className="relative flex items-start justify-between gap-3"><div className="flex items-center gap-4"><span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-lg', kind === 'motor' ? 'bg-gradient-to-br from-orange-500 to-rose-600' : 'bg-gradient-to-br from-cyan-500 to-violet-600')}>{kind === 'motor' ? <CarFront className="h-6 w-6"/> : <PackageCheck className="h-6 w-6"/>}</span><div><p className={cn('text-[10px] font-bold uppercase tracking-[.22em]', kind === 'motor' ? 'text-orange-600' : 'text-cyan-700')}>{kind === 'motor' ? 'Your garage' : 'Your collection'}</p><h3 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{initial ? 'Update the story' : kind === 'motor' ? 'Park a new ride' : 'Add something you love'}</h3><p className="mt-1 text-xs text-slate-600">Step {step + 1} of 3 · {steps[step].label}</p></div></div><div className="flex shrink-0 gap-2"><button className="hidden items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 shadow-sm hover:bg-violet-50 sm:flex" onClick={() => setScannerOpen(true)}><ScanText className="h-4 w-4"/>Scan photo</button><button className="grid h-10 w-10 place-items-center rounded-full border border-white bg-white text-slate-700 shadow-sm" onClick={onClose}><X className="h-4 w-4"/></button></div></div><button className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white/80 px-3 py-2 text-xs font-semibold text-violet-700 sm:hidden" onClick={() => setScannerOpen(true)}><ScanText className="h-4 w-4"/>Scan photo or screenshot</button><div className="relative mt-4 grid grid-cols-3 gap-2">{steps.map(({ label, Icon }, index) => <button key={label} onClick={() => setStep(index)} className={cn('flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition', step === index ? kind === 'motor' ? 'border-orange-300 bg-orange-500 text-white shadow-md' : 'border-cyan-300 bg-cyan-600 text-white shadow-md' : 'border-white bg-white/70 text-slate-600 hover:bg-white')}><Icon className="h-3.5 w-3.5"/><span className="hidden sm:inline">{index + 1} · </span>{label}</button>)}</div></header>
    <div className="min-h-[330px]">
      {step === 0 ? <Section title="Identity" subtitle={kind === 'motor' ? 'The essentials for checkpoints, workshops and resale.' : 'The essentials for support, insurance and resale.'}><Grid><Field label={kind === 'motor' ? 'Nickname / vehicle name *' : 'Product name *'}><Input autoFocus value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder={kind === 'motor' ? 'My City / Royal Enfield' : 'MacBook Air'}/></Field><Field label="Type"><select className={fieldClass} value={draft.category} onChange={(e) => set('category', e.target.value)}>{fields.map((value) => <option key={value}>{value}</option>)}</select></Field><TextField label="Brand / maker" name="brand" draft={draft} set={set}/><TextField label="Model / variant" name="model" draft={draft} set={set}/>{kind === 'motor' ? <><TextField label="Registration number" name="registrationNumber" draft={draft} set={set}/><TextField label="Model year" name="modelYear" draft={draft} set={set}/><TextField label="VIN / chassis number" name="chassisNumber" draft={draft} set={set}/><TextField label="Engine number" name="engineNumber" draft={draft} set={set}/><Field label="Fuel / power"><select className={fieldClass} value={draft.fuelType} onChange={(e) => set('fuelType', e.target.value)}>{['Petrol','Diesel','Electric','Hybrid','CNG','Human powered'].map((value) => <option key={value}>{value}</option>)}</select></Field><NumberField label="Current odometer (km)" name="odometer" draft={draft} set={set}/></> : <TextField label="Serial / IMEI" name="serialNumber" draft={draft} set={set}/>}</Grid></Section> : null}
      {step === 1 ? <Section title="Purchase" subtitle="Cost, invoice and ownership details."><Grid><Field label="Purchase date *"><Input type="date" value={draft.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)}/></Field><NumberField label="Purchase price (₹)" name="price" draft={draft} set={set}/><TextField label="Bought from" name="retailer" draft={draft} set={set}/><TextField label="Payment method" name="paymentMethod" draft={draft} set={set}/><Field label="Invoice / document"><label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-borderSoft/50 bg-panel2/40 px-3 text-xs text-text-secondary"><Upload className="h-4 w-4"/><span className="truncate">{file?.name || draft.invoiceName || 'Attach PDF or image'}</span><input className="sr-only" type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0])}/></label></Field>{kind === 'motor' ? <><TextField label="Loan provider" name="loanProvider" draft={draft} set={set}/><Field label="Loan ends"><Input type="date" value={draft.loanEnds} onChange={(e) => set('loanEnds', e.target.value)}/></Field></> : null}</Grid></Section> : null}
      {step === 2 ? <>{kind === 'motor' ? <Section title="Road-ready" subtitle="Insurance, statutory documents and maintenance."><Grid><TextField label="Insurance provider" name="insuranceProvider" draft={draft} set={set}/><TextField label="Insurance policy number" name="insurancePolicy" draft={draft} set={set}/><DateField label="Insurance ends" name="insuranceEnds" draft={draft} set={set}/><DateField label="PUC / emissions ends" name="pucEnds" draft={draft} set={set}/><DateField label="Registration / fitness ends" name="registrationEnds" draft={draft} set={set}/><DateField label="Next service date" name="nextService" draft={draft} set={set}/><NumberField label="Next service at (km)" name="nextServiceKm" draft={draft} set={set}/><NumberField label="Tyres changed at (km)" name="tyreChangedAtKm" draft={draft} set={set}/><DateField label="Warranty ends" name="warrantyEnds" draft={draft} set={set}/></Grid></Section> : <Section title="Protection & upkeep" subtitle="Dates that should never surprise you."><Grid><DateField label="Warranty ends" name="warrantyEnds" draft={draft} set={set}/><TextField label="Warranty provider" name="warrantyProvider" draft={draft} set={set}/><TextField label="Plan / policy number" name="policyNumber" draft={draft} set={set}/><DateField label="Return window ends" name="returnEnds" draft={draft} set={set}/><DateField label="Next service" name="nextService" draft={draft} set={set}/><DateField label="Subscription renews" name="subscriptionRenews" draft={draft} set={set}/></Grid></Section>}<Section title="Notes" subtitle="Anything future-you should know."><Grid><TextField label="Location" name="location" draft={draft} set={set}/><TextField label="Tags" name="tags" draft={draft} set={set}/><Field label="Condition"><select className={fieldClass} value={draft.condition} onChange={(e) => set('condition', e.target.value)}>{['New','Excellent','Good','Fair','Needs repair'].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Status"><select className={fieldClass} value={draft.status} onChange={(e) => set('status', e.target.value)}>{['Active','In service','In repair','Loaned','Sold','Disposed'].map((value) => <option key={value}>{value}</option>)}</select></Field><div className="sm:col-span-2"><Field label="Notes"><Textarea className="min-h-20" value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Accessories, repairs, modifications, roadside assistance…"/></Field></div></Grid></Section></> : null}
    </div>
    <footer className="sticky -bottom-5 z-10 mt-4 flex items-center justify-between gap-3 rounded-[20px] border border-borderSoft/30 bg-panel/95 p-3 shadow-[0_-14px_35px_rgba(0,0,0,.08)] backdrop-blur"><Button variant="secondary" onClick={() => step === 0 ? onClose() : setStep(step - 1)}>{step === 0 ? 'Cancel' : 'Back'}</Button><div className="flex items-center gap-3"><span className="hidden text-xs text-text-muted sm:block">{step + 1} / 3</span>{step < 2 ? <Button onClick={() => setStep(step + 1)}>Continue <ChevronRight className="h-4 w-4"/></Button> : <Button className={cn('border-0 text-white shadow-lg', kind === 'motor' ? 'bg-gradient-to-r from-orange-500 to-rose-500' : 'bg-gradient-to-r from-cyan-500 to-violet-600')} disabled={saving || !draft.name.trim() || !draft.purchaseDate} onClick={() => void submit()}>{saving ? 'Saving…' : <><Check className="h-4 w-4"/>Save to vault</>}</Button>}</div></footer>{scannerOpen ? <OfflineOcrScanner onClose={() => setScannerOpen(false)} onApply={applyScan}/> : null}</div></div>, document.body);
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const looks = title === 'Identity' ? { Icon: IdCard, shell: 'border-violet-200/60 bg-violet-500/[.045]', badge: 'bg-violet-500 text-white' } : title === 'Purchase' ? { Icon: CircleDollarSign, shell: 'border-emerald-200/60 bg-emerald-500/[.045]', badge: 'bg-emerald-500 text-white' } : title === 'Road-ready' || title === 'Protection & upkeep' ? { Icon: ShieldCheck, shell: 'border-orange-200/60 bg-orange-500/[.045]', badge: 'bg-orange-500 text-white' } : { Icon: Tag, shell: 'border-cyan-200/60 bg-cyan-500/[.045]', badge: 'bg-cyan-500 text-white' };
  return <section className={cn('mt-4 rounded-[22px] border p-4 sm:p-5', looks.shell)}><div className="mb-5 flex items-center gap-3"><span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-sm', looks.badge)}><looks.Icon className="h-4 w-4"/></span><div className="min-w-0"><h4 className="text-sm font-semibold text-text-primary">{title}</h4><p className="mt-0.5 text-xs text-text-muted">{subtitle}</p></div></div>{children}</section>;
}
function Grid({ children }: { children: ReactNode }) { return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="min-w-0 space-y-1.5"><span className="text-xs font-medium text-text-secondary">{label}</span>{children}</label>; }
function TextField({ label, name, draft, set }: { label: string; name: keyof Product; draft: Product; set: (key: keyof Product, value: string | number) => void }) { return <Field label={label}><Input value={String(draft[name] ?? '')} onChange={(e) => set(name, e.target.value)}/></Field>; }
function DateField({ label, name, draft, set }: { label: string; name: keyof Product; draft: Product; set: (key: keyof Product, value: string | number) => void }) { return <Field label={label}><Input type="date" value={String(draft[name] ?? '')} onChange={(e) => set(name, e.target.value)}/></Field>; }
function NumberField({ label, name, draft, set }: { label: string; name: keyof Product; draft: Product; set: (key: keyof Product, value: string | number) => void }) { return <Field label={label}><Input type="number" min="0" value={Number(draft[name]) || ''} onChange={(e) => set(name, Number(e.target.value))}/></Field>; }

function Details({ item, onClose, onEdit, onDelete }: { item: Product; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const isMotor = item.kind === 'motor';
  const rows = isMotor ? [
    ['Registration', item.registrationNumber], ['VIN / chassis', item.chassisNumber], ['Engine number', item.engineNumber], ['Odometer', item.odometer ? `${item.odometer.toLocaleString('en-IN')} km` : ''], ['Fuel', item.fuelType], ['Insurance', formatDate(item.insuranceEnds)], ['PUC / emissions', formatDate(item.pucEnds)], ['Registration / fitness', formatDate(item.registrationEnds)], ['Next service', formatDate(item.nextService)], ['Service at', item.nextServiceKm ? `${item.nextServiceKm.toLocaleString('en-IN')} km` : ''], ['Loan ends', formatDate(item.loanEnds)],
  ] : [['Serial / IMEI', item.serialNumber], ['Warranty ends', formatDate(item.warrantyEnds)], ['Warranty provider', item.warrantyProvider], ['Return ends', formatDate(item.returnEnds)], ['Subscription', formatDate(item.subscriptionRenews)]];
  rows.unshift(['Purchase', formatDate(item.purchaseDate)], ['Price', money(item.price)], ['Bought from', item.retailer]);
  async function openInvoice() { const file = await fileAction(item.id, 'get'); if (!file) return; const url = URL.createObjectURL(file); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
  const deadline = isMotor ? item.insuranceEnds || item.pucEnds || item.nextService : item.warrantyEnds || item.returnEnds;
  return createPortal(<div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/65 backdrop-blur-sm" onClick={onClose}><aside className="h-full w-full max-w-xl overflow-y-auto border-l border-borderSoft/40 bg-panel shadow-2xl" onClick={(event) => event.stopPropagation()}>
    <div className={cn('relative min-h-[245px] overflow-hidden p-6 sm:p-8', isMotor ? 'bg-gradient-to-br from-orange-50 via-rose-50 to-amber-50' : 'bg-gradient-to-br from-cyan-50 via-violet-50 to-fuchsia-50')}>
      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(15,23,42,.14) 1px, transparent 0)', backgroundSize: '18px 18px' }}/>
      <div className={cn('absolute -bottom-16 -right-12 h-56 w-56 rounded-full border-[18px]', isMotor ? 'border-orange-200/50' : 'border-cyan-200/50')}/>
      <div className="relative flex items-start justify-between"><span className={cn('grid h-14 w-14 place-items-center rounded-[20px] text-white shadow-xl', isMotor ? 'bg-gradient-to-br from-orange-500 to-rose-600 shadow-orange-500/20' : 'bg-gradient-to-br from-cyan-500 to-violet-600 shadow-cyan-500/20')}>{isMotor ? <CarFront className="h-7 w-7"/> : <PackageCheck className="h-7 w-7"/>}</span><button className="grid h-10 w-10 place-items-center rounded-full border border-white bg-white/75 text-slate-700 shadow-sm" onClick={onClose}><X className="h-4 w-4"/></button></div>
      <div className="relative mt-7"><span className={cn('rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em]', isMotor ? 'bg-orange-500/12 text-orange-700' : 'bg-cyan-500/12 text-cyan-700')}>{item.category}</span><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{item.name}</h2><p className="mt-1 text-sm text-slate-600">{[item.brand,item.model,item.modelYear].filter(Boolean).join(' · ') || 'Your saved item'}</p></div>
    </div>
    <div className="p-5 sm:p-7">
      <div className="-mt-11 grid grid-cols-3 gap-2">
        <StatusTile icon={BadgeCheck} label="Status" value={item.status} color="emerald" />
        <StatusTile icon={isMotor ? Gauge : ShieldCheck} label={isMotor ? 'Odometer' : 'Condition'} value={isMotor ? `${item.odometer.toLocaleString('en-IN')} km` : item.condition} color="violet" />
        <StatusTile icon={CalendarClock} label="Next up" value={deadline ? `${Math.max(0, daysTo(deadline))} days` : 'All clear'} color="orange" />
      </div>
      {item.invoiceName ? <button onClick={() => void openInvoice()} className="group mt-5 flex w-full items-center gap-3 rounded-[20px] border border-cyan-200/60 bg-gradient-to-r from-cyan-500/[.07] to-violet-500/[.07] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 text-white shadow-lg"><FileText className="h-5 w-5"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-text-primary">Your paperwork</span><span className="block truncate text-xs text-text-muted">{item.invoiceName}</span></span><ChevronRight className="h-4 w-4 text-text-muted transition group-hover:translate-x-1"/></button> : <div className="mt-5 flex items-center gap-3 rounded-[20px] border border-dashed border-borderSoft/40 bg-panel2/30 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-panel2 text-text-muted"><FileText className="h-5 w-5"/></span><div><p className="text-sm font-semibold text-text-primary">No document attached</p><p className="text-xs text-text-muted">Edit this record to add one.</p></div></div>}
      <div className="mt-5 overflow-hidden rounded-[22px] border border-borderSoft/30 bg-panel2/25"><div className="flex items-center gap-2 border-b border-borderSoft/25 bg-panel2/45 px-4 py-3"><IdCard className="h-4 w-4 text-violet-500"/><h3 className="text-xs font-semibold uppercase tracking-[.12em] text-text-secondary">Ownership details</h3></div><div className="grid sm:grid-cols-2">{rows.filter(([,value]) => value && value !== '—').map(([label,value], index) => <div key={label} className={cn('min-w-0 border-borderSoft/20 p-4', index % 2 === 0 ? 'sm:border-r' : '', index < rows.length - 2 ? 'border-b' : '')}><p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p><p className="mt-1 break-words text-sm font-semibold text-text-primary">{value}</p></div>)}</div></div>
      {item.notes ? <div className="relative mt-5 overflow-hidden rounded-[20px] border border-amber-200/50 bg-amber-500/[.06] p-4"><Tag className="absolute -bottom-5 -right-4 h-20 w-20 text-amber-500/[.08]"/><h3 className="relative text-xs font-semibold uppercase tracking-wide text-amber-700">Things to remember</h3><p className="relative mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{item.notes}</p></div> : null}
      <div className="mt-6 flex gap-2"><Button className={cn('flex-1 border-0 text-white', isMotor ? 'bg-gradient-to-r from-orange-500 to-rose-500' : 'bg-gradient-to-r from-cyan-500 to-violet-600')} onClick={onEdit}><Pencil className="h-4 w-4"/>Edit story</Button><Button variant="secondary" onClick={onDelete}><Trash2 className="h-4 w-4"/>Delete</Button></div>
    </div>
  </aside></div>, document.body);
}

function StatusTile({ icon: Icon, label, value, color }: { icon: typeof Archive; label: string; value: string; color: 'emerald' | 'violet' | 'orange' }) {
  const styles = { emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700', violet: 'border-violet-200 bg-violet-50 text-violet-700', orange: 'border-orange-200 bg-orange-50 text-orange-700' };
  return <div className={cn('relative min-w-0 rounded-[18px] border p-3 shadow-lg shadow-slate-900/5', styles[color])}><Icon className="h-4 w-4"/><p className="mt-2 text-[9px] font-bold uppercase tracking-wide opacity-70">{label}</p><p className="mt-0.5 truncate text-xs font-semibold">{value || '—'}</p></div>;
}
