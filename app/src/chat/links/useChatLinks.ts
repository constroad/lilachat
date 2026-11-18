import { useCallback, useEffect, useRef, useState } from 'react';
import type { LinkCard, LinkCategory } from '@lilachat/shared';
import { getSocket } from '../socketClient';
import { applyLinkUpdate } from './linkView';
import { fetchChatLinks, mergeLinkCategory, patchLinkCategory, postLinkCategory, postLinkRefresh, putLinkCategoryOf, type ChatLinks } from './linksApi';

/** A burst of cards (turning the switch on sorts 60 links) costs one reload, not sixty. */
const RELOAD_DEBOUNCE_MS = 1500;
const NO_CONNECTION = 'Sin conexión. Inténtalo de nuevo.';

export type LinksStatus = 'idle' | 'loading' | 'error' | 'ready';
/** `null` when it worked; the reason to show when it did not. */
export type LinkActionResult = Promise<string | null>;

export type ChatLinksState = {
  status: LinksStatus;
  links: ChatLinks | null;
  reload: () => void;
  move: (seq: number, categoryId: string | null) => LinkActionResult;
  create: (name: string) => Promise<LinkCategory | string>;
  rename: (categoryId: string, name: string) => LinkActionResult;
  merge: (categoryId: string, into: string | null) => LinkActionResult;
  retry: (seq: number) => LinkActionResult;
};

/** Listens to `msg.link` and `chat.links.changed` of ONE chat while `active`. */
function useLinksSocket(chatId: string, active: boolean, onLink: (seq: number, link: LinkCard) => void, onChanged: () => void) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !active) return;
    const handleLink = (frame: { chatId: string; seq: number; link?: LinkCard }) => {
      if (frame.chatId === chatId && frame.link) onLink(frame.seq, frame.link);
    };
    const handleChanged = (frame: { chatId: string }) => {
      if (frame.chatId === chatId) onChanged();
    };
    socket.on('msg.link', handleLink);
    socket.on('chat.links.changed', handleChanged);
    return () => {
      socket.off('msg.link', handleLink);
      socket.off('chat.links.changed', handleChanged);
    };
  }, [chatId, active, onLink, onChanged]);
}

/**
 * The saved links of a notes chat with their categories (José 18/11): read
 * once when the chat opens with the switch on, kept live by socket.
 */
export function useChatLinks(params: { chatId: string; jwt: string; active: boolean }): ChatLinksState {
  const { chatId, jwt, active } = params;
  const [status, setStatus] = useState<LinksStatus>('idle');
  const [links, setLinks] = useState<ChatLinks | null>(null);
  const linksRef = useRef(links);
  linksRef.current = links;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(() => {
    if (!linksRef.current) setStatus('loading');
    void fetchChatLinks(jwt, chatId).then((answer) => {
      if (answer.ok) {
        setLinks(answer.data);
        setStatus('ready');
      } else if (!linksRef.current) setStatus('error');
    });
  }, [jwt, chatId]);

  const reloadSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(reload, RELOAD_DEBOUNCE_MS);
  }, [reload]);

  useEffect(() => {
    if (active) reload();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [active, reload]);

  const putCard = useCallback(
    (seq: number, link: LinkCard) => {
      const current = linksRef.current;
      const items = current ? applyLinkUpdate(current.items, seq, link) : null;
      if (current && items) setLinks({ ...current, items });
      else reloadSoon();
    },
    [reloadSoon]
  );
  useLinksSocket(chatId, active, putCard, reloadSoon);

  const actions = useLinkActions({ chatId, jwt, putCard, reload, setLinks });
  return { status, links, reload, ...actions };
}

/** The changes a person makes; each one answers with the server's reason when it is refused. */
function useLinkActions(params: { chatId: string; jwt: string; putCard: (seq: number, link: LinkCard) => void; reload: () => void; setLinks: (update: (current: ChatLinks | null) => ChatLinks | null) => void }) {
  const { chatId, jwt, putCard, reload, setLinks } = params;
  const move = useCallback(
    async (seq: number, categoryId: string | null) => {
      const answer = await putLinkCategoryOf(jwt, chatId, seq, categoryId);
      if (!answer.ok) return answer.message ?? NO_CONNECTION;
      putCard(seq, answer.data.link);
      return null;
    },
    [jwt, chatId, putCard]
  );
  const create = useCallback(
    async (name: string) => {
      const answer = await postLinkCategory(jwt, chatId, name.trim());
      if (!answer.ok) return answer.message ?? NO_CONNECTION;
      const { category } = answer.data;
      setLinks((current) => (current ? { ...current, categories: [...current.categories, category] } : current));
      return category;
    },
    [jwt, chatId, setLinks]
  );
  const afterChange = useCallback(
    async (request: Promise<{ ok: boolean; message?: string }>) => {
      const answer = await request;
      if (!answer.ok) return answer.message ?? NO_CONNECTION;
      reload();
      return null;
    },
    [reload]
  );
  const rename = useCallback((categoryId: string, name: string) => afterChange(patchLinkCategory(jwt, chatId, categoryId, name.trim())), [afterChange, jwt, chatId]);
  const merge = useCallback((categoryId: string, into: string | null) => afterChange(mergeLinkCategory(jwt, chatId, categoryId, into)), [afterChange, jwt, chatId]);
  const retry = useCallback(async (seq: number) => {
    const answer = await postLinkRefresh(jwt, chatId, seq);
    return answer.ok ? null : (answer.message ?? NO_CONNECTION);
  }, [jwt, chatId]);
  return { move, create, rename, merge, retry };
}
