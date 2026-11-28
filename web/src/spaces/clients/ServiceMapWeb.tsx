import type { LiftRow } from './workMap/WorkMapItems';
import { useState, type ReactNode } from 'react';
import { deleteThenReload, editThenReload, noticeOf, type ManualPhotoUpload, type MapEditSend, type TraceUpload, type ServiceMapInReport, serviceMapPage, type ChannelLinks, type ServiceMapDeps, type ShortcutRow, type ShortcutValues, type UnitDischarge, type MapPhoto } from '@lilachat/shared';
import { runShortcut, submitAppForm } from '../../chat/commands/commandsApi';
import { currentSocket } from '../../useSocket';
import { useWorkMap } from './workMap/useWorkMap';
import { MAP_HEAD_BAR, WorkMapBoard } from './workMap/WorkMapBoard';
import type { ProgressSend } from './workMap/WorkMapDischarges';
import { WorkMapFirst } from './workMap/WorkMapFirst';
import { EMPTY_WORK_MAP } from '@lilachat/shared';
import { ImportTrace } from './workMap/ImportTrace';
import { WorkStreetEditor } from './workMap/WorkStreetEditor';
import { WorkStreetBatch } from './workMap/WorkStreetBatch';
import { ServiceCroquisButton } from './workMap/ServiceCroquis';
import { placeAsker, type StreetSend } from './workMap/workProgressSender';
import type { StreetDeleteSend } from './workMap/StreetDelete';

/** How a chat runs the link action for the map. */
export const mapDepsOf = (jwt: string, chatId: string) => (row: ShortcutRow, values: ShortcutValues): ServiceMapDeps => ({
  open: () => runShortcut(jwt, { chatId }, row, values),
  submit: (commandId, answers) => submitAppForm(jwt, { chatId }, commandId, answers),
  notice: (commandId) => noticeOf(currentSocket(), commandId),
});

/**
 * «Mapa» of a service on the web (José 06/11: «el mapa literal de la obra»). Lilachat draws it with
 * what Portal shows a client; Portal's own page stays one tap away, opened from a link that is
 * ready before the tap because a browser blocks a tab opened after waiting for an answer.
 */
/** The map loads, fails or has nothing yet under the service's bar, with the page's padding. */
function Frame(props: { head?: ReactNode; children: ReactNode }) {
  if (!props.head) return <div className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-6"><div className="mx-auto w-full max-w-3xl">{props.children}</div></div>;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className={`${MAP_HEAD_BAR} pb-0`}><div className="min-w-0 flex-1">{props.head}</div></header>
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6">{props.children}</div>
    </div>
  );
}

type MapProps = { /** «Levantar» on an open observation (José 27/11). */ onLift?: (row: LiftRow) => void; jwt: string; links: ChannelLinks; target: { kind: 'service'; clientId: string; serviceId: string }; title: string; head?: ReactNode; badge?: ReactNode; /** Where the streets are drawn today (Portal's «Mapa» tab). */ drawUrl?: string | null; discharges?: UnitDischarge[]; /** Field photos with their place (José 08/11). */ mapPhotos?: MapPhoto[]; /** The service's place (Portal da5382a5). */ start?: { lat: number; lng: number }; send?: ProgressSend; /** «Guardar calle» (o-02): everyone draws (José 07/11). */ drawStreet?: StreetSend; /** «Borrar calle»: anyone, an admin restores (José 07/11). */ deleteStreet?: StreetDeleteSend; /** Stretches, stages and works (o-03 to o-05). */ editMap?: MapEditSend; /** A space admin: «Borrados» (José 07/11). */ admin?: boolean; /** Photos of «Registrar avance» (o-06). */ uploadPhoto?: ManualPhotoUpload<File>; /** KMZ or KML for «Importar» (o-12). */ uploadTrace?: TraceUpload<File>; /** «Incluir en el informe» as Portal has it. */ mapInReport?: ServiceMapInReport };

