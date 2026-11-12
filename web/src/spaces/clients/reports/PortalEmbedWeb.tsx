import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { EMBED_FAILED, PORTAL_EMBED_ORIGINS, embedCloseRequest, embedErrorLine, embedEventOf, embedLinkOf, embedTheme, reportEmbedPath, type EmbedBody, type EmbedCommand, type EmbedLink, type ServiceReport } from '@lilachat/shared';
import { api } from '../../../api';
import type { ServiceAskTarget } from '../useServiceAsk';

/**
 * Portal's canvas editor of a report, framed over the whole window (Portal
 * 11/11, José: every member edits, only admins delete, versions restorable in
 * Portal). One bar, Portal's (José 12/11: «doble toolbar para regresar»): its
 * «Cerrar editor» saves and posts `closed`. Lilachat's bar shows only while
 * Portal is not ready or failed; Escape asks Portal to close.
 */
type Props = { target: ServiceAskTarget; serviceId: string; serviceName: string; report: Pick<ServiceReport, 'id' | 'title' | 'url'>; onClose: (changed: boolean) => void };
type LinkState = { kind: 'asking' } | { kind: 'ready'; link: EmbedLink } | { kind: 'failed'; message: string };

/** The dev web frames the local Portal too; the built one, production only (its CSP frames nothing else). */
const FRAMED_ORIGINS: readonly string[] = import.meta.env.DEV ? [PORTAL_EMBED_ORIGINS.production, PORTAL_EMBED_ORIGINS.development] : [PORTAL_EMBED_ORIGINS.production];
/** With nothing unsaved, Portal answers at once; a frame that does not answer does not keep the person in. */
const CLOSE_WAIT_MS = 3000;

function useEmbedLink(target: ServiceAskTarget, serviceId: string, reportId: string) {
  const { jwt, spaceId, clientId } = target;
  const [state, setState] = useState<LinkState>({ kind: 'asking' });
  const [round, setRound] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ kind: 'asking' });
    void api<EmbedBody>(reportEmbedPath(spaceId, clientId, serviceId, reportId), { jwt }).then((reply) => {
      if (!alive) return;
      const link = reply.ok ? embedLinkOf(reply.data.embed, FRAMED_ORIGINS) : null;
      setState(link ? { kind: 'ready', link } : { kind: 'failed', message: reply.ok ? reply.data.message ?? EMBED_FAILED : reply.message });
    });
    return () => { alive = false; };
  }, [jwt, spaceId, clientId, serviceId, reportId, round]);
  return { state, again: useCallback(() => setRound((count) => count + 1), []) };
}

const modeNow = (): 'light' | 'dark' => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

/** Portal's messages, only from its origin and its frame; the theme follows Lilachat's while open. */
function useEmbedTalk(frame: React.RefObject<HTMLIFrameElement | null>, link: EmbedLink | null, onClose: (changed: boolean) => void, onExpired: () => void) {
  const origin = link ? new URL(link.url).origin : null;
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = useRef(false);
  // After «closed» the same save may still post its dirty or saved (Portal aa4cf2d9): nothing counts any more.
  const closed = useRef(false);
  // The latest callbacks, so a parent's re-render does not reset the frame's state.
  const handlers = useRef({ onClose, onExpired });
  handlers.current = { onClose, onExpired };
  const post = useCallback((command: EmbedCommand) => { if (origin) frame.current?.contentWindow?.postMessage(command, origin); }, [frame, origin]);
  useEffect(() => {
    setReady(false);
    setError(null);
  }, [link?.url]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (closed.current || event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      const message = embedEventOf(event.data);
      if (message?.type === 'ready') {
        setReady(true);
        post(embedTheme(modeNow()));
      } else if (message?.type === 'dirty') setDirty(message.dirty);
      else if (message?.type === 'saved' || message?.type === 'published') changed.current = true;
      else if (message?.type === 'closed') {
        closed.current = true;
        handlers.current.onClose(changed.current);
      }
      else if (message?.type === 'error') (message.code === 'expired' ? handlers.current.onExpired() : setError(embedErrorLine(message.code)));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frame, origin, post]);
  useEffect(() => {
    if (!ready) return;
    const watch = new MutationObserver(() => post(embedTheme(modeNow())));
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => watch.disconnect();
  }, [ready, post]);
  return { ready, dirty, error, changed, post };
}

function useLeaveGuards(dirty: boolean, requestClose: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && requestClose();
    const onLeave = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [dirty, requestClose]);
}

function Failure({ message, url, onRetry }: { message: string; url?: string; onRetry: () => void }) {
  return (
    <div data-testid="editor-portal-fallo" className="m-auto max-w-md rounded-xl border border-outline/20 bg-surface p-5 text-center">
      <p className="font-semibold">{message}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onRetry} className="h-11 rounded-lg border border-primary/30 bg-primary/10 px-4 text-sm font-semibold text-primary">Reintentar</button>
        {url ? <a href={url} target="_blank" rel="noreferrer" className="flex h-11 items-center gap-1.5 rounded-lg border border-outline/30 px-4 text-sm font-semibold"><ExternalLink size={14} /> Abrir en el Portal</a> : null}
      </div>
    </div>
  );
}

export function PortalEmbedWeb(props: Props) {
  const { state, again } = useEmbedLink(props.target, props.serviceId, props.report.id);
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [closing, setClosing] = useState(false);
  const link = state.kind === 'ready' ? state.link : null;
  const { onClose } = props;
  const talk = useEmbedTalk(frame, link, onClose, again);
  const requestClose = useCallback(() => {
    if (!talk.ready || talk.error) return onClose(talk.changed.current);
    talk.post(embedCloseRequest());
    setClosing(true);
  }, [talk, onClose]);
  useEffect(() => {
    if (!closing || talk.dirty) return;
    const timer = setTimeout(() => onClose(talk.changed.current), CLOSE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [closing, talk.dirty, talk.changed, onClose]);
  useLeaveGuards(talk.dirty, requestClose);
  const failure = state.kind === 'failed' ? state.message : talk.error;
  const ownBar = !talk.ready || Boolean(failure);
  return createPortal(
    <div data-testid="editor-portal" role="dialog" aria-label={`Editor de ${props.report.title}`} className="fixed inset-0 z-50 flex flex-col bg-background text-on-surface">
      {ownBar ? <header className="flex h-14 shrink-0 items-center gap-2 border-b border-outline/15 px-2">
        <button type="button" data-testid="editor-portal-volver" onClick={requestClose} aria-label="Volver" className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface"><ChevronLeft size={20} /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{props.serviceName}</p>
          <p className="truncate text-[15px] font-semibold">{props.report.title}</p>
        </div>
      </header> : null}
      <div className="relative flex flex-1">
        {failure ? <Failure message={failure} {...(props.report.url ? { url: props.report.url } : {})} onRetry={again} /> : null}
        {link && !failure ? <iframe ref={frame} key={link.url} data-testid="editor-portal-marco" src={link.url} title={`Editor de ${props.report.title}`} onLoad={() => setLoaded(true)} className="h-full w-full flex-1 border-0" /> : null}
        {!failure && (!link || !loaded) && !talk.ready ? <div className="pointer-events-none absolute inset-4 animate-pulse rounded-xl bg-surface" /> : null}
      </div>
    </div>,
    document.body
  );
}
