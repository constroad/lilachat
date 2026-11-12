import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ExternalLink, Ruler, Trash2 } from 'lucide-react';
import { AREA_REMOVE_FAILED, AREA_REMOVED, AREA_TYPE, areaCardLines, areaCreateRequest, areaDraftKey, areaRemoveAsk, areaRemoveRequest, areaTotalsLine, areaWriteStore, isRemovableArea, readAreaDraft, reportTypeLabel, runStreetDelete, sendMapTool, STREET_DELETE_ASKING, STREET_DELETE_IDLE, type AdditionalArea, type AreaDocument, type AreaPhoto, type AreaDraftPoint, type EvidenceFile, type SpaceClientService, type StreetDeleteState, type WorkProgressResult } from '@lilachat/shared';
import { isIos } from '../../../pwa/iosInstall';
import { observationWriteDeps, prepared, type DriveFile } from '../useDriveUpload';
import { fieldPointNow } from '../observations/ObservationFormsWeb';
import { useReportDraftRead } from '../reports/useReportDraftRead';
import type { ServiceAskTarget } from '../useServiceAsk';
import { AreaMeasureForm, type MeasuredArea } from './AreaMeasureWeb';

/**
 * The additional-area report from the client's channel (José 12/11, option B;
 * Portal's agreed contract): the total, each area with how it was measured,
 * and «Nueva área». On an iPhone the area is measured with Apple's «Medición»
 * and its picture goes marked as the capture; Portal keeps it `manual: true`.
 */
type Props = { target: ServiceAskTarget; chatId: string; service: SpaceClientService; reportId?: string; portalUrl?: string; iphone?: boolean; onClose: (changed: boolean) => void };

const hasDraft = (serviceId: string): boolean => {
  try {
    return localStorage.getItem(areaDraftKey(serviceId)) !== null;
  } catch {
    return false;
  }
};

type AreaRemoveSend = (areaId: string) => Promise<WorkProgressResult>;

/** «Quitar área» (Portal's `quitar`): it asks first, naming the area, and keeps Portal's refusal in sight. */
function AreaRemove({ area, send }: { area: AdditionalArea; send: AreaRemoveSend }) {
  const [{ asking, busy, error }, setState] = useState<StreetDeleteState>(STREET_DELETE_IDLE);
  const ask = areaRemoveAsk(area.item);
  if (!asking) {
    return <button type="button" data-testid={`quitar-area-${area.id}`} onClick={() => setState(STREET_DELETE_ASKING)} aria-label={ask.title} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-background hover:text-error"><Trash2 size={17} /></button>;
  }
  return (
    <div role="alertdialog" aria-label={ask.title} className="basis-full rounded-xl border border-error/30 bg-error/5 p-3">
      <p className="text-[14px] font-bold">{ask.title}</p>
      <p className="mt-1 text-[12px] text-on-surface-variant">{ask.hint}</p>
      {error ? <p role="alert" className="mt-2 text-[13px] font-semibold text-error">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setState(STREET_DELETE_IDLE)} disabled={busy} className="h-11 flex-1 rounded-xl border border-outline/20 text-[13px] font-semibold">Cancelar</button>
        <button type="button" data-testid={`quitar-area-si-${area.id}`} onClick={() => void runStreetDelete(send, area.id, setState)} disabled={busy} className="h-11 flex-1 rounded-xl bg-error text-[13px] font-bold text-background disabled:opacity-60">{busy ? 'Quitando…' : 'Quitar'}</button>
      </div>
    </div>
  );
}

