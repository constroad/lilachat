import { useMemo, useState } from 'react';
import { CheckCircle2, MapPin, SlidersHorizontal } from 'lucide-react';
import { usefulWidthLabel, confirmDischargeLabel, DISCHARGE_HOW, DISCHARGE_TITLE, dischargeExplain, dischargeGaps, dischargeHeadline, dischargeRowsOf, metersLabel, progressEntryOf, stationLabel, stretchWorksOf, type DischargeRow, type DischargeSuggestion, type ProgressEntry, type SuggestedStretch, type WorkMap } from '@lilachat/shared';

export type ProgressSend = (entry: ProgressEntry) => Promise<{ ok: true; message: string } | { ok: false; message: string }>;
type Range = { fromM: number; toM: number };

const KICKER = 'text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant';
const CHIP = 'flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold';
const FIELD = 'h-10 w-full rounded-xl border border-outline/20 bg-surface px-3 text-[14px] text-on-surface';
const STATE_TONE: Record<DischargeRow['state'], string> = { placed: 'border-outline/15', outside: 'border-error/40 bg-error/5', noPlace: 'border-outline/15 opacity-70' };

function UnitRow(props: { row: DischargeRow }) {
  const { row } = props;
  return (
    <li data-testid={`descarga-${row.dispatchId}`} className={`flex items-center gap-3 rounded-xl border bg-surface p-2.5 ${STATE_TONE[row.state]}`}>
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${row.state === 'outside' ? 'bg-error text-on-primary' : 'bg-primary text-on-primary'}`}>{row.number}</span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-on-surface">{row.title}</p>
        <p className={`truncate font-mono text-[12px] ${row.state === 'outside' ? 'text-error' : 'text-on-surface-variant'}`}>{row.line}</p>
      </div>
    </li>
  );
}

function Figures(props: { map: WorkMap; stretch: SuggestedStretch; range: Range }) {
  const { stretch, range } = props;
  return (
    <div className="mt-2 grid grid-cols-3 divide-x divide-outline/15 rounded-xl border border-outline/15">
      <div className="p-2.5">
        <p className={KICKER}>Progresivas</p>
        <p data-testid="avance-progresivas" className="font-mono text-[14px] font-semibold tabular-nums text-on-surface">{stationLabel(range.fromM)} a {stationLabel(range.toM)}</p>
      </div>
      <div className="p-2.5">
        <p className={KICKER}>Volumen</p>
        <p className="font-mono text-[14px] font-semibold tabular-nums text-on-surface">{String(stretch.volumeM3).replace('.', ',')} m³</p>
      </div>
      <div className="p-2.5">
        <p className={KICKER}>Ancho útil</p>
        <p data-testid="avance-ancho-util" className="font-mono text-[14px] font-semibold tabular-nums text-on-surface">{usefulWidthLabel(props.map, stretch.streetId, range)}</p>
      </div>
    </div>
  );
}

function Adjust(props: { range: Range; onRange: (range: Range) => void }) {
  const read = (value: string) => Number(value.replace(',', '.'));
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <label className="text-[12px] text-on-surface-variant">Desde (m)<input data-testid="avance-desde" inputMode="decimal" className={FIELD} defaultValue={props.range.fromM} onChange={(event) => props.onRange({ ...props.range, fromM: read(event.target.value) })} /></label>
      <label className="text-[12px] text-on-surface-variant">Hasta (m)<input data-testid="avance-hasta" inputMode="decimal" className={FIELD} defaultValue={props.range.toM} onChange={(event) => props.onRange({ ...props.range, toM: read(event.target.value) })} /></label>
    </div>
  );
}

/** One stretch: its work, its figures, «Ajustar tramo» and «Confirmar avance». */
function StretchCard(props: { map: WorkMap; serviceId: string; stretch: SuggestedStretch; send?: ProgressSend; range: Range; onRange: (range: Range) => void }) {
  const { map, stretch, range } = props;
  const works = stretchWorksOf(map, stretch.streetId);
  const [workId, setWorkId] = useState(works.length === 1 ? works[0]?.id : undefined);
  const [adjusting, setAdjusting] = useState(false);
  const [entryId] = useState(() => crypto.randomUUID());
  const [answer, setAnswer] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const street = map.streets.find((one) => one.id === stretch.streetId);
  const label = confirmDischargeLabel({ lengthM: range.toM - range.fromM });
  const confirm = async () => {
    const built = progressEntryOf({ serviceId: props.serviceId, stretch, ...range, work: works.find((one) => one.id === workId), entryId, now: new Date(), streetLengthM: street?.lengthM ?? 0 });
    if (!built.ok || !props.send) return setAnswer({ ok: false, message: built.ok ? '' : built.message });
    setBusy(true);
    setAnswer(await props.send(built.entry));
    setBusy(false);
  };
  return (
    <section data-testid={`tramo-sugerido-${stretch.streetId}`} className="rounded-xl border border-outline/15 bg-surface p-3">
      <p className="text-[15px] font-semibold text-on-surface">{stretch.streetName}</p>
      <p className="font-mono text-[22px] font-bold tabular-nums text-on-surface">+{metersLabel(Math.max(0, range.toM - range.fromM))}</p>
      <p data-testid="avance-explica" className="mt-1 text-[13px] text-on-surface-variant">{dischargeExplain({ ...stretch, ...range })}</p>
      {works.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {works.map((work) => (
            <button key={work.id} type="button" data-testid={`avance-trabajo-${work.id}`} aria-pressed={workId === work.id} onClick={() => setWorkId(work.id)} className={`${CHIP} ${workId === work.id ? 'border-primary bg-primary text-on-primary' : 'border-outline/20 bg-surface text-on-surface'}`}>
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: work.color }} />{work.name}
            </button>
          ))}
        </div>
      ) : null}
      <Figures map={props.map} stretch={stretch} range={range} />
      {adjusting ? <Adjust range={range} onRange={props.onRange} /> : null}
      {props.send ? (
        <div className="mt-3 grid gap-2">
          <button type="button" data-testid="avance-confirmar" disabled={busy || !label} onClick={() => void confirm()} className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-on-primary disabled:opacity-50"><CheckCircle2 size={16} /> {label ?? 'Ajusta el tramo para confirmar'}</button>
          <button type="button" data-testid="avance-ajustar" onClick={() => setAdjusting((shown) => !shown)} className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-outline/20 text-[14px] font-semibold text-on-surface"><SlidersHorizontal size={16} /> Ajustar tramo</button>
        </div>
      ) : null}
      {answer ? <p role="status" data-testid="avance-respuesta" className={`mt-2 text-[13px] ${answer.ok ? 'text-on-surface' : 'text-error'}`}>{answer.message}</p> : null}
    </section>
  );
}

/** «Avance sugerido» (design `o-07-mapa-pista`): where the units emptied, as the stretch to confirm. Admins only. */
export function WorkMapDischarges(props: { map: WorkMap; serviceId: string; suggestion: DischargeSuggestion; send?: ProgressSend; ranges: Record<string, Range>; onRange: (streetId: string, range: Range) => void }) {
  const rows = useMemo(() => dischargeRowsOf(props.suggestion), [props.suggestion]);
  return (
    <div data-testid="avance-sugerido" className="space-y-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className={KICKER}>Control de pista</p>
          <p className="text-[15px] font-semibold text-on-surface">{DISCHARGE_TITLE}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-on-surface-variant"><MapPin size={13} />{DISCHARGE_HOW}</p>
        </div>
        <span data-testid="avance-listas" className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase text-primary">{dischargeHeadline(props.suggestion)}</span>
      </header>
      {dischargeGaps(props.suggestion) ? <p data-testid="avance-sin-ubicar" className="rounded-xl border border-outline/15 bg-surface px-3 py-2 text-[12px] text-on-surface-variant">No suman: {dischargeGaps(props.suggestion)}.</p> : null}
      {props.suggestion.stretches.map((stretch) => (
        <StretchCard key={stretch.streetId} map={props.map} serviceId={props.serviceId} stretch={stretch} send={props.send} range={props.ranges[stretch.streetId] ?? stretch} onRange={(range) => props.onRange(stretch.streetId, range)} />
      ))}
      <p className={KICKER}>Descargas registradas ({rows.length})</p>
      <ul className="space-y-2">{rows.map((row) => <UnitRow key={row.dispatchId} row={row} />)}</ul>
    </div>
  );
}
