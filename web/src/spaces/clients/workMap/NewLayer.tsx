import { useEffect, useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { createMapWaiter, LAYER_MAP_WAIT_MS, LAYER_TAKEN, layerButtonLabel, layerChoicesOf, layerMetradoOf, layerPickIdle, layerPlanOf, layerStreetRowsOf, OTHER_LAYER_KEY, runLayerCreate, WORK_TAG_COLORS, type LayerChoice, type LayerPick, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { LabelColors } from './ScopeForm';
import { KICKER } from './WorkMapPanel';

const CARD = 'rounded-2xl border-[1.5px] bg-surface';

function LayerChip(props: { choice: LayerChoice; on: boolean; onPick: () => void }) {
  const { choice } = props;
  return (
    <button type="button" role="radio" aria-checked={props.on} data-testid={`capa-${choice.key}`} disabled={choice.taken} onClick={props.onPick} className={`${CARD} flex min-h-[56px] items-center gap-2.5 px-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${props.on ? 'border-on-surface' : 'border-outline/20 hover:bg-background'}`}>
      <span aria-hidden className="h-4 w-4 shrink-0 rounded" style={{ backgroundColor: choice.color }} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-on-surface">{choice.name}</span>
        {choice.taken ? <span className="block text-[12px] font-semibold text-on-surface-variant">{LAYER_TAKEN}</span> : null}
      </span>
      {props.on ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-on-surface text-surface"><Check size={14} /></span> : null}
    </button>
  );
}

function OtherLayer(props: { pick: LayerPick; onPick: (next: Partial<LayerPick>) => void }) {
  if (props.pick.key !== OTHER_LAYER_KEY) {
    return <button type="button" data-testid="capa-otra" onClick={() => props.onPick({ key: OTHER_LAYER_KEY })} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-outline/40 text-[14px] font-semibold text-on-surface-variant hover:bg-background"><Plus size={16} />Otra…</button>;
  }
  return (
    <div className={`${CARD} border-on-surface p-3`}>
      <input data-testid="capa-otra-nombre" autoFocus value={props.pick.otherName} maxLength={60} placeholder="Nombre del trabajo" onChange={(event) => props.onPick({ otherName: event.target.value })} className="h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-[15px] outline-none focus:border-primary" />
      <LabelColors testId="capa-otra" colors={WORK_TAG_COLORS} value={props.pick.otherColor} onPick={(otherColor) => props.onPick({ otherColor })} />
    </div>
  );
}

function Streets(props: { map: WorkMap; pick: LayerPick; onPick: (next: Partial<LayerPick>) => void }) {
  const metrado = layerMetradoOf(props.map);
  const rows = props.pick.allStreets ? layerStreetRowsOf(props.map) : [];
  return (
    <section className="space-y-2">
      <p className={KICKER}>Paso 2 · En qué calles</p>
      <label className={`${CARD} flex cursor-pointer items-center gap-3 border-outline/20 px-4 py-3`}>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-on-surface">Todas las calles de la obra</span>
          <span data-testid="capa-metrado" className="block font-mono text-[12px] text-on-surface-variant">{metrado.line}</span>
        </span>
        <input type="checkbox" role="switch" data-testid="capa-todas" checked={props.pick.allStreets} onChange={(event) => props.onPick({ allStreets: event.target.checked })} className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-outline/30 transition-colors before:block before:h-5 before:w-5 before:translate-x-0.5 before:rounded-full before:bg-white before:transition-transform checked:bg-primary checked:before:translate-x-[22px]" />
      </label>
      {rows.map((row) => (
        <div key={row.id} className={`${CARD} flex items-center gap-3 border-outline/15 px-4 py-2.5`}>
          <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-on-surface">{row.name}</span><span className="block font-mono text-[12px] text-on-surface-variant">{row.detail}</span></span>
          {row.area ? <span className="font-mono text-[13px] font-semibold text-on-surface">{row.area}</span> : null}
        </div>
      ))}
      {props.pick.allStreets ? null : <p className="text-[13px] text-on-surface-variant">Después tocas en el mapa las calles que lo llevan.</p>}
      {props.pick.allStreets && metrado.areaM2 ? <p className="text-[12px] text-on-surface-variant">Metrado = largo × ancho de cada calle</p> : null}
    </section>
  );
}

type Props = { map: WorkMap; send: MapEditSend; onCreated: (workId: string, paint: boolean) => void; onClose: () => void };

/**
 * «Nueva capa» in the map's panel (design ma03, José 28/11): a catalog chip with its color, «Todas
 * las calles de la obra» on by default with the metrado, and «Crear capa». Only «Otra…» is typed.
 */
export function NewLayer(props: Props) {
  const [pick, setPick] = useState<LayerPick>(layerPickIdle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiter = useMemo(() => createMapWaiter(LAYER_MAP_WAIT_MS), []);
  useEffect(() => { waiter.offer(props.map); }, [waiter, props.map]);
  const change = (next: Partial<LayerPick>) => { setError(null); setPick((before) => ({ ...before, ...next })); };
  const plan = layerPlanOf(pick);
  const create = async () => {
    setBusy(true);
    const done = await runLayerCreate(props.map, plan, { send: props.send, newEntryId: () => crypto.randomUUID(), findInMap: waiter.find });
    setBusy(false);
    setError(done.failure);
    if (!done.failure && done.workId) props.onCreated(done.workId, done.paint);
  };
  return (
    <div data-testid="mapa-nueva-capa" className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-outline/15 p-4">
        <p className="text-xl font-extrabold text-on-surface">Nuevo trabajo</p>
        <button type="button" aria-label="Cerrar" onClick={props.onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-outline/20 text-on-surface"><X size={16} /></button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section className="space-y-2">
          <p className={KICKER}>Paso 1 · Qué trabajo</p>
          <div role="radiogroup" aria-label="Qué trabajo" className="grid grid-cols-2 gap-2">{layerChoicesOf(props.map).map((choice) => <LayerChip key={choice.key} choice={choice} on={pick.key === choice.key} onPick={() => change({ key: choice.key })} />)}</div>
          <OtherLayer pick={pick} onPick={change} />
        </section>
        <Streets map={props.map} pick={pick} onPick={change} />
      </div>
      <div className="space-y-2 border-t border-outline/15 p-4">
        {error ? <p role="alert" data-testid="capa-error" className="text-[13px] font-semibold text-error">{error}</p> : null}
        <button type="button" data-testid="capa-crear" disabled={busy || !plan} onClick={() => void create()} className="flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-on-surface text-[16px] font-bold text-surface disabled:opacity-50">
          {plan ? <span aria-hidden className="h-4 w-4 rounded-sm" style={{ backgroundColor: plan.color }} /> : null}{layerButtonLabel(plan, busy)}
        </button>
      </div>
    </div>
  );
}
