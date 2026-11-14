import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { EMBED_FAILED, PORTAL_EMBED_ORIGINS, embedCloseRequest, embedErrorLine, embedEventOf, embedLinkOf, embedReportIdOf, embedTheme, reportEmbedCreatePath, reportEmbedPath, type EmbedBody, type EmbedCommand, type EmbedCreateRequest, type EmbedLink } from '@lilachat/shared';
import { api } from '../../../api';
import type { ServiceAskTarget } from '../useServiceAsk';

/**
 * Portal's canvas editor of a report, framed over the whole window (Portal
 * 11/11, José: every member edits, only admins delete, versions restorable in
 * Portal). One bar, Portal's (José 12/11: «doble toolbar para regresar»): its
 * «Cerrar editor» saves and posts `closed`. Lilachat's bar shows only while
 * Portal is not ready or failed, or when its changes stay unsaved too long;
 * Escape asks Portal to close.
 */
/** An existing report (its id), or a new one of a type (José 12/11: on the wide web reports are born in the editor). */
type EmbedReport = { id?: string; title: string; url?: string; create?: EmbedCreateRequest };
type Props = { target: ServiceAskTarget; serviceId: string; serviceName: string; report: EmbedReport; onClose: (changed: boolean) => void };
export type LinkState = { kind: 'asking' } | { kind: 'ready'; link: EmbedLink } | { kind: 'failed'; message: string };

/** The dev web frames the local Portal too; the built one, production only (its CSP frames nothing else). */
/** Portal's dev server, framed only while developing. */
const PORTAL_DEV_ORIGIN = 'http://localhost:3000';
export const FRAMED_ORIGINS: readonly string[] = import.meta.env.DEV ? [PORTAL_EMBED_ORIGINS.production, PORTAL_DEV_ORIGIN] : [PORTAL_EMBED_ORIGINS.production];
/** With nothing unsaved, Portal answers at once; a frame that does not answer does not keep the person in. */
const CLOSE_WAIT_MS = 3000;
/** E2E 12/11: Portal's save hung on «Guardando…» and its «Cerrar editor» never posted `closed`; past this, Lilachat's bar offers a way out. */
const UNSAVED_TOO_LONG_MS = 45_000;

function useEmbedLink(target: ServiceAskTarget, serviceId: string, report: EmbedReport) {
  const { jwt, spaceId, clientId } = target;
  const [state, setState] = useState<LinkState>({ kind: 'asking' });
  const [round, setRound] = useState(0);
  // A created report is asked by its id from its first link on: an expired link never creates another.
  const known = useRef(report.id ?? null);
  const create = useRef(report.create);
  useEffect(() => {
    let alive = true;
    setState({ kind: 'asking' });
    const id = known.current;
    const asked = id ? api<EmbedBody>(reportEmbedPath(spaceId, clientId, serviceId, id), { jwt }) : api<EmbedBody>(reportEmbedCreatePath(spaceId, clientId, serviceId), { jwt, body: create.current });
    void asked.then((reply) => {
      if (!alive) return;
      const link = reply.ok ? embedLinkOf(reply.data.embed, FRAMED_ORIGINS) : null;
      if (link) known.current = embedReportIdOf(link.url) ?? known.current;
      setState(link ? { kind: 'ready', link } : { kind: 'failed', message: reply.ok ? reply.data.message ?? EMBED_FAILED : reply.message });
    });
    return () => { alive = false; };
  }, [jwt, spaceId, clientId, serviceId, round]);
  return { state, again: useCallback(() => setRound((count) => count + 1), []) };
}

const modeNow = (): 'light' | 'dark' => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

/** Portal's messages, only from its origin and its frame; the theme follows Lilachat's while open. */
function useEmbedTalk(frame: React.RefObject<HTMLIFrameElement | null>, link: EmbedLink | null, onClose: (changed: boolean) => void, onExpired: () => void) {
  const origin = link ? new URL(link.url).origin : null;
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
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
      else if (message?.type === 'saved' || message?.type === 'published') {
        changed.current = true;
        if (message.type === 'saved') setSavedAt(message.savedAt);
      }
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
  return { ready, dirty, error, savedAt, changed, post };
}

/** True once Portal's changes stay unsaved too long: every «saved» starts the count again. */
function useUnsavedTooLong(dirty: boolean, savedAt: string | null): boolean {
  const [tooLong, setTooLong] = useState(false);
  useEffect(() => {
    setTooLong(false);
    if (!dirty) return;
    const timer = setTimeout(() => setTooLong(true), UNSAVED_TOO_LONG_MS);
    return () => clearTimeout(timer);
  }, [dirty, savedAt]);
  return tooLong;
}

