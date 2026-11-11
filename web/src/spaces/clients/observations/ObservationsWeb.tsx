import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { evidenceFiles, observationCounts, observationPins, observationPlace, observationWorkMap, readObservationDraft, registeredLine, reportTypeLabel, STATUS_PILLS, type Observation, type ObservationDocument, type ObservationDraftResult, type ObservationStatus, type SpaceClientService } from '@lilachat/shared';
import { lazyChunk } from '../../../ui/lazyChunk';
import { FileThumb, usePortalFileViewer } from '../PortalFileViewer';
import { askReportDraft } from '../reports/reportsApi';
import type { ServiceAskTarget } from '../useServiceAsk';

const WorkMapCanvas = lazyChunk(() => import('../workMap/WorkMapCanvas'));

type Props = { target: ServiceAskTarget; chatId: string; service: SpaceClientService; type: string; reportId?: string; portalUrl?: string; onClose: (changed: boolean) => void };
type Filter = 'all' | ObservationStatus;
const FILTERS: { key: Filter; label: string }[] = [{ key: 'all', label: 'Todas' }, { key: 'open', label: 'Pendientes' }, { key: 'lifted', label: 'Levantadas' }];
const PILL_CLASS = { error: 'border-error/30 bg-error/10 text-error', ok: 'border-en-linea/30 bg-en-linea/10 text-en-linea' } as const;

/** The report as Portal answers it (agentes sends REG-OBS and LEV-OBS to `informe_de_observaciones`). */
function useObservationDraft(target: ServiceAskTarget, serviceId: string, type: string, reportId: string | null) {
  const [draft, setDraft] = useState<ObservationDraftResult | null>(null);
  const load = useCallback(async () => {
    setDraft(null);
    const reply = await askReportDraft(target, serviceId, type, reportId);
    setDraft(readObservationDraft(reply.ok ? reply.data : { message: reply.message }));
  }, [target, serviceId, type, reportId]);
  useEffect(() => {
    void load();
  }, [load]);
  return { draft, reload: load };
}

/** Total, lifted, pending and progress, with the bar (design `ob-07b`). */
function Totals({ observations }: { observations: readonly Observation[] }) {
  const counts = observationCounts(observations);
  const cells = [
    { testId: 'obs-total', label: 'Total', value: String(counts.total), tone: 'text-on-surface' },
    { testId: 'obs-levantadas', label: 'Levantadas', value: String(counts.lifted), tone: 'text-en-linea' },
    { testId: 'obs-pendientes', label: 'Pendientes', value: String(counts.open), tone: 'text-error' },
    { testId: 'obs-avance', label: 'Avance', value: `${counts.percent} %`, tone: 'text-primary' },
  ];
  return (
    <section className="rounded-xl border border-outline/20 bg-surface p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Estado de las observaciones</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.testId} data-testid={cell.testId} className="rounded-lg border border-outline/20 p-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">{cell.label}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${cell.tone}`}>{cell.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-error/80">
        <div className="bg-en-linea" style={{ width: `${counts.percent}%` }} />
      </div>
    </section>
  );
}

function ObservationMap({ report }: { report: ObservationDocument }) {
  const view = useMemo(() => observationWorkMap(report.map, report.observations), [report]);
  const pins = useMemo(() => observationPins(report.observations), [report]);
  return (
    <section className="relative h-[360px] overflow-hidden rounded-xl border border-outline/20 bg-surface-variant">
      <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-surface-variant" />}>
        <WorkMapCanvas view={view} expanded={false} pins={pins} />
      </Suspense>
    </section>
  );
}

/** Before and after of one observation, opened under its row. */
function ObservationDetail({ observation, onOpen }: { observation: Observation; onOpen: ReturnType<typeof usePortalFileViewer>['open'] }) {
  const before = evidenceFiles(observation.media, `${observation.code} · antes`);
  const after = evidenceFiles(observation.liftMedia, `${observation.code} · después`);
  const strip = (files: typeof before, label: string) => (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {files.length ? files.map((file) => <button key={file.url} type="button" onClick={() => onOpen(file, files)} className="overflow-hidden rounded-lg"><FileThumb file={file} size={72} /></button>) : <span className="text-sm text-on-surface-variant">Sin fotos ni videos.</span>}
      </div>
    </div>
  );
  return (
    <div data-testid={`detalle-${observation.code}`} className="grid gap-3 border-t border-outline/15 px-4 py-3 sm:grid-cols-2">
      {strip(before, 'Antes')}
      <div>
        {strip(after, 'Después')}
        {observation.status === 'lifted' ? <p className="mt-2 text-sm text-on-surface-variant">{registeredLine({ at: observation.liftedAt ?? null }, 'Levantada')}</p> : null}
        {observation.liftNote ? <p className="mt-1 text-sm">{observation.liftNote}</p> : null}
      </div>
    </div>
  );
}

