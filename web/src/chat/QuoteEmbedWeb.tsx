import { useCallback, useEffect, useRef, useState } from 'react';
import { EMBED_FAILED, embedLinkOf, PORTAL_EMBED_ORIGINS, quoteEmbedPath, type EmbedBody, type EmbedLink } from '@lilachat/shared';
import { api } from '../api';
import { PortalEmbedFrame, type LinkState } from '../spaces/clients/reports/PortalEmbedWeb';

/**
 * «Editar» on a Dali quote's card (José via agentes 20/11): Portal's editor framed over the window, the
 * same `PortalEmbedFrame` a report uses. Asked by the chat it lives in, never a prospect id the card
 * would have to carry: the server resolves it from `chatId`.
 */
const PORTAL_DEV_ORIGIN = 'http://localhost:3000';
const FRAMED_ORIGINS: readonly string[] = import.meta.env.DEV ? [PORTAL_EMBED_ORIGINS.production, PORTAL_DEV_ORIGIN] : [PORTAL_EMBED_ORIGINS.production];

function useQuoteEmbedLink(jwt: string, spaceId: string, chatId: string, quoteId: string) {
  const [state, setState] = useState<LinkState>({ kind: 'asking' });
  const [round, setRound] = useState(0);
  useEffect(() => {
    let alive = true;
    setState({ kind: 'asking' });
    void api<EmbedBody>(quoteEmbedPath(spaceId, chatId, quoteId), { jwt }).then((reply) => {
      if (!alive) return;
      const link: EmbedLink | null = reply.ok ? embedLinkOf(reply.data.embed, FRAMED_ORIGINS, 'quote') : null;
      setState(link ? { kind: 'ready', link } : { kind: 'failed', message: reply.ok ? reply.data.message ?? EMBED_FAILED : reply.message });
    });
    return () => { alive = false; };
  }, [jwt, spaceId, chatId, quoteId, round]);
  return { state, again: useCallback(() => setRound((count) => count + 1), []) };
}

export function QuoteEmbedWeb(props: { jwt: string; spaceId: string; chatId: string; quoteId: string; onClose: () => void }) {
  const { state, again } = useQuoteEmbedLink(props.jwt, props.spaceId, props.chatId, props.quoteId);
  const closed = useRef(false);
  const onClose = useCallback((_changed: boolean) => {
    if (closed.current) return;
    closed.current = true;
    props.onClose();
  }, [props]);
  return <PortalEmbedFrame state={state} again={again} kicker="Dali" title="Cotización" onClose={onClose} />;
}
