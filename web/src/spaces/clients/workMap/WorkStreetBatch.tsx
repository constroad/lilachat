import { Suspense, useMemo, useState } from 'react';
import { Check, Pencil, Pointer, X } from 'lucide-react';
import { BATCH_STAY, batchDoneLabel, batchLines, batchPins, batchScreenActions, batchStreetLengthM, batchTotals, EMPTY_BATCH_SCREEN, metersLabel, workMapView, type BatchQuestion, type BatchScreen, type BatchStreet, type TapFeatures, type WorkMap, type WorkMapPoint } from '@lilachat/shared';
import { lazyChunk } from '../../../ui/lazyChunk';
import { KICKER } from './WorkMapPanel';
import { WorkStreetEditor } from './WorkStreetEditor';
import type { StreetSend } from './workProgressSender';

const WorkMapCanvas = lazyChunk(() => import('./WorkMapCanvas'));
const NO_STREETS: WorkMap = { streets: [], scopes: [], progress: [], works: [], stages: [] };
const HINT = 'Toca las calles donde vas a trabajar';
const SMALL_FIELD = 'h-9 rounded-lg border border-outline/25 bg-background px-2 outline-none focus:border-primary';

type BatchProps = { title: string; map: WorkMap | null; send: StreetSend; onClose: () => void; onSaved: (message: string) => void; /** Some were saved before a failure: the map reads them again, the list stays. */ onPartial: () => void; start?: WorkMapPoint };
type Edit = (key: string, change: Partial<Pick<BatchStreet, 'name' | 'widthM'>>) => void;

/** One street of the list: its number on the map, a name to fix, its length, an optional width and «Quitar». */
function BatchRow(props: { street: BatchStreet; number: number; onEdit: Edit; onRemove: () => void }) {
  const { street, number } = props;
  return (
    <li data-testid={`lote-calle-${number}`} className={`rounded-xl border bg-surface px-3 py-2 ${street.error ? 'border-error' : 'border-outline/20'}`}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-on-surface font-mono text-[14px] font-bold text-surface">{number}</span>
        <input data-testid={`lote-nombre-${number}`} aria-label={`Nombre de la calle ${number}`} value={street.name} maxLength={80} placeholder="Nombre de la calle" onChange={(event) => props.onEdit(street.key, { name: event.target.value })} className="h-10 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-on-surface outline-none" />
        <span className="shrink-0 font-mono text-[13px] text-on-surface-variant">{metersLabel(batchStreetLengthM(street))}</span>
        <input data-testid={`lote-ancho-${number}`} aria-label={`Ancho de la calle ${number} en metros`} type="number" inputMode="decimal" min={0.1} max={60} step={0.1} value={street.widthM ?? ''} placeholder="Ancho" onChange={(event) => props.onEdit(street.key, { widthM: event.target.value === '' ? null : Number(event.target.value) })} className={`${SMALL_FIELD} w-20 font-mono text-[13px]`} />
        <button type="button" data-testid={`lote-quitar-${number}`} aria-label={`Quitar ${street.name || 'la calle'}`} onClick={props.onRemove} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-background"><X size={18} /></button>
      </div>
      {street.error ? <p data-testid={`lote-error-${number}`} className="mt-1 text-[12px] font-semibold text-error">{street.error}</p> : null}
    </li>
  );
}

/** The band's question: «Quitar» a street with edits, or «Salir» without saving. */
function BandQuestion(props: { question: BatchQuestion; onAnswer: (yes: boolean) => void }) {
  return (
    <div data-testid="lote-pregunta" role="alertdialog" className="mt-2 rounded-xl bg-on-primary/15 p-3">
      <p className="text-[13px] font-semibold">{props.question.text}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" data-testid="lote-pregunta-si" onClick={() => props.onAnswer(true)} className="h-10 rounded-xl bg-on-primary text-[14px] font-semibold text-primary">{props.question.yes}</button>
        <button type="button" data-testid="lote-pregunta-no" onClick={() => props.onAnswer(false)} className="h-10 rounded-xl bg-on-primary/15 text-[14px] font-semibold">{BATCH_STAY}</button>
      </div>
    </div>
  );
}

