import { useEffect, useRef, useState } from 'react';
import { Check, ClipboardPaste, ImagePlus, LockKeyhole, ScanText, Sparkles, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/input';

export type OcrSuggestions = Partial<Record<'name' | 'purchaseDate' | 'price' | 'retailer' | 'serialNumber' | 'registrationNumber' | 'chassisNumber' | 'engineNumber' | 'insurancePolicy' | 'notes', string | number>>;

function isoDate(day: string, month: string, year: string) {
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function extractSuggestions(text: string): OcrSuggestions {
  const clean = text.replace(/[|]/g, 'I');
  const date = clean.match(/(?:date|dated|invoice\s*date|purchase\s*date)?\s*[:#-]?\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/i);
  const totalMatches = [...clean.matchAll(/(?:grand\s*total|net\s*amount|amount\s*paid|total)\s*[:₹Rs.]*\s*([\d,]+(?:\.\d{1,2})?)/gi)];
  const registration = clean.match(/\b([A-Z]{2})[ -]?(\d{1,2})[ -]?([A-Z]{1,3})[ -]?(\d{4})\b/i);
  const vin = clean.match(/(?:VIN|chassis(?:\s*no)?)\s*[:#-]?\s*([A-HJ-NPR-Z0-9]{11,17})/i);
  const engine = clean.match(/(?:engine(?:\s*no)?)\s*[:#-]?\s*([A-Z0-9-]{6,20})/i);
  const serial = clean.match(/(?:serial|s\/n|imei)(?:\s*(?:no|number))?\s*[:#-]?\s*([A-Z0-9-]{6,24})/i);
  const policy = clean.match(/(?:policy)(?:\s*(?:no|number))?\s*[:#-]?\s*([A-Z0-9\/-]{6,30})/i);
  const firstLine = clean.split('\n').map((line) => line.trim()).find((line) => line.length >= 3 && line.length <= 60);
  const total = totalMatches[totalMatches.length - 1]?.[1];
  return {
    name: firstLine,
    purchaseDate: date ? isoDate(date[1], date[2], date[3]) : undefined,
    price: total ? Number(total.replace(/,/g, '')) : undefined,
    registrationNumber: registration ? registration.slice(1).join(' ').toUpperCase() : undefined,
    chassisNumber: vin?.[1]?.toUpperCase(),
    engineNumber: engine?.[1]?.toUpperCase(),
    serialNumber: serial?.[1]?.toUpperCase(),
    insurancePolicy: policy?.[1]?.toUpperCase(),
    notes: `Scanned locally:\n${text.trim()}`,
  };
}

async function improveImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(1, Math.min(2.5, 1800 / Math.max(bitmap.width, bitmap.height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = image.data[index] * .299 + image.data[index + 1] * .587 + image.data[index + 2] * .114;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
    image.data[index] = contrast; image.data[index + 1] = contrast; image.data[index + 2] = contrast;
  }
  context.putImageData(image, 0, 0);
  bitmap.close();
  return await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), 'image/png', .95));
}

export function OfflineOcrScanner({ onClose, onApply }: { onClose: () => void; onApply: (values: OcrSuggestions) => void }) {
  const [image, setImage] = useState<File>();
  const [preview, setPreview] = useState('');
  const [text, setText] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Choose a clear photo or screenshot');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(file?: File) {
    if (!file || !file.type.startsWith('image/')) { setError('Choose an image or screenshot.'); return; }
    if (preview) URL.revokeObjectURL(preview);
    setImage(file); setPreview(URL.createObjectURL(file)); setText(''); setError(''); setProgress(0); setStatus('Ready to read locally');
  }
  async function pasteScreenshot() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) { const type = item.types.find((value) => value.startsWith('image/')); if (type) { const blob = await item.getType(type); choose(new File([blob], 'pasted-screenshot.png', { type })); return; } }
      setError('No screenshot found on the clipboard.');
    } catch { setError('Clipboard access was blocked. Use Ctrl+V here or choose the screenshot file.'); }
  }
  useEffect(() => {
    const listener = (event: ClipboardEvent) => { const file = [...(event.clipboardData?.files ?? [])].find((value) => value.type.startsWith('image/')); if (file) choose(file); };
    window.addEventListener('paste', listener); return () => window.removeEventListener('paste', listener);
  });
  async function scan() {
    if (!image || running) return;
    setRunning(true); setError(''); setProgress(.02); setStatus('Preparing image');
    try {
      const [{ createWorker }, prepared] = await Promise.all([import('tesseract.js'), improveImage(image)]);
      const worker = await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js', langPath: '/ocr/lang', corePath: '/ocr/core',
        logger: (message) => { if (typeof message.progress === 'number') setProgress(message.progress); if (message.status) setStatus(message.status.replace(/_/g, ' ')); },
      });
      const result = await worker.recognize(prepared);
      await worker.terminate();
      setText(result.data.text.trim()); setProgress(1); setStatus(`Done · ${Math.round(result.data.confidence)}% OCR confidence`);
    } catch (reason) { console.error('Offline OCR failed', reason); setError('Could not read this image. Try a brighter, straighter crop.'); setStatus('Scan failed'); }
    finally { setRunning(false); }
  }
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-5" onClick={onClose}><div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-panel p-5 shadow-2xl sm:rounded-[28px] sm:p-6" onClick={(event) => event.stopPropagation()}>
    <header className="flex items-start justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-lg"><ScanText className="h-5 w-5"/></span><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-violet-500">Private on-device OCR</p><h3 className="text-xl font-semibold text-text-primary">Photo → editable text</h3></div></div><Button className="h-10 w-10 rounded-full p-0" variant="ghost" onClick={onClose}><X className="h-4 w-4"/></Button></header>
    <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-600"><LockKeyhole className="h-4 w-4"/>Your image never leaves this device. OCR models are bundled with MissionControl.</div>
    <div className="mt-5 grid gap-4 md:grid-cols-2"><div onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }} className="relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-[22px] border-2 border-dashed border-borderSoft/45 bg-panel2/30 p-4 text-center">{preview ? <img src={preview} alt="OCR source" className="absolute inset-0 h-full w-full object-contain p-3"/> : <><ImagePlus className="h-10 w-10 text-violet-500"/><p className="mt-3 text-sm font-semibold text-text-primary">Drop a photo or screenshot</p><p className="mt-1 text-xs text-text-muted">Receipts, RCs, insurance, labels and invoices</p></>}<input ref={inputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => choose(event.target.files?.[0])}/></div><div className="flex min-h-[300px] flex-col"><div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => inputRef.current?.click()}><ImagePlus className="h-4 w-4"/>Choose photo</Button><Button variant="secondary" onClick={() => void pasteScreenshot()}><ClipboardPaste className="h-4 w-4"/>Paste shot</Button></div><div className="mt-3 flex-1"><Textarea className="h-full min-h-[210px] resize-none font-mono text-xs leading-5" value={text} onChange={(event) => setText(event.target.value)} placeholder="Extracted text will appear here. You can correct anything before applying it."/></div></div></div>
    {(running || progress > 0) ? <div className="mt-4"><div className="flex justify-between text-xs text-text-muted"><span className="capitalize">{status}</span><span>{Math.round(progress * 100)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-panel2"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all" style={{ width: `${progress * 100}%` }}/></div></div> : null}
    {error ? <p className="mt-3 rounded-xl bg-danger/10 p-3 text-xs text-danger">{error}</p> : null}
    <footer className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button>{text ? <Button onClick={() => { onApply(extractSuggestions(text)); onClose(); }}><Check className="h-4 w-4"/>Use detected details</Button> : <Button disabled={!image || running} onClick={() => void scan()}><Sparkles className="h-4 w-4"/>{running ? 'Reading…' : 'Read locally'}</Button>}</footer>
  </div></div>;
}