function StuckNotice({ onLeave }: { onLeave: () => void }) {
  return (
    <div data-testid="editor-portal-atascado" role="status" className="flex shrink-0 items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-sm">
      <span className="font-semibold text-warning">Los cambios aún no se guardan en el Portal.</span>
      <button type="button" data-testid="editor-portal-salir" onClick={onLeave} className="h-9 rounded-lg border border-outline/30 bg-surface px-3 text-sm font-semibold">Salir igual</button>
    </div>
  );
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

/** A report in Portal's editor: its link asked by the service, then the shared frame. */
export function PortalEmbedWeb(props: Props) {
  const { state, again } = useEmbedLink(props.target, props.serviceId, props.report);
  return <PortalEmbedFrame state={state} again={again} kicker={props.serviceName} title={props.report.title} {...(props.report.url ? { fallbackUrl: props.report.url } : {})} onClose={props.onClose} />;
}

/** Lilachat's own bar, only while Portal's is not there (not ready, failed, or stuck saving). */
function EmbedBar(props: { kicker: string; title: string; onBack: () => void; onLeave?: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-outline/15 px-2">
      <button type="button" data-testid="editor-portal-volver" onClick={props.onBack} aria-label="Volver" className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface"><ChevronLeft size={20} /></button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{props.kicker}</p>
        <p className="truncate text-[15px] font-semibold">{props.title}</p>
      </div>
      {props.onLeave ? <StuckNotice onLeave={props.onLeave} /> : null}
    </header>
  );
}

type EmbedTalk = ReturnType<typeof useEmbedTalk>;

/** Closing asks Portal first (it saves and posts `closed`); a frame not ready, failed or stuck is left at once. */
function useEmbedClose(talk: EmbedTalk, stuck: boolean, onClose: (changed: boolean) => void) {
  const [closing, setClosing] = useState(false);
  const leave = useCallback(() => onClose(talk.changed.current), [onClose, talk.changed]);
  const requestClose = useCallback(() => {
    if (!talk.ready || talk.error || stuck) return leave();
    talk.post(embedCloseRequest());
    setClosing(true);
  }, [talk, stuck, leave]);
  useEffect(() => {
    if (!closing || talk.dirty) return;
    const timer = setTimeout(() => onClose(talk.changed.current), CLOSE_WAIT_MS);
    return () => clearTimeout(timer);
  }, [closing, talk.dirty, talk.changed, onClose]);
  useLeaveGuards(talk.dirty, requestClose);
  return { leave, requestClose };
}

/** The frame itself, its failure, and a skeleton until Portal says it is ready. */
function EmbedBody(props: { failure: string | null; link: EmbedLink | null; ready: boolean; frame: React.RefObject<HTMLIFrameElement>; title: string; fallbackUrl?: string; onRetry: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const { failure, link } = props;
  return (
    <div className="relative flex flex-1">
      {failure ? <Failure message={failure} {...(props.fallbackUrl ? { url: props.fallbackUrl } : {})} onRetry={props.onRetry} /> : null}
      {link && !failure ? <iframe ref={props.frame} key={link.url} data-testid="editor-portal-marco" src={link.url} title={`Editor de ${props.title}`} onLoad={() => setLoaded(true)} className="h-full w-full flex-1 border-0" /> : null}
      {!failure && (!link || !loaded) && !props.ready ? <div className="pointer-events-none absolute inset-4 animate-pulse rounded-xl bg-surface" /> : null}
    </div>
  );
}

type FrameProps = { state: LinkState; again: () => void; kicker: string; title: string; fallbackUrl?: string; onClose: (changed: boolean) => void };

/** Portal's editor over the whole window, whatever it edits (a report, a visit's croquis): one bar, Portal's. */
export function PortalEmbedFrame(props: FrameProps) {
  const { state, again } = props;
  const frame = useRef<HTMLIFrameElement>(null);
  const link = state.kind === 'ready' ? state.link : null;
  const talk = useEmbedTalk(frame, link, props.onClose, again);
  const stuck = useUnsavedTooLong(talk.dirty, talk.savedAt);
  const { leave, requestClose } = useEmbedClose(talk, stuck, props.onClose);
  const failure = state.kind === 'failed' ? state.message : talk.error;
  const ownBar = !talk.ready || Boolean(failure) || stuck;
  return createPortal(
    <div data-testid="editor-portal" role="dialog" aria-label={`Editor de ${props.title}`} className="fixed inset-0 z-50 flex flex-col bg-background text-on-surface">
      {ownBar ? <EmbedBar kicker={props.kicker} title={props.title} onBack={requestClose} {...(stuck && !failure ? { onLeave: leave } : {})} /> : null}
      <EmbedBody failure={failure} link={link} ready={talk.ready} frame={frame} title={props.title} {...(props.fallbackUrl ? { fallbackUrl: props.fallbackUrl } : {})} onRetry={again} />
    </div>,
    document.body
  );
}