/** «Área de trabajo», the list, «Trazar a mano» and «Listo». */
function BatchPanel(props: { screen: BatchScreen; onEdit: Edit; onRemove: (key: string) => void; onHand: () => void; onDone: () => void }) {
  const { batch, progress, problem } = props.screen;
  const busy = progress !== null;
  return (
    <div className="flex flex-col gap-3 border-outline/15 bg-surface p-4 lg:w-[420px] lg:shrink-0 lg:overflow-y-auto lg:border-l">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className={KICKER}>Área de trabajo</p>
          <p data-testid="lote-total" className="text-[22px] font-bold text-on-surface">{batchTotals(batch).label}</p>
        </div>
        <span className="rounded-md border border-outline/25 px-2 py-1 font-mono text-[10px] font-bold uppercase text-on-surface-variant">Total seleccionado</span>
      </div>
      <ol className="space-y-2">{batch.streets.map((street, index) => <BatchRow key={street.key} street={street} number={index + 1} onEdit={props.onEdit} onRemove={() => props.onRemove(street.key)} />)}</ol>
      <button type="button" data-testid="lote-a-mano" disabled={busy} onClick={props.onHand} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-outline/25 text-[14px] font-semibold text-on-surface disabled:opacity-50"><Pencil size={16} className="text-primary" />Trazar a mano (si la calle no sale en el mapa)</button>
      {problem ? <p data-testid="lote-problema" role="alert" className="text-[13px] font-semibold text-error">{problem}</p> : null}
      <button type="button" data-testid="lote-listo" disabled={busy || !batch.streets.length} onClick={props.onDone} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-[16px] font-bold text-on-primary disabled:opacity-60"><Check size={18} />{progress ?? batchDoneLabel(batch.streets.length)}</button>
    </div>
  );
}

/**
 * ma02 «Marcar calles del área» (José approved Portal's prototype 28/11): tap every road of the area,
 * each comes whole and numbered into the list; «Listo» saves them one by one. A wide screen puts the
 * list beside the map, like the single-street editor.
 */
export function WorkStreetBatch(props: BatchProps) {
  const [screen, setScreen] = useState<BatchScreen>(EMPTY_BATCH_SCREEN);
  const [hand, setHand] = useState(false);
  const view = useMemo(() => workMapView(props.map ?? NO_STREETS), [props.map]);
  const actions = batchScreenActions(screen, setScreen, { saved: props.map?.streets ?? [], newKey: () => crypto.randomUUID(), send: props.send, onClose: props.onClose, onSaved: props.onSaved, onPartial: props.onPartial });
  const onTap = (point: WorkMapPoint, roads?: TapFeatures) => actions.tap(roads ?? { underFinger: [], nearby: [], tap: point });
  if (hand) return <WorkStreetEditor title={props.title} map={props.map} send={actions.addHand} mode="hand" saveLabel="Agregar a la lista" start={props.start} onClose={() => setHand(false)} onSaved={() => setHand(false)} />;
  return (
    <div data-testid="lote-calles" className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-outline/15 bg-surface px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className={`${KICKER} truncate text-primary`}>{props.title}</p>
          <h2 className="text-lg font-bold tracking-tight">Marcar calles del área</h2>
        </div>
        <button type="button" data-testid="lote-cancelar" aria-label="Cancelar" onClick={actions.cancel} className="grid h-11 w-11 place-items-center rounded-full text-on-surface-variant hover:bg-background"><X size={18} /></button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="bg-primary px-4 py-3 text-on-primary">
            <p data-testid="lote-ayuda" className="flex items-center gap-2 text-[14px] font-semibold"><Pointer size={18} />{HINT}</p>
            {screen.question ? <BandQuestion question={screen.question} onAnswer={actions.answer} /> : null}
          </div>
          <div className="relative min-h-[320px] flex-1 lg:min-h-0">
            <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-surface-variant" />}>
              <WorkMapCanvas view={view} expanded={false} focus={view.bounds ? null : (props.start ?? null)} pins={batchPins(screen.batch)} stretches={batchLines(screen.batch)} onTap={onTap} />
            </Suspense>
          </div>
        </div>
        <BatchPanel screen={screen} onEdit={actions.edit} onRemove={actions.remove} onHand={() => setHand(true)} onDone={() => void actions.finish()} />
      </div>
    </div>
  );
}