function ObservationRow(props: { observation: Observation; place: string; open: boolean; onToggle: () => void; onOpen: ReturnType<typeof usePortalFileViewer>['open'] }) {
  const { observation } = props;
  const pill = STATUS_PILLS[observation.status];
  const first = evidenceFiles(observation.media, observation.code)[0];
  return (
    <li className="rounded-xl border border-outline/20 bg-surface">
      <button type="button" data-testid={`observacion-${observation.code}`} onClick={props.onToggle} className="flex w-full items-center gap-3 p-3 text-left hover:bg-background">
        {first ? <FileThumb file={first} size={52} /> : <span className="h-[52px] w-[52px] rounded-lg bg-surface-variant" />}
        <span className="min-w-0 flex-1">
          <span className="font-mono text-[13px] font-bold text-primary">{observation.code}</span>
          <span className="ml-2 font-mono text-[12px] text-on-surface-variant">{registeredLine(observation)}</span>
          <span className="block truncate font-semibold">{observation.note}</span>
          <span className="block truncate text-[13px] text-on-surface-variant">{props.place}</span>
        </span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${PILL_CLASS[pill.tone]}`}>{pill.label}</span>
      </button>
      {props.open ? <ObservationDetail observation={observation} onOpen={props.onOpen} /> : null}
    </li>
  );
}

function ObservationTable({ report, onOpen }: { report: ObservationDocument; onOpen: ReturnType<typeof usePortalFileViewer>['open'] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [opened, setOpened] = useState<string | null>(null);
  const shown = filter === 'all' ? report.observations : report.observations.filter((one) => one.status === filter);
  return (
    <section className="space-y-2">
      <div className="inline-flex rounded-lg border border-outline/20 bg-surface p-1">
        {FILTERS.map((one) => (
          <button key={one.key} type="button" data-testid={`filtro-${one.key}`} onClick={() => setFilter(one.key)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${filter === one.key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'}`}>
            {one.key === 'all' ? `${one.label} (${report.observations.length})` : one.label}
          </button>
        ))}
      </div>
      {shown.length ? (
        <ul className="space-y-2">{shown.map((one) => <ObservationRow key={one.id} observation={one} place={observationPlace(one, report.map)} open={opened === one.id} onToggle={() => setOpened(opened === one.id ? null : one.id)} onOpen={onOpen} />)}</ul>
      ) : <p className="py-6 text-center text-sm text-on-surface-variant">No hay observaciones aquí.</p>}
    </section>
  );
}

/**
 * The office's view of the observations (José 11/11, design `ob-07b`): totals,
 * map and the list with each before and after. Registering and lifting happen
 * in the field, in the APK; publishing, in Portal for now (Portal ead85b1a).
 */
export function ObservationsWeb(props: Props) {
  const { draft, reload } = useObservationDraft(props.target, props.service.id, props.type, props.reportId ?? null);
  const viewer = usePortalFileViewer();
  const report = draft?.ok ? draft.document : null;
  return (
    <div data-testid="observaciones-web" className="mx-auto flex max-w-4xl flex-col gap-3">
      <header className="flex items-start gap-2">
        <button type="button" data-testid="volver-observaciones" onClick={() => props.onClose(false)} aria-label="Volver" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface"><ChevronLeft size={20} /></button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{reportTypeLabel(props.type)}</p>
          <h2 className="truncate text-xl font-bold">{props.service.name}</h2>
        </div>
        {props.portalUrl ? <a href={props.portalUrl} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-1.5 rounded-lg border border-outline/30 px-3 text-sm font-semibold"><ExternalLink size={14} /> Portal</a> : null}
      </header>
      {draft === null ? <div data-testid="observaciones-cargando" className="h-48 animate-pulse rounded-xl bg-surface" /> : null}
      {draft && !draft.ok ? (
        <div data-testid="observaciones-fallo" className="rounded-xl border border-outline/20 bg-surface p-4">
          <p className="font-semibold">{draft.message}</p>
          <button type="button" onClick={() => void reload()} className="mt-3 h-9 rounded-lg border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary">Reintentar</button>
        </div>
      ) : null}
      {report ? (
        <>
          <Totals observations={report.observations} />
          <ObservationMap report={report} />
          <ObservationTable report={report} onOpen={viewer.open} />
          {report.publish.missing[0] ? <p data-testid="publicar-desde-portal" className="text-center text-sm text-on-surface-variant">{report.publish.missing[0]}</p> : null}
        </>
      ) : null}
      {viewer.viewer}
    </div>
  );
}
