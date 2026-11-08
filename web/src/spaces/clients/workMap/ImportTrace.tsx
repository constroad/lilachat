import { useRef, useState } from 'react';
import { Check, FileUp } from 'lucide-react';
import { confirmImport, importCreateLabel, importDoneLabel, reviewImport, type ImportReview, type MapEditSend, type TraceUpload } from '@lilachat/shared';
import { DriveTraceInput } from '../ServiceDriveWeb';

type Step = { kind: 'idle' } | { kind: 'busy'; label: string } | { kind: 'review'; mediaId: string; review: ImportReview } | { kind: 'done'; message: string } | { kind: 'failed'; message: string };
type Props = { send: MapEditSend; upload: TraceUpload<File> };

function Review(props: { review: ImportReview }) {
  return (
    <div className="mt-3 space-y-2">
      <ul data-testid="importar-lineas" className="divide-y divide-outline/15 rounded-lg border border-outline/15">
        {props.review.lines.map((line, index) => <li key={`${line.name}-${index}`} className="flex justify-between gap-2 px-3 py-2 text-[13px]"><span className="truncate text-on-surface">{line.name}</span><span className="shrink-0 font-mono text-on-surface-variant">{line.length}</span></li>)}
      </ul>
      {props.review.skipped.length ? <p className="text-[12px] text-on-surface-variant">Se dejan fuera: {props.review.skipped.map((one) => `${one.name} (${one.reason})`).join(' · ')}</p> : null}
    </div>
  );
}

/** «Traer un trazado» (design o-12): a KMZ or KML goes to the Drive, Portal says what it read, and the person confirms. */
export function ImportTrace(props: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [entryId] = useState(() => crypto.randomUUID());
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setStep({ kind: 'busy', label: 'Subiendo…' });
    const uploaded = await props.upload(file);
    if (!uploaded.ok) return setStep({ kind: 'failed', message: uploaded.message });
    setStep({ kind: 'busy', label: 'Leyendo el archivo…' });
    const read = await reviewImport(props.send, uploaded.mediaId);
    setStep(read.ok ? { kind: 'review', mediaId: uploaded.mediaId, review: read.review } : { kind: 'failed', message: read.message });
  };
  const confirm = async (mediaId: string) => {
    setStep({ kind: 'busy', label: 'Creando calles…' });
    const made = await confirmImport(props.send, mediaId, entryId);
    setStep(made.ok ? { kind: 'done', message: importDoneLabel(made.review.lines.length) } : { kind: 'failed', message: made.message });
  };
  return (
    <section data-testid="importar-trazado" className="rounded-xl border-[1.5px] border-dashed border-outline/25 bg-surface p-4">
      <DriveTraceInput ref={input} testId="importar-archivo" onFile={(file) => void pick(file)} />
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-on-surface"><FileUp size={16} className="text-primary" />Importar KMZ o KML</p>
        <button type="button" data-testid="importar-elegir" disabled={step.kind === 'busy'} onClick={() => input.current?.click()} className="h-9 rounded-lg bg-primary/10 px-3 text-[13px] font-semibold text-primary disabled:opacity-60">{step.kind === 'busy' ? step.label : 'Elegir archivo'}</button>
      </div>
      <p className="mt-1 text-[12px] text-on-surface-variant">Las líneas entran como calles; revisa el nombre y el largo.</p>
      {step.kind === 'review' ? (
        <>
          <Review review={step.review} />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setStep({ kind: 'idle' })} className="h-10 flex-1 rounded-xl border border-outline/20 text-[13px] font-semibold">Cancelar</button>
            <button type="button" data-testid="importar-crear" onClick={() => void confirm(step.mediaId)} className="h-10 flex-[2] rounded-xl bg-primary text-[13px] font-semibold text-on-primary">{importCreateLabel(step.review.lines.length)}</button>
          </div>
        </>
      ) : null}
      {step.kind === 'done' ? <p role="status" data-testid="importar-listo" className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-on-surface"><Check size={15} className="text-primary" />{step.message}</p> : null}
      {step.kind === 'failed' ? <p role="alert" data-testid="importar-error" className="mt-3 text-[13px] font-semibold text-error">{step.message}</p> : null}
    </section>
  );
}

