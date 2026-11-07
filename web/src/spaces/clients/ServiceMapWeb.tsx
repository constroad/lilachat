import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { noticeOf, type ChannelLinks, type ServiceMapDeps, type ServiceMapResult, type ShortcutRow, type ShortcutValues } from '@lilachat/shared';
import { runShortcut, submitAppForm } from '../../chat/commands/commandsApi';
import { currentSocket } from '../../useSocket';

/** How a chat runs the link action for the map. */
export const mapDepsOf = (jwt: string, chatId: string) => (row: ShortcutRow, values: ShortcutValues): ServiceMapDeps => ({
  open: () => runShortcut(jwt, { chatId }, row, values),
  submit: (commandId, answers) => submitAppForm(jwt, { chatId }, commandId, answers),
  notice: (commandId) => noticeOf(currentSocket(), commandId),
});

/**
 * «Mapa» of a service on the web (José 06/11). Portal's page refuses to live in a frame, so it
 * opens in its own tab; the link is ready before the tap because a browser blocks a tab opened
 * after waiting for an answer.
 */
export function ServiceMapWeb(props: { links: ChannelLinks; target: { kind: 'service'; clientId: string; serviceId: string } }) {
  const [map, setMap] = useState<ServiceMapResult | null>(null);
  const [round, setRound] = useState(0);
  const links = useRef(props.links);
  links.current = props.links;
  const { clientId, serviceId } = props.target;
  useEffect(() => {
    let alive = true;
    setMap(null);
    void links.current.map({ kind: 'service', clientId, serviceId }).then((result) => {
      if (alive) setMap(result);
    });
    return () => {
      alive = false;
    };
  }, [clientId, serviceId, round]);
  if (!map) return <div data-testid="mapa-cargando" className="h-28 animate-pulse rounded-2xl bg-surface-variant" />;
  if (!map.ok) {
    return (
      <div data-testid="mapa-fallo" className="rounded-2xl border border-outline/15 bg-surface p-4">
        <p className="text-[15px] font-semibold">{map.message}</p>
        <button type="button" data-testid="mapa-reintentar" onClick={() => setRound((count) => count + 1)} className="mt-3 min-h-[44px] w-full rounded-xl border border-primary/30 bg-primary/10 font-semibold text-primary">Reintentar</button>
      </div>
    );
  }
  return (
    <div data-testid="mapa-servicio" className="rounded-2xl border border-outline/15 bg-surface p-4">
      <p className="text-[15px] font-semibold">Mapa de la obra</p>
      <p className="mt-1 text-sm text-on-surface-variant">Se abre en otra pestaña, sin montos.</p>
      <a data-testid="mapa-abrir" href={map.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-on-primary"><ExternalLink size={16} /> Abrir el mapa</a>
    </div>
  );
}
