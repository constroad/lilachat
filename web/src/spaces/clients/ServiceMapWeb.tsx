import { noticeOf, serviceMapPage, WORK_MAP_EMPTY, type ChannelLinks, type ServiceMapDeps, type ShortcutRow, type ShortcutValues } from '@lilachat/shared';
import { runShortcut, submitAppForm } from '../../chat/commands/commandsApi';
import { currentSocket } from '../../useSocket';
import { useWorkMap } from './workMap/useWorkMap';
import { WorkMapBoard } from './workMap/WorkMapBoard';

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
export function ServiceMapWeb(props: { jwt: string; links: ChannelLinks; target: { kind: 'service'; clientId: string; serviceId: string } }) {
  const { state, retry } = useWorkMap(props.jwt, props.links, props.target);
  const pageOf = (url: string) => serviceMapPage(url, props.target.serviceId);
  if (state.kind === 'loading') return <div data-testid="mapa-cargando" className="h-28 animate-pulse rounded-2xl bg-surface-variant" />;
  if (state.kind === 'failed') {
    return (
      <div data-testid="mapa-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
        <p className="text-[15px] font-semibold">{state.message}</p>
        <button type="button" data-testid="mapa-reintentar" onClick={() => void retry()} className="mt-3 min-h-[44px] w-full rounded-xl border border-primary/30 text-[14px] font-semibold text-primary">Reintentar</button>
        {state.url ? <a data-testid="mapa-abrir" href={pageOf(state.url)} target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-[13px] font-semibold text-primary">Abrir en Portal</a> : null}
      </div>
    );
  }
  if (!state.map) return <p data-testid="mapa-vacio" className="rounded-2xl border border-outline/15 bg-surface p-4 text-[14px] text-on-surface-variant">{WORK_MAP_EMPTY}</p>;
  return <WorkMapBoard map={state.map} pageUrl={pageOf(state.url)} />;
}
