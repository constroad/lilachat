import { useEffect, useState } from 'react';
import type { GifResult } from '@lilachat/shared';
import { api } from '../../api';

/** GIPHY through Lilachat's server (backlog 37; `server/src/gifRoutes.ts`): the key never reaches the browser. */
export const searchGifs = (jwt: string, q: string, offset: number) => api<{ gifs: GifResult[] }>(`/gifs/search?${new URLSearchParams({ q, offset: String(offset) })}`, { jwt });

/** A new key per click: the same click retried by the network is one message on the server. */
export const newGifKey = () => `gif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const sendGif = (jwt: string, chatId: string, gifId: string, clientKey: string) => api<{ message: unknown }>('/gifs/send', { jwt, body: { chatId, gifId, clientKey } });

let known: boolean | null = null;

/** Whether the server has GIPHY's key: without it the panel has no «GIF» tab. Asked once per session. */
export function useGifsAvailable(jwt: string | undefined): boolean {
  const [available, setAvailable] = useState(known === true);
  useEffect(() => {
    if (known !== null || !jwt) return;
    let alive = true;
    void api<{ available: boolean }>('/gifs', { jwt }).then((result) => {
      if (!result.ok) return;
      known = result.data.available === true;
      if (alive) setAvailable(known);
    });
    return () => {
      alive = false;
    };
  }, [jwt]);
  return available;
}