function AreaCard({ area, remove }: { area: AdditionalArea; remove?: AreaRemoveSend }) {
  const lines = areaCardLines(area);
  const cover = area.photos[0];
  return (
    <li data-testid={`area-${area.id}`} className="flex flex-wrap gap-3 rounded-xl border border-outline/20 bg-surface p-3">
      {cover ? <img src={cover.thumbUrl ?? cover.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-surface-variant"><Ruler size={20} className="text-on-surface-variant" /></span>}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-sm font-bold text-primary">Área {area.item ?? ''}</span>
          <span className="text-lg font-bold tabular-nums">{lines.size}</span>
          {lines.volume ? <span className="text-sm text-on-surface-variant">{lines.volume}</span> : null}
        </p>
        <p className="text-sm text-on-surface-variant">{[lines.sides, lines.method].filter(Boolean).join(' · ')}</p>
        {area.place ? <p className="break-words text-sm">{area.place}</p> : null}
      </div>
      {remove && isRemovableArea(area) ? <AreaRemove area={area} send={remove} /> : null}
    </li>
  );
}

/** One write per saved area; a file keeps its key, so a retry sends only what Portal does not have. */
function useAreaWrite(to: { target: ServiceAskTarget; chatId: string; serviceId: string }, iphone: boolean) {
  const store = useMemo(() => areaWriteStore(), []);
  const { busy, line } = useSyncExternalStore(store.subscribe, store.get);
  const keys = useRef(new WeakMap<File, string>());
  const keyOf = (file: File) => keys.current.get(file) ?? keys.current.set(file, crypto.randomUUID()).get(file)!;
  const save = async (report: AreaDocument | null, area: MeasuredArea): Promise<string | null> => {
    const files: EvidenceFile<DriveFile>[] = await Promise.all(area.photos.map(async (file, index) => ({ key: keyOf(file), ...(await prepared(file)), ...(iphone && index === 0 ? { fields: { captura: 'true' } } : {}) })));
    const request = areaCreateRequest(report, area.entryId, area.figures, area.point, area.method, 'web');
    return store.run(observationWriteDeps(to, request), { place: area.place, note: area.note }, files, 'guardada');
  };
  return { busy, line, save };
}

/** Portal's photos with no area (`fotosSinArea`): under the report, so none stays only in Portal. */
function LoosePhotos({ photos }: { photos: readonly AreaPhoto[] }) {
  if (!photos.length) return null;
  return (
    <section data-testid="fotos-sin-area" className="space-y-2 rounded-xl border border-outline/20 bg-surface p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Fotos sin área ({photos.length})</p>
      <div className="flex gap-2 overflow-x-auto">
        {photos.map((photo) => <a key={photo.url} href={photo.url} target="_blank" rel="noreferrer" className="shrink-0"><img src={photo.thumbUrl ?? photo.url} alt="" className="h-16 w-16 rounded-lg object-cover" /></a>)}
      </div>
    </section>
  );
}

function Failure(props: { message: string; portalUrl?: string; onRetry: () => void }) {
  return (
    <div data-testid="areas-fallo" className="rounded-xl border border-outline/20 bg-surface p-4">
      <p className="font-semibold">{props.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={props.onRetry} className="h-11 rounded-lg border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary">Reintentar</button>
        {props.portalUrl ? <a href={props.portalUrl} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-1.5 rounded-lg border border-outline/30 px-3 text-sm font-semibold"><ExternalLink size={14} /> Abrir el servicio en el Portal</a> : null}
      </div>
    </div>
  );
}

export function AreasWeb(props: Props) {
  const iphone = props.iphone ?? isIos(navigator);
  const { draft, reload } = useReportDraftRead(props.target, props.service.id, AREA_TYPE, props.reportId ?? null, readAreaDraft);
  const report = draft?.ok ? draft.document : null;
  const to = useMemo(() => ({ target: props.target, chatId: props.chatId, serviceId: props.service.id }), [props.target, props.chatId, props.service.id]);
  const write = useAreaWrite(to, iphone);
  // Coming back from Medición, a half-filled area opens by itself.
  const [reading, setReading] = useState<Promise<AreaDraftPoint | null> | null>(() => (hasDraft(props.service.id) ? fieldPointNow() : null));
  const [changed, setChanged] = useState(false);
  // A removed area leaves the table at once: the report is read again after Portal answers.
  const remove = useCallback(async (areaId: string) => {
    const result = await sendMapTool(observationWriteDeps(to, areaRemoveRequest(areaId)), {}, { sent: AREA_REMOVED, failed: AREA_REMOVE_FAILED });
    if (result.ok) {
      setChanged(true);
      reload(report?.id);
    }
    return result;
  }, [to, reload, report?.id]);
  const save = useCallback(async (area: MeasuredArea) => {
    const reportId = await write.save(report, area);
    if (!reportId) return false;
    setChanged(true);
    setReading(null);
    reload(reportId);
    return true;
  }, [write, report, reload]);
  return (
    <div data-testid="areas-web" className="mx-auto flex max-w-2xl flex-col gap-3">
      <header className="flex items-start gap-2">
        <button type="button" onClick={() => props.onClose(changed)} aria-label="Volver" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface"><ChevronLeft size={20} /></button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{reportTypeLabel(AREA_TYPE)}</p>
          <h2 className="truncate text-xl font-bold">{props.service.name}</h2>
        </div>
      </header>
      {draft === null ? <div className="h-40 animate-pulse rounded-xl bg-surface" /> : null}
      {draft && !draft.ok ? <Failure message={draft.message} {...(props.portalUrl ? { portalUrl: props.portalUrl } : {})} onRetry={() => reload()} /> : null}
      {report ? (
        <>
          <p data-testid="areas-total" className="rounded-xl border border-outline/20 bg-surface p-4 text-lg font-bold tabular-nums">{areaTotalsLine({ count: report.areas.length, totals: report.totals })}</p>
          {report.areas.length ? <ul className="space-y-2">{report.areas.map((area) => <AreaCard key={area.id} area={area} remove={remove} />)}</ul> : <p data-testid="areas-vacio" className="py-4 text-center text-sm text-on-surface-variant">Todavía no hay áreas en este informe.</p>}
          <LoosePhotos photos={report.loosePhotos} />
          {reading ? (
            <div className="rounded-xl border border-outline/20 bg-surface p-4 pb-0">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Nueva área</h3><button type="button" onClick={() => setReading(null)} className="h-11 px-3 text-sm font-semibold text-on-surface-variant">Cerrar</button></div>
              <AreaMeasureForm serviceId={props.service.id} iphone={iphone} reading={reading} busy={write.busy} line={write.line} onSave={save} />
            </div>
          ) : (
            <div className="sticky bottom-0 border-t border-outline/10 bg-background py-3">
              <button type="button" data-testid="nueva-area-boton" onClick={() => setReading(fieldPointNow())} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-bold text-on-primary"><Ruler size={18} /> Nueva área</button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
