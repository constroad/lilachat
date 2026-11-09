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
/** The bar of the workspace stays while the map loads or fails, so the tabs are always there. */
function Frame(props: { head?: ReactNode; tabs?: ReactNode; children: ReactNode }) {
  if (!props.head) return <>{props.children}</>;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className={`${MAP_HEAD_BAR} pb-0`}><div className="min-w-0 flex-1">{props.head}{props.tabs}</div></header>
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6">{props.children}</div>
    </div>
  );
}

type MapProps = { jwt: string; links: ChannelLinks; target: { kind: 'service'; clientId: string; serviceId: string }; title: string; head?: ReactNode; tabs?: ReactNode; badge?: ReactNode; /** Where the streets are drawn today (Portal's «Mapa» tab). */ drawUrl?: string | null; discharges?: UnitDischarge[]; /** Field photos with their place (José 08/11). */ mapPhotos?: MapPhoto[]; /** The service's place (Portal da5382a5). */ start?: { lat: number; lng: number }; send?: ProgressSend; /** «Guardar calle» (o-02): everyone draws (José 07/11). */ drawStreet?: StreetSend; /** «Borrar calle»: anyone, an admin restores (José 07/11). */ deleteStreet?: StreetDeleteSend; /** Stretches, stages and works (o-03 to o-05). */ editMap?: MapEditSend; /** A space admin: «Borrados» (José 07/11). */ admin?: boolean; /** Photos of «Registrar avance» (o-06). */ uploadPhoto?: ManualPhotoUpload<File>; /** KMZ or KML for «Importar» (o-12). */ uploadTrace?: TraceUpload<File>; /** «Incluir en el informe» as Portal has it. */ mapInReport?: ServiceMapInReport };

export function ServiceMapWeb(props: MapProps) {
  const { state, retry, refresh } = useWorkMap(props.jwt, props.links, props.target);
  const [drawing, setDrawing] = useState(false);
  /** What the last save answered («Calle guardada…»): the editor closes, so the board says it. */
  const [notice, setNotice] = useState<string | null>(null);
  const onDraw = props.drawStreet ? () => { setNotice(null); setDrawing(true); } : undefined;
  const pageOf = (url: string) => serviceMapPage(url, props.target.serviceId);
  const deleteStreet = deleteThenReload(props.deleteStreet, refresh);
  const editMap = editThenReload(props.editMap, refresh);
  if (state.kind === 'loading') return <Frame head={props.head} tabs={props.tabs}><div data-testid="mapa-cargando" className="h-[60vh] animate-pulse rounded-2xl bg-surface-variant" /></Frame>;
  if (state.kind === 'failed') {
    return (
      <Frame head={props.head} tabs={props.tabs}>
      <div data-testid="mapa-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
        <p className="text-[15px] font-semibold">{state.message}</p>
        <button type="button" data-testid="mapa-reintentar" onClick={() => void retry()} className="mt-3 min-h-[44px] w-full rounded-xl border border-primary/30 text-[14px] font-semibold text-primary">Reintentar</button>
        {state.url ? <a data-testid="mapa-abrir" href={pageOf(state.url)} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-[13px] font-semibold text-primary">Abrir en Portal</a> : null}
      </div>
      </Frame>
    );
  }
  if (drawing && props.drawStreet) return <WorkStreetEditor title={props.title} map={state.map} send={props.drawStreet} findPlace={placeAsker(props.jwt)} start={props.start} onClose={() => setDrawing(false)} onSaved={(message) => { setNotice(message); setDrawing(false); void retry(); }} />;
  // Photos or units with a place and no street yet: the map still shows where they are (Portal via José 09/11).
  const media = Boolean(props.mapPhotos?.length || props.discharges?.length);
  if (!state.map && !media) return <Frame head={props.head} tabs={props.tabs}><WorkMapFirst drawUrl={props.drawUrl ?? null} onDraw={onDraw} trace={editMap && props.uploadTrace ? <ImportTrace send={editMap} upload={props.uploadTrace} /> : null} /></Frame>;
  return <WorkMapBoard map={state.map ?? EMPTY_WORK_MAP} pageUrl={pageOf(state.url)} title={props.title} serviceId={props.target.serviceId} head={props.head} tabs={props.tabs} badge={props.badge} discharges={props.discharges} mapPhotos={props.mapPhotos} send={props.send} onDraw={onDraw} deleteStreet={deleteStreet} editMap={editMap} admin={props.admin} uploadPhoto={props.uploadPhoto} uploadTrace={props.uploadTrace} mapInReport={props.mapInReport} notice={notice} />;
}