const CROQUIS_FIRST = 'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-primary/30 text-[15px] font-semibold text-primary';

/** Without streets nor drawings: import a trace, or draw the first croquis in Portal's editor (José 19/11). */
function TraceAndCroquis(props: { send: MapEditSend; upload?: TraceUpload<File>; title: string; onDone: () => void }) {
  return (
    <div className="space-y-2">
      {props.upload ? <ImportTrace send={props.send} upload={props.upload} /> : null}
      <ServiceCroquisButton send={props.send} title={props.title} onDone={props.onDone} className={CROQUIS_FIRST} />
    </div>
  );
}

export function ServiceMapWeb(props: MapProps) {
  const { state, retry, refresh } = useWorkMap(props.jwt, props.links, props.target);
  /** `area`: ma02's several streets; `single`: the one-street editor (o-02). */
  const [drawing, setDrawing] = useState<'area' | 'single' | null>(null);
  /** What the last save answered («Calle guardada…»): the editor closes, so the board says it. */
  const [notice, setNotice] = useState<string | null>(null);
  const drawWith = (way: 'area' | 'single') => (props.drawStreet ? () => { setNotice(null); setDrawing(way); } : undefined);
  const onDraw = drawWith('single');
  const saved = (message: string) => { setNotice(message); setDrawing(null); void retry(); };
  const pageOf = (url: string) => serviceMapPage(url, props.target.serviceId);
  const deleteStreet = deleteThenReload(props.deleteStreet, refresh);
  const editMap = editThenReload(props.editMap, refresh);
  if (state.kind === 'loading') return <Frame head={props.head}><div data-testid="mapa-cargando" className="h-[60vh] animate-pulse rounded-2xl bg-surface-variant" /></Frame>;
  if (state.kind === 'failed') {
    return (
      <Frame head={props.head}>
      <div data-testid="mapa-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
        <p className="text-[15px] font-semibold">{state.message}</p>
        <button type="button" data-testid="mapa-reintentar" onClick={() => void retry()} className="mt-3 min-h-[44px] w-full rounded-xl border border-primary/30 text-[14px] font-semibold text-primary">Reintentar</button>
        {state.url ? <a data-testid="mapa-abrir" href={pageOf(state.url)} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-[13px] font-semibold text-primary">Abrir en Portal</a> : null}
      </div>
      </Frame>
    );
  }
  if (drawing === 'single' && props.drawStreet) return <WorkStreetEditor title={props.title} map={state.map} send={props.drawStreet} findPlace={placeAsker(props.jwt)} start={props.start} onClose={() => setDrawing(null)} onSaved={saved} />;
  if (drawing === 'area' && props.drawStreet) return <WorkStreetBatch title={props.title} map={state.map} send={props.drawStreet} start={props.start} onClose={() => setDrawing(null)} onSaved={saved} onPartial={() => void refresh()} />;
  // Photos or units with a place and no street yet: the map still shows where they are (Portal via José 09/11).
  const media = Boolean(props.mapPhotos?.length || props.discharges?.length);
  if (!state.map && !media) return <Frame head={props.head}><WorkMapFirst drawUrl={props.drawUrl ?? null} onDraw={onDraw} trace={editMap ? <TraceAndCroquis send={editMap} upload={props.uploadTrace} title={props.title} onDone={() => void refresh()} /> : null} /></Frame>;
  return <WorkMapBoard onLift={props.onLift} map={state.map ?? EMPTY_WORK_MAP} pageUrl={pageOf(state.url)} title={props.title} serviceId={props.target.serviceId} head={props.head} badge={props.badge} discharges={props.discharges} mapPhotos={props.mapPhotos} send={props.send} onDraw={onDraw} onArea={drawWith('area')} deleteStreet={deleteStreet} editMap={editMap} admin={props.admin} uploadPhoto={props.uploadPhoto} uploadTrace={props.uploadTrace} mapInReport={props.mapInReport} notice={notice} reload={() => void refresh()} />;
}
