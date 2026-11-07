import type { ReactNode } from 'react';
import { noticeOf, serviceMapPage, WORK_MAP_EMPTY, type ChannelLinks, type ServiceMapDeps, type ShortcutRow, type ShortcutValues, type UnitDischarge } from '@lilachat/shared';
import { runShortcut, submitAppForm } from '../../chat/commands/commandsApi';
import { currentSocket } from '../../useSocket';
import { useWorkMap } from './workMap/useWorkMap';
import { MAP_HEAD_BAR, WorkMapBoard } from './workMap/WorkMapBoard';
import type { ProgressSend } from './workMap/WorkMapDischarges';

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
function Frame(props: { head?: ReactNode; children: ReactNode }) {
  if (!props.head) return <>{props.children}</>;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className={`${MAP_HEAD_BAR} pb-0`}><div className="min-w-0 flex-1">{props.head}</div></header>
      <div className="mx-auto w-full max-w-3xl p-4 md:p-6">{props.children}</div>
    </div>
  );
}

type MapProps = { jwt: string; links: ChannelLinks; target: { kind: 'service'; clientId: string; serviceId: string }; title: string; head?: ReactNode; badge?: ReactNode; admin?: boolean; discharges?: UnitDischarge[]; send?: ProgressSend };

export function ServiceMapWeb(props: MapProps) {
  const { state, retry } = useWorkMap(props.jwt, props.links, props.target);
  const pageOf = (url: string) => serviceMapPage(url, props.target.serviceId);
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
  if (!state.map) {
    return (
      <Frame head={props.head}>
      <div data-testid="mapa-vacio" className="rounded-2xl border border-outline/15 bg-surface p-4 text-[14px] text-on-surface-variant">
        {WORK_MAP_EMPTY}
        <a data-testid="mapa-abrir" href={pageOf(state.url)} target="_blank" rel="noopener noreferrer" className="mt-2 block text-[13px] font-semibold text-primary">Abrir en Portal</a>
      </div>
      </Frame>
    );
  }
  return <WorkMapBoard map={state.map} pageUrl={pageOf(state.url)} title={props.title} serviceId={props.target.serviceId} head={props.head} badge={props.badge} admin={props.admin} discharges={props.discharges} send={props.send} />;
}
